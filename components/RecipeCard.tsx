import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Clock, ChefHat } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Recipe } from '@/types/recipe';
import { getCategoryByValue } from '@/constants/categories';

interface RecipeCardProps {
  recipe: Recipe;
  onPress: () => void;
}

export default function RecipeCard({ recipe, onPress }: RecipeCardProps) {
  const category = getCategoryByValue(recipe.category);
  const isCooked = recipe.status === 'cooked';

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
      testID={`recipe-card-${recipe.id}`}
    >
      <View style={styles.imageContainer}>
        {recipe.imageUri ? (
          <Image source={{ uri: recipe.imageUri }} style={styles.image} />
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: Colors.surfaceAlt }]}>
            <Text style={styles.emoji}>{category.emoji}</Text>
          </View>
        )}
        {isCooked && (
          <View style={styles.cookedBadge}>
            <ChefHat size={12} color={Colors.white} />
          </View>
        )}
      </View>
      
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>{recipe.title}</Text>
        <View style={styles.meta}>
          <Text style={styles.category}>{category.emoji} {category.label}</Text>
          {recipe.cookDate && (
            <View style={styles.dateContainer}>
              <Clock size={12} color={Colors.textLight} />
              <Text style={styles.date}>
                {new Date(recipe.cookDate).toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.ingredients}>
          {recipe.ingredients.length} ingredients
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  imageContainer: {
    height: 140,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 48,
  },
  cookedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: Colors.success,
    borderRadius: 12,
    padding: 6,
  },
  content: {
    padding: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
    lineHeight: 22,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  category: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    gap: 4,
  },
  date: {
    fontSize: 12,
    color: Colors.textLight,
  },
  ingredients: {
    fontSize: 12,
    color: Colors.textLight,
  },
});
