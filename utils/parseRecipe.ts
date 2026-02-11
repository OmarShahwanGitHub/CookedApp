import { ParsedRecipeData } from '@/types/recipe';
import { normalizeInputToText, InputType } from '@/services/inputNormalizer';
import { parseRecipeFromText as parseWithService, parseRecipeFromImages } from '@/services/recipeParser';
import Constants from 'expo-constants';

function getVideoBackendUrl(): string {
  const configured = process.env.EXPO_PUBLIC_VIDEO_BACKEND_URL;
  if (configured) return configured;

  const debuggerHost = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost || Constants.manifest?.debuggerHost;
  if (debuggerHost) {
    const lanIp = debuggerHost.split(':')[0];
    return `http://${lanIp}:3001`;
  }

  return 'http://localhost:3001';
}

export async function parseRecipe(
  input: string | string[],
  inputType: InputType
): Promise<ParsedRecipeData> {
  if (inputType === 'image') {
    const imageUris = Array.isArray(input) ? input : [input];
    return parseRecipeFromImages(imageUris);
  }

  if (inputType === 'video') {
    return parseVideoViaBackend(input as string);
  }

  const normalized = await normalizeInputToText(input, inputType);

  if (normalized.metadata?.isStub) {
    return {
      title: 'Recipe',
      description: normalized.text,
      ingredients: [],
      steps: [],
    };
  }

  return parseWithService(normalized.text);
}

async function parseVideoViaBackend(url: string): Promise<ParsedRecipeData> {
  const backendUrl = getVideoBackendUrl();
  const endpoint = `${backendUrl}/parse-video`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  const text = await response.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Server returned an unexpected response. Please try again.');
  }

  if (!response.ok) {
    throw new Error(data.error || 'Failed to parse video.');
  }

  return data.recipe;
}

export { parseRecipeFromText } from '@/services/recipeParser';

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}
