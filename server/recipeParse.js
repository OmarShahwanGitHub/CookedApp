const https = require('https');

const RECIPE_PARSE_PROMPT = `You are a recipe parser. Extract the following from the text below and return valid JSON only (no markdown, no explanation):

{
  "title": "Recipe Title",
  "description": "Brief description",
  "ingredients": [
    { "name": "ingredient name", "quantity": "amount with unit" }
  ],
  "steps": [
    { "order": 1, "instruction": "Step instruction written for a beginner cook" }
  ]
}

Rules:
- Make instructions beginner-friendly and clear
- Include exact quantities where available
- If quantities are missing, estimate reasonable amounts
- Break complex steps into simpler sub-steps
- Keep ingredient names simple (e.g., "olive oil" not "extra virgin cold-pressed olive oil")
- The text is a transcript from a cooking video, so ignore any non-recipe content like greetings, sponsor mentions, etc.

Recipe transcript:
`;

const PROVIDERS = [
  {
    name: 'Anthropic',
    envKeys: ['EXPO_PUBLIC_ANTHROPIC_API_KEY', 'ANTHROPIC_API_KEY'],
    call: callAnthropic,
  },
  {
    name: 'OpenAI',
    envKeys: ['EXPO_PUBLIC_OPENAI_API_KEY', 'OPENAI_API_KEY'],
    call: callOpenAI,
  },
  {
    name: 'Gemini',
    envKeys: ['EXPO_PUBLIC_GEMINI_API_KEY', 'GEMINI_API_KEY'],
    call: callGemini,
  },
];

function getKey(envKeys) {
  for (const key of envKeys) {
    if (process.env[key]) return process.env[key];
  }
  return null;
}

async function parseTranscriptToRecipe(transcript) {
  const prompt = RECIPE_PARSE_PROMPT + transcript;

  for (const provider of PROVIDERS) {
    const apiKey = getKey(provider.envKeys);
    if (!apiKey) continue;

    try {
      console.log(`Trying recipe parsing with ${provider.name}...`);
      const result = await provider.call(prompt, apiKey);
      console.log(`Successfully parsed recipe with ${provider.name}`);
      return result;
    } catch (err) {
      console.warn(`${provider.name} parsing failed:`, err.message);
    }
  }

  throw new Error(
    'No AI provider available for recipe parsing. Set at least one of: ' +
    'ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY.'
  );
}

function callAnthropic(prompt, apiKey) {
  return httpPost('api.anthropic.com', '/v1/messages', {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    },
    extract: (data) => {
      const text = data.content?.[0]?.text;
      return extractAndValidateJson(text);
    },
  });
}

function callOpenAI(prompt, apiKey) {
  return httpPost('api.openai.com', '/v1/chat/completions', {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    },
    extract: (data) => {
      const text = data.choices?.[0]?.message?.content;
      return validateParsedRecipe(JSON.parse(text));
    },
  });
}

function callGemini(prompt, apiKey) {
  return httpPost(
    'generativelanguage.googleapis.com',
    `/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      headers: { 'Content-Type': 'application/json' },
      body: {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: 'application/json',
        },
      },
      extract: (data) => {
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('No content in Gemini response');
        return extractAndValidateJson(text);
      },
    }
  );
}

function httpPost(hostname, urlPath, { headers, body, extract }) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request(
      {
        hostname,
        path: urlPath,
        method: 'POST',
        headers: {
          ...headers,
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`${hostname} API error ${res.statusCode}: ${data.slice(0, 500)}`));
            return;
          }
          try {
            const parsed = JSON.parse(data);
            resolve(extract(parsed));
          } catch (err) {
            reject(new Error(`Failed to parse response: ${err.message}`));
          }
        });
        res.on('error', reject);
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function extractAndValidateJson(text) {
  if (!text) throw new Error('Empty response from AI provider');
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON found in response');
  return validateParsedRecipe(JSON.parse(match[0]));
}

function validateParsedRecipe(data) {
  return {
    title: typeof data.title === 'string' ? data.title : 'Untitled Recipe',
    description: typeof data.description === 'string' ? data.description : undefined,
    ingredients: Array.isArray(data.ingredients)
      ? data.ingredients.map((i) => ({
          name: typeof i.name === 'string' ? i.name : 'Unknown ingredient',
          quantity: typeof i.quantity === 'string' ? i.quantity : '',
        }))
      : [],
    steps: Array.isArray(data.steps)
      ? data.steps.map((s, idx) => ({
          order: typeof s.order === 'number' ? s.order : idx + 1,
          instruction: typeof s.instruction === 'string' ? s.instruction : '',
        }))
      : [],
  };
}

module.exports = { parseTranscriptToRecipe };
