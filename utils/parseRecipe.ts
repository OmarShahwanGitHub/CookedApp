import { ParsedRecipeData } from '@/types/recipe';
import { normalizeInputToText, InputType } from '@/services/inputNormalizer';
import { parseRecipeFromText as parseWithService, parseRecipeFromImages } from '@/services/recipeParser';

const VIDEO_BACKEND_URL = process.env.EXPO_PUBLIC_VIDEO_BACKEND_URL || '';

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
  const response = await fetch(`${VIDEO_BACKEND_URL}/parse-video`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    let errorMsg = 'Failed to parse video.';
    try {
      const errBody = await response.json();
      errorMsg = errBody.error || errorMsg;
    } catch {}
    throw new Error(errorMsg);
  }

  const data = await response.json();
  return data.recipe;
}

export { parseRecipeFromText } from '@/services/recipeParser';

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}
