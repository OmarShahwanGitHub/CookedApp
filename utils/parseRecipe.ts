import { ParsedRecipeData } from '@/types/recipe';
import { normalizeInputToText, InputType } from '@/services/inputNormalizer';
import { parseRecipeFromText as parseWithService } from '@/services/recipeParser';

export async function parseRecipe(
  input: string | string[],
  inputType: InputType
): Promise<ParsedRecipeData> {
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

export { parseRecipeFromText } from '@/services/recipeParser';

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}
