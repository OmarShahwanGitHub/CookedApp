import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { BookOpen, ChefHat, Filter } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useRecipes } from '@/context/RecipeContext';
import { RecipeCategory, RecipeStatus } from '@/types/recipe';
import { RECIPE_CATEGORIES, getCategoryByValue } from '@/constants/categories';
import RecipeCard from '@/components/RecipeCard';
import EmptyState from '@/components/EmptyState';

type FilterType = 'all' | RecipeStatus;

export default function LibraryScreen() {
  const router = useRouter();
  const { recipes } = useRecipes();
  const [statusFilter, setStatusFilter] = useState<FilterType>('all');
  const [categoryFilter, setCategoryFilter] = useState<RecipeCategory | 'all'>('all');

  const filteredRecipes = useMemo(() => {
    return recipes.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
      return true;
    }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [recipes, statusFilter, categoryFilter]);

  const handleRecipePress = (id: string) => {
    router.push(`/recipe/${id}`);
  };

  const statusFilters: { value: FilterType; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'saved', label: 'Saved' },
    { value: 'cooked', label: 'Cooked' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.filtersContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statusFilters}
        >
          {statusFilters.map(filter => (
            <TouchableOpacity
              key={filter.value}
              style={[
                styles.statusChip,
                statusFilter === filter.value && styles.statusChipActive,
              ]}
              onPress={() => setStatusFilter(filter.value)}
            >
              <Text
                style={[
                  styles.statusChipText,
                  statusFilter === filter.value && styles.statusChipTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryFilters}
        >
          <TouchableOpacity
            style={[
              styles.categoryChip,
              categoryFilter === 'all' && styles.categoryChipActive,
            ]}
            onPress={() => setCategoryFilter('all')}
          >
            <Text style={styles.categoryEmoji}>📚</Text>
            <Text
              style={[
                styles.categoryChipText,
                categoryFilter === 'all' && styles.categoryChipTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>
          {RECIPE_CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.value}
              style={[
                styles.categoryChip,
                categoryFilter === cat.value && styles.categoryChipActive,
              ]}
              onPress={() => setCategoryFilter(cat.value)}
            >
              <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
              <Text
                style={[
                  styles.categoryChipText,
                  categoryFilter === cat.value && styles.categoryChipTextActive,
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {filteredRecipes.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={64} color={Colors.textLight} />}
          title="No recipes found"
          message={recipes.length === 0 
            ? "Add your first recipe to start building your collection."
            : "Try adjusting your filters to see more recipes."
          }
        />
      ) : (
        <FlatList
          data={filteredRecipes}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              <RecipeCard
                recipe={item}
                onPress={() => handleRecipePress(item.id)}
              />
            </View>
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  filtersContainer: {
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  statusFilters: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  statusChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surfaceAlt,
    marginRight: 8,
  },
  statusChipActive: {
    backgroundColor: Colors.secondary,
  },
  statusChipText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  statusChipTextActive: {
    color: Colors.white,
  },
  categoryFilters: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
    gap: 6,
  },
  categoryChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryEmoji: {
    fontSize: 14,
  },
  categoryChipText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  categoryChipTextActive: {
    color: Colors.white,
  },
  listContent: {
    padding: 14,
  },
  row: {
    justifyContent: 'space-between',
  },
  cardWrapper: {
    width: '48%',
    marginBottom: 14,
  },
});
