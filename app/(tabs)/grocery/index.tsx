import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Check, Package, ShoppingCart } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useRecipes, useGroceryList } from '@/context/RecipeContext';
import EmptyState from '@/components/EmptyState';

export default function GroceryScreen() {
  const groceryList = useGroceryList();
  const { toggleIngredientChecked, toggleIngredientAlreadyHave } = useRecipes();
  const [showAlreadyHave, setShowAlreadyHave] = useState(false);

  const groupedByRecipe = useMemo(() => {
    const groups: Record<string, typeof groceryList> = {};
    groceryList.forEach(item => {
      if (!groups[item.recipeId]) {
        groups[item.recipeId] = [];
      }
      groups[item.recipeId].push(item);
    });
    return groups;
  }, [groceryList]);

  const needToBuy = groceryList.filter(i => !i.checked && !i.alreadyHave);
  const alreadyHaveItems = groceryList.filter(i => i.alreadyHave);
  const checkedItems = groceryList.filter(i => i.checked && !i.alreadyHave);

  if (groceryList.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon={<ShoppingCart size={64} color={Colors.textLight} />}
          title="Your grocery list is empty"
          message="Save recipes to automatically add ingredients to your shopping list."
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>{needToBuy.length}</Text>
          <Text style={styles.summaryLabel}>To buy</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>{alreadyHaveItems.length}</Text>
          <Text style={styles.summaryLabel}>Already have</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>{checkedItems.length}</Text>
          <Text style={styles.summaryLabel}>Done</Text>
        </View>
      </View>

      {Object.entries(groupedByRecipe).map(([recipeId, items]) => {
        const recipeTitle = items[0]?.recipeTitle || 'Unknown Recipe';
        const activeItems = items.filter(i => !i.alreadyHave);
        
        return (
          <View key={recipeId} style={styles.recipeGroup}>
            <Text style={styles.recipeTitle}>{recipeTitle}</Text>
            {activeItems.map(item => (
              <View key={item.id} style={styles.ingredientRow}>
                <TouchableOpacity
                  style={[styles.checkbox, item.checked && styles.checkboxChecked]}
                  onPress={() => toggleIngredientChecked(recipeId, item.id)}
                  testID={`checkbox-${item.id}`}
                >
                  {item.checked && <Check size={14} color={Colors.white} />}
                </TouchableOpacity>
                
                <View style={styles.ingredientInfo}>
                  <Text style={[styles.ingredientName, item.checked && styles.ingredientChecked]}>
                    {item.quantity ? `${item.quantity} ` : ''}{item.name}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.alreadyHaveButton, item.alreadyHave && styles.alreadyHaveActive]}
                  onPress={() => toggleIngredientAlreadyHave(recipeId, item.id)}
                  testID={`already-have-${item.id}`}
                >
                  <Package size={16} color={item.alreadyHave ? Colors.white : Colors.textLight} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        );
      })}

      {alreadyHaveItems.length > 0 && (
        <TouchableOpacity
          style={styles.alreadyHaveSection}
          onPress={() => setShowAlreadyHave(!showAlreadyHave)}
        >
          <Text style={styles.alreadyHaveSectionTitle}>
            Already have ({alreadyHaveItems.length})
          </Text>
          <Text style={styles.toggleText}>{showAlreadyHave ? 'Hide' : 'Show'}</Text>
        </TouchableOpacity>
      )}

      {showAlreadyHave && alreadyHaveItems.map(item => (
        <View key={item.id} style={[styles.ingredientRow, styles.alreadyHaveRow]}>
          <Package size={16} color={Colors.success} />
          <Text style={styles.alreadyHaveText}>
            {item.quantity ? `${item.quantity} ` : ''}{item.name}
          </Text>
          <TouchableOpacity
            onPress={() => toggleIngredientAlreadyHave(item.recipeId, item.id)}
          >
            <Text style={styles.undoText}>Undo</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  summary: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  recipeGroup: {
    marginBottom: 20,
  },
  recipeTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    fontSize: 15,
    color: Colors.text,
  },
  ingredientChecked: {
    textDecorationLine: 'line-through',
    color: Colors.textLight,
  },
  alreadyHaveButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alreadyHaveActive: {
    backgroundColor: Colors.success,
  },
  alreadyHaveSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 8,
  },
  alreadyHaveSectionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  toggleText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  alreadyHaveRow: {
    backgroundColor: Colors.surfaceAlt,
    gap: 12,
  },
  alreadyHaveText: {
    flex: 1,
    fontSize: 15,
    color: Colors.textSecondary,
  },
  undoText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
});
