import { ParsedRecipeData } from '@/types/recipe';

export async function parseRecipeFromText(text: string): Promise<ParsedRecipeData> {
  console.log('Parsing recipe from text:', text.substring(0, 100));
  
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
    
    if (lowerLine.includes('instruction') || lowerLine.includes('direction') || lowerLine.includes('step')) {
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
  
  if (ingredients.length === 0) {
    ingredients.push(
      { name: 'First ingredient', quantity: '1 cup' },
      { name: 'Second ingredient', quantity: '2 tbsp' }
    );
  }
  
  if (steps.length === 0) {
    steps.push(
      { order: 1, instruction: 'Prepare all ingredients' },
      { order: 2, instruction: 'Follow the cooking process' },
      { order: 3, instruction: 'Serve and enjoy!' }
    );
  }
  
  return { title, ingredients, steps };
}

export async function parseRecipeFromLink(url: string): Promise<ParsedRecipeData> {
  console.log('Parsing recipe from URL:', url);
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return {
    title: 'Recipe from Link',
    description: `Imported from: ${url}`,
    ingredients: [
      { name: 'Ingredient from web', quantity: '1 cup' },
      { name: 'Another ingredient', quantity: '2 tbsp' },
      { name: 'Main protein', quantity: '500g' },
    ],
    steps: [
      { order: 1, instruction: 'Prepare all ingredients as listed' },
      { order: 2, instruction: 'Follow the cooking method from the original recipe' },
      { order: 3, instruction: 'Adjust seasoning to taste' },
      { order: 4, instruction: 'Plate and serve' },
    ],
  };
}

export async function parseRecipeFromImages(imageUris: string[]): Promise<ParsedRecipeData> {
  console.log('Parsing recipe from images:', imageUris.length, 'images');
  
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  return {
    title: 'Recipe from Image',
    description: `Parsed from ${imageUris.length} image(s)`,
    ingredients: [
      { name: 'Visible ingredient 1', quantity: '1 cup' },
      { name: 'Visible ingredient 2', quantity: '200g' },
      { name: 'Spices to taste', quantity: 'to taste' },
    ],
    steps: [
      { order: 1, instruction: 'Gather ingredients shown in the image' },
      { order: 2, instruction: 'Prepare according to visual instructions' },
      { order: 3, instruction: 'Cook until done' },
    ],
  };
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}
