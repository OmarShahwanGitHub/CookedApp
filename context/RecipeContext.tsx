import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Recipe, Ingredient, RecipeCategory, RecipeStatus } from '@/types/recipe';
import { generateId } from '@/utils/parseRecipe';

const RECIPES_STORAGE_KEY = 'cooked_recipes';

async function loadRecipes(): Promise<Recipe[]> {
  try {
    const stored = await AsyncStorage.getItem(RECIPES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load recipes:', error);
    return [];
  }
}

async function saveRecipes(recipes: Recipe[]): Promise<void> {
  try {
    await AsyncStorage.setItem(RECIPES_STORAGE_KEY, JSON.stringify(recipes));
  } catch (error) {
    console.error('Failed to save recipes:', error);
  }
}

interface RecipeContextValue {
  recipes: Recipe[];
  isLoading: boolean;
  addRecipe: (recipe: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>) => Recipe;
  updateRecipe: (id: string, updates: Partial<Recipe>) => void;
  deleteRecipe: (id: string) => void;
  updateIngredient: (recipeId: string, ingredientId: string, updates: Partial<Ingredient>) => void;
  toggleIngredientChecked: (recipeId: string, ingredientId: string) => void;
  toggleIngredientAlreadyHave: (recipeId: string, ingredientId: string) => void;
  markAsCooked: (id: string) => void;
  getRecipeById: (id: string) => Recipe | undefined;
}

const RecipeContext = createContext<RecipeContextValue | null>(null);

export function RecipeProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  const recipesQuery = useQuery({
    queryKey: ['recipes'],
    queryFn: loadRecipes,
  });

  useEffect(() => {
    if (recipesQuery.data) {
      setRecipes(recipesQuery.data);
    }
  }, [recipesQuery.data]);

  const { mutate: syncRecipes } = useMutation({
    mutationFn: saveRecipes,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });

  const addRecipe = useCallback((recipe: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newRecipe: Recipe = {
      ...recipe,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [...recipes, newRecipe];
    setRecipes(updated);
    syncRecipes(updated);
    return newRecipe;
  }, [recipes, syncRecipes]);

  const updateRecipe = useCallback((id: string, updates: Partial<Recipe>) => {
    const updated = recipes.map(r =>
      r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r
    );
    setRecipes(updated);
    syncRecipes(updated);
  }, [recipes, syncRecipes]);

  const deleteRecipe = useCallback((id: string) => {
    const updated = recipes.filter(r => r.id !== id);
    setRecipes(updated);
    syncRecipes(updated);
  }, [recipes, syncRecipes]);

  const updateIngredient = useCallback((recipeId: string, ingredientId: string, updates: Partial<Ingredient>) => {
    const updated = recipes.map(r => {
      if (r.id !== recipeId) return r;
      return {
        ...r,
        ingredients: r.ingredients.map(i =>
          i.id === ingredientId ? { ...i, ...updates } : i
        ),
        updatedAt: new Date().toISOString(),
      };
    });
    setRecipes(updated);
    syncRecipes(updated);
  }, [recipes, syncRecipes]);

  const toggleIngredientChecked = useCallback((recipeId: string, ingredientId: string) => {
    const recipe = recipes.find(r => r.id === recipeId);
    const ingredient = recipe?.ingredients.find(i => i.id === ingredientId);
    if (ingredient) {
      updateIngredient(recipeId, ingredientId, { checked: !ingredient.checked });
    }
  }, [recipes, updateIngredient]);

  const toggleIngredientAlreadyHave = useCallback((recipeId: string, ingredientId: string) => {
    const recipe = recipes.find(r => r.id === recipeId);
    const ingredient = recipe?.ingredients.find(i => i.id === ingredientId);
    if (ingredient) {
      updateIngredient(recipeId, ingredientId, { alreadyHave: !ingredient.alreadyHave });
    }
  }, [recipes, updateIngredient]);

  const markAsCooked = useCallback((id: string) => {
    updateRecipe(id, { status: 'cooked' });
  }, [updateRecipe]);

  const getRecipeById = useCallback((id: string) => {
    return recipes.find(r => r.id === id);
  }, [recipes]);

  const value = useMemo(() => ({
    recipes,
    isLoading: recipesQuery.isLoading,
    addRecipe,
    updateRecipe,
    deleteRecipe,
    updateIngredient,
    toggleIngredientChecked,
    toggleIngredientAlreadyHave,
    markAsCooked,
    getRecipeById,
  }), [
    recipes,
    recipesQuery.isLoading,
    addRecipe,
    updateRecipe,
    deleteRecipe,
    updateIngredient,
    toggleIngredientChecked,
    toggleIngredientAlreadyHave,
    markAsCooked,
    getRecipeById,
  ]);

  return (
    <RecipeContext.Provider value={value}>
      {children}
    </RecipeContext.Provider>
  );
}

export function useRecipes(): RecipeContextValue {
  const context = useContext(RecipeContext);
  if (!context) {
    throw new Error('useRecipes must be used within a RecipeProvider');
  }
  return context;
}

export function useRecipesByCategory(category?: RecipeCategory) {
  const { recipes } = useRecipes();
  return useMemo(() => {
    if (!category) return recipes;
    return recipes.filter(r => r.category === category);
  }, [recipes, category]);
}

export function useRecipesByStatus(status: RecipeStatus) {
  const { recipes } = useRecipes();
  return useMemo(() => recipes.filter(r => r.status === status), [recipes, status]);
}

export function useGroceryList() {
  const { recipes } = useRecipes();
  return useMemo(() => {
    const savedRecipes = recipes.filter(r => r.status === 'saved');
    const allIngredients: (Ingredient & { recipeId: string; recipeTitle: string })[] = [];

    savedRecipes.forEach(recipe => {
      recipe.ingredients.forEach(ingredient => {
        allIngredients.push({
          ...ingredient,
          recipeId: recipe.id,
          recipeTitle: recipe.title,
        });
      });
    });

    return allIngredients;
  }, [recipes]);
}
