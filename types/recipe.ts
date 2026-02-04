export interface Ingredient {
  id: string;
  name: string;
  quantity: string;
  checked: boolean;
  alreadyHave: boolean;
}

export interface RecipeStep {
  id: string;
  order: number;
  instruction: string;
}

export type RecipeCategory = 
  | 'pasta'
  | 'vegetarian'
  | 'dessert'
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'snack'
  | 'soup'
  | 'salad'
  | 'other';

export type RecipeStatus = 'saved' | 'cooked';

export type RecipeSource = 'text' | 'link' | 'image';

export interface Recipe {
  id: string;
  title: string;
  description?: string;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  category: RecipeCategory;
  status: RecipeStatus;
  source: RecipeSource;
  sourceUrl?: string;
  imageUri?: string;
  cookDate?: string;
  reminderEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ParsedRecipeData {
  title: string;
  description?: string;
  ingredients: Omit<Ingredient, 'id' | 'checked' | 'alreadyHave'>[];
  steps: Omit<RecipeStep, 'id'>[];
}
