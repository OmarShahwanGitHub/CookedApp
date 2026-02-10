import { ParsedRecipeData } from '@/types/recipe';

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

Recipe text:
`;

type ProviderName = 'Anthropic' | 'OpenAI' | 'Gemini';

interface ProviderConfig {
  name: ProviderName;
  envKey: string;
  call: (prompt: string, apiKey: string) => Promise<ParsedRecipeData>;
}

const PROVIDERS: ProviderConfig[] = [
  { name: 'Anthropic', envKey: 'ANTHROPIC_API_KEY', call: callAnthropic },
  { name: 'OpenAI', envKey: 'OPENAI_API_KEY', call: callOpenAI },
  { name: 'Gemini', envKey: 'GEMINI_API_KEY', call: callGemini },
];

export async function parseRecipeFromText(text: string): Promise<ParsedRecipeData> {
  const prompt = RECIPE_PARSE_PROMPT + text;

  for (const provider of PROVIDERS) {
    const apiKey = getEnvVar(provider.envKey);
    if (!apiKey) {
      continue;
    }

    try {
      console.log(`Trying recipe parsing with ${provider.name}...`);
      const result = await provider.call(prompt, apiKey);
      console.log(`Successfully parsed recipe with ${provider.name}`);
      return result;
    } catch (error) {
      console.warn(`${provider.name} parsing failed, trying next provider:`, error);
    }
  }

  console.log('No LLM providers available or all failed, using basic parser');
  return parseWithBasicParser(text);
}

function getEnvVar(key: string): string | null {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || null;
  }
  return null;
}

async function callAnthropic(prompt: string, apiKey: string): Promise<ParsedRecipeData> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.content?.[0]?.text;

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in Anthropic response');
  }

  return validateParsedRecipe(JSON.parse(jsonMatch[0]));
}

async function callOpenAI(prompt: string, apiKey: string): Promise<ParsedRecipeData> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  return validateParsedRecipe(JSON.parse(content));
}

async function callGemini(prompt: string, apiKey: string): Promise<ParsedRecipeData> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!content) {
    throw new Error('No content in Gemini response');
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in Gemini response');
  }

  return validateParsedRecipe(JSON.parse(jsonMatch[0]));
}

function validateParsedRecipe(data: any): ParsedRecipeData {
  return {
    title: typeof data.title === 'string' ? data.title : 'Untitled Recipe',
    description: typeof data.description === 'string' ? data.description : undefined,
    ingredients: Array.isArray(data.ingredients)
      ? data.ingredients.map((i: any) => ({
          name: typeof i.name === 'string' ? i.name : 'Unknown ingredient',
          quantity: typeof i.quantity === 'string' ? i.quantity : '',
        }))
      : [],
    steps: Array.isArray(data.steps)
      ? data.steps.map((s: any, idx: number) => ({
          order: typeof s.order === 'number' ? s.order : idx + 1,
          instruction: typeof s.instruction === 'string' ? s.instruction : '',
        }))
      : [],
  };
}

function parseWithBasicParser(text: string): ParsedRecipeData {
  const lines = text.split('\n').filter(line => line.trim());
  const title = lines[0] || 'Untitled Recipe';

  const ingredientKeywords = ['cup', 'tbsp', 'tsp', 'oz', 'lb', 'g', 'kg', 'ml', 'l', 'piece', 'clove', 'pinch'];
  const ingredients: ParsedRecipeData['ingredients'] = [];
  const steps: ParsedRecipeData['steps'] = [];

  let inIngredients = false;
  let inSteps = false;
  let stepOrder = 1;

  for (const line of lines.slice(1)) {
    const lowerLine = line.toLowerCase();

    if (lowerLine.includes('ingredient')) {
      inIngredients = true;
      inSteps = false;
      continue;
    }

    if (lowerLine.includes('instruction') || lowerLine.includes('direction') || lowerLine.includes('step') || lowerLine.includes('method')) {
      inIngredients = false;
      inSteps = true;
      continue;
    }

    if (inIngredients || ingredientKeywords.some(k => lowerLine.includes(k))) {
      const match = line.match(/^[\d\s\/\.\-]+/);
      const quantity = match ? match[0].trim() : '';
      const name = match ? line.slice(match[0].length).trim() : line.trim();

      if (name) {
        ingredients.push({ name, quantity });
      }
    } else if (inSteps || /^\d+[\.\)]/.test(line.trim())) {
      const instruction = line.replace(/^\d+[\.\)]\s*/, '').trim();
      if (instruction) {
        steps.push({ order: stepOrder++, instruction });
      }
    }
  }

  if (ingredients.length === 0 && steps.length === 0) {
    const midPoint = Math.floor(lines.length / 2);
    for (let i = 1; i < midPoint; i++) {
      ingredients.push({ name: lines[i].trim(), quantity: '' });
    }
    for (let i = midPoint; i < lines.length; i++) {
      steps.push({ order: stepOrder++, instruction: lines[i].trim() });
    }
  }

  return { title, ingredients, steps };
}
