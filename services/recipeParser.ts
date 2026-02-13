import { ParsedRecipeData } from '@/types/recipe';
import { readAsStringAsync } from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

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

const IMAGE_PARSE_PROMPT = `You are a recipe parser. Look at the recipe image(s) and extract all recipe information. Return valid JSON only (no markdown, no explanation):

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
- Read all text visible in the image(s) carefully
`;

type ProviderName = 'Anthropic' | 'OpenAI' | 'Gemini';

interface ProviderConfig {
  name: ProviderName;
  envKey: string;
  callText: (prompt: string, apiKey: string) => Promise<ParsedRecipeData>;
  callVision: (images: ImageData[], apiKey: string) => Promise<ParsedRecipeData>;
}

const PROVIDERS: ProviderConfig[] = [
  { name: 'Anthropic', envKey: 'ANTHROPIC_API_KEY', callText: callAnthropicText, callVision: callAnthropicVision },
  { name: 'OpenAI', envKey: 'OPENAI_API_KEY', callText: callOpenAIText, callVision: callOpenAIVision },
  { name: 'Gemini', envKey: 'GEMINI_API_KEY', callText: callGeminiText, callVision: callGeminiVision },
];

// Expo only inlines EXPO_PUBLIC_* when using static dot notation. Dynamic keys are not inlined.
function getApiKeyForProvider(envKey: string): string | null {
  if (typeof process === 'undefined' || !process.env) return null;
  switch (envKey) {
    case 'ANTHROPIC_API_KEY':
      return process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || null;
    case 'OPENAI_API_KEY':
      return process.env.EXPO_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY || null;
    case 'GEMINI_API_KEY':
      return process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || null;
    default:
      return null;
  }
}

export async function parseRecipeFromText(text: string): Promise<ParsedRecipeData> {
  const prompt = RECIPE_PARSE_PROMPT + text;

  const keysStatus = {
    Anthropic: !!getApiKeyForProvider('ANTHROPIC_API_KEY'),
    OpenAI: !!getApiKeyForProvider('OPENAI_API_KEY'),
    Gemini: !!getApiKeyForProvider('GEMINI_API_KEY'),
  };
  console.log('[RecipeParser] API keys present:', keysStatus);

  for (const provider of PROVIDERS) {
    const apiKey = getApiKeyForProvider(provider.envKey);
    if (!apiKey) {
      console.log(`[RecipeParser] Skipping ${provider.name} (no key)`);
      continue;
    }

    try {
      console.log(`[RecipeParser] Trying ${provider.name}...`);
      const result = await provider.callText(prompt, apiKey);
      console.log(`[RecipeParser] Success with ${provider.name}`);
      return result;
    } catch (error) {
      console.warn(`[RecipeParser] ${provider.name} failed:`, error);
    }
  }

  console.log('[RecipeParser] No LLM available or all failed, using basic parser');
  return parseWithBasicParser(text);
}

interface ImageData {
  base64: string;
  mimeType: string;
}

function detectMimeType(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.gif')) return 'image/gif';
  if (lower.includes('.webp')) return 'image/webp';
  if (lower.includes('.heic') || lower.includes('.heif')) return 'image/jpeg';
  return 'image/jpeg';
}

const MAX_BASE64_LENGTH = 5 * 1024 * 1024;

async function compressImageIfNeeded(uri: string): Promise<{ uri: string; mimeType: string }> {
  const originalMime = detectMimeType(uri);
  const needsConversion = originalMime !== 'image/jpeg' && originalMime !== 'image/png';

  const base64Original = await readAsStringAsync(uri, { encoding: 'base64' });
  console.log(`Original image: ${(base64Original.length / 1024 / 1024).toFixed(1)}MB base64, type: ${originalMime}`);

  if (base64Original.length <= MAX_BASE64_LENGTH && !needsConversion) {
    const normalized = await ImageManipulator.manipulateAsync(
      uri,
      [],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
    );
    const normBase64 = await readAsStringAsync(normalized.uri, { encoding: 'base64' });
    if (normBase64.length <= MAX_BASE64_LENGTH) {
      console.log(`Image normalized to JPEG: ${(normBase64.length / 1024 / 1024).toFixed(1)}MB base64`);
      return { uri: normalized.uri, mimeType: 'image/jpeg' };
    }
    console.log(`Normalized image still too large (${(normBase64.length / 1024 / 1024).toFixed(1)}MB base64), compressing further`);
  }

  const attempts: [number, number][] = [
    [2048, 0.8],
    [1600, 0.7],
    [1200, 0.6],
    [1000, 0.5],
    [800, 0.4],
    [600, 0.3],
  ];

  for (const [width, quality] of attempts) {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width } }],
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
    );

    const base64 = await readAsStringAsync(result.uri, { encoding: 'base64' });

    if (base64.length <= MAX_BASE64_LENGTH) {
      console.log(`Image compressed to ${(base64.length / 1024 / 1024).toFixed(1)}MB base64 (width: ${width}, quality: ${quality})`);
      return { uri: result.uri, mimeType: 'image/jpeg' };
    }
  }

  const lastResort = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 400 } }],
    { compress: 0.2, format: ImageManipulator.SaveFormat.JPEG }
  );
  console.log('Image compressed with last resort settings');
  return { uri: lastResort.uri, mimeType: 'image/jpeg' };
}

export async function parseRecipeFromImages(imageUris: string[]): Promise<ParsedRecipeData> {
  const maxImages = 5;
  const urisToProcess = imageUris.slice(0, maxImages);

  const images: ImageData[] = [];
  for (const uri of urisToProcess) {
    try {
      const compressed = await compressImageIfNeeded(uri);
      const base64 = await readAsStringAsync(compressed.uri, {
        encoding: 'base64',
      });

      images.push({
        base64,
        mimeType: compressed.mimeType,
      });
      console.log(`Image processed: ${(base64.length / 1024 / 1024).toFixed(1)}MB base64`);
    } catch (error) {
      console.warn(`Failed to process image: ${uri}`, error);
    }
  }

  if (images.length === 0) {
    throw new Error('Could not read any of the selected images. Please try selecting different images.');
  }

  const keysStatus = {
    Anthropic: !!getApiKeyForProvider('ANTHROPIC_API_KEY'),
    OpenAI: !!getApiKeyForProvider('OPENAI_API_KEY'),
    Gemini: !!getApiKeyForProvider('GEMINI_API_KEY'),
  };
  console.log('[RecipeParser] API keys present (images):', keysStatus);

  for (const provider of PROVIDERS) {
    const apiKey = getApiKeyForProvider(provider.envKey);
    if (!apiKey) continue;

    try {
      console.log(`[RecipeParser] Trying image parsing with ${provider.name}...`);
      const result = await provider.callVision(images, apiKey);
      console.log(`[RecipeParser] Success with ${provider.name}`);
      return result;
    } catch (error) {
      console.warn(`[RecipeParser] ${provider.name} image parsing failed:`, error);
    }
  }

  throw new Error('Could not parse recipe from images. Make sure you have an AI API key set in your .env file (EXPO_PUBLIC_ANTHROPIC_API_KEY, EXPO_PUBLIC_OPENAI_API_KEY, or EXPO_PUBLIC_GEMINI_API_KEY).');
}

async function handleApiError(providerName: string, response: Response): Promise<never> {
  let errorDetail = '';
  try {
    const errorBody = await response.json();
    errorDetail = JSON.stringify(errorBody);
    console.error(`${providerName} error body:`, errorDetail);
  } catch {
    errorDetail = await response.text().catch(() => 'unknown');
  }
  throw new Error(`${providerName} API error ${response.status}: ${errorDetail}`);
}

async function callAnthropicText(prompt: string, apiKey: string): Promise<ParsedRecipeData> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    await handleApiError('Anthropic', response);
  }

  const data = await response.json();
  const content = data.content?.[0]?.text;
  return extractAndValidateJson(content);
}

async function callAnthropicVision(images: ImageData[], apiKey: string): Promise<ParsedRecipeData> {
  const content: any[] = images.map(img => ({
    type: 'image',
    source: {
      type: 'base64',
      media_type: img.mimeType,
      data: img.base64,
    },
  }));
  content.push({ type: 'text', text: IMAGE_PARSE_PROMPT });

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!response.ok) {
    await handleApiError('Anthropic Vision', response);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text;
  return extractAndValidateJson(text);
}

async function callOpenAIText(prompt: string, apiKey: string): Promise<ParsedRecipeData> {
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
    await handleApiError('OpenAI', response);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  return validateParsedRecipe(JSON.parse(content));
}

async function callOpenAIVision(images: ImageData[], apiKey: string): Promise<ParsedRecipeData> {
  const content: any[] = images.map(img => ({
    type: 'image_url',
    image_url: {
      url: `data:${img.mimeType};base64,${img.base64}`,
    },
  }));
  content.push({ type: 'text', text: IMAGE_PARSE_PROMPT });

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    await handleApiError('OpenAI Vision', response);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  return validateParsedRecipe(JSON.parse(text));
}

async function callGeminiText(prompt: string, apiKey: string): Promise<ParsedRecipeData> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    await handleApiError('Gemini', response);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error('No content in Gemini response');
  return extractAndValidateJson(content);
}

async function callGeminiVision(images: ImageData[], apiKey: string): Promise<ParsedRecipeData> {
  const parts: any[] = images.map(img => ({
    inline_data: {
      mime_type: img.mimeType,
      data: img.base64,
    },
  }));
  parts.push({ text: IMAGE_PARSE_PROMPT });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!response.ok) {
    await handleApiError('Gemini Vision', response);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error('No content in Gemini Vision response');
  return extractAndValidateJson(content);
}

function extractAndValidateJson(text: string): ParsedRecipeData {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
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
