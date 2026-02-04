import { RecipeCategory } from '@/types/recipe';

export const RECIPE_CATEGORIES: { value: RecipeCategory; label: string; emoji: string }[] = [
  { value: 'breakfast', label: 'Breakfast', emoji: '🍳' },
  { value: 'lunch', label: 'Lunch', emoji: '🥗' },
  { value: 'dinner', label: 'Dinner', emoji: '🍽️' },
  { value: 'pasta', label: 'Pasta', emoji: '🍝' },
  { value: 'vegetarian', label: 'Vegetarian', emoji: '🥬' },
  { value: 'soup', label: 'Soup', emoji: '🍲' },
  { value: 'salad', label: 'Salad', emoji: '🥗' },
  { value: 'dessert', label: 'Dessert', emoji: '🍰' },
  { value: 'snack', label: 'Snack', emoji: '🍿' },
  { value: 'other', label: 'Other', emoji: '📝' },
];

export const getCategoryByValue = (value: RecipeCategory) => {
  return RECIPE_CATEGORIES.find((c) => c.value === value) || RECIPE_CATEGORIES[RECIPE_CATEGORIES.length - 1];
};
