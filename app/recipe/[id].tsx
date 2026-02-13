import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  Modal,
  Switch,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  ChefHat,
  Trash2,
  Calendar,
  Bell,
  Check,
  Edit3,
  ShoppingCart,
  RotateCcw,
  X,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useRecipes } from '@/context/RecipeContext';
import { getCategoryByValue, RECIPE_CATEGORIES } from '@/constants/categories';
import { Ingredient, RecipeCategory } from '@/types/recipe';
import { generateId } from '@/utils/parseRecipe';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getRecipeById, updateRecipe, deleteRecipe, markAsCooked, cookAgain } = useRecipes();

  const recipe = getRecipeById(id || '');
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [category, setCategory] = useState<RecipeCategory>('other');
  const [cookDate, setCookDate] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [showCookAgainModal, setShowCookAgainModal] = useState(false);
  const [cookAgainIngredients, setCookAgainIngredients] = useState<Ingredient[]>([]);
  const [cookAgainDate, setCookAgainDate] = useState('');
  const [cookAgainReminder, setCookAgainReminder] = useState(false);

  useEffect(() => {
    if (recipe) {
      setTitle(recipe.title);
      setIngredients(recipe.ingredients);
      setCategory(recipe.category);
      setCookDate(recipe.cookDate || '');
      setReminderEnabled(recipe.reminderEnabled);
    }
  }, [recipe]);

  if (!recipe) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>Recipe not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const categoryInfo = getCategoryByValue(recipe.category);

  const handleDelete = () => {
    Alert.alert(
      'Delete Recipe',
      'Are you sure you want to delete this recipe?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteRecipe(recipe.id);
            router.back();
          },
        },
      ]
    );
  };

  const handleMarkCooked = () => {
    markAsCooked(recipe.id);
    Alert.alert('Nice!', 'Recipe marked as cooked!');
  };

  const handleSaveChanges = () => {
    updateRecipe(recipe.id, {
      title,
      ingredients,
      category,
      cookDate: cookDate || undefined,
      reminderEnabled,
    });
    setIsEditing(false);
  };

  const handleUpdateIngredient = (ingredientId: string, field: 'name' | 'quantity', value: string) => {
    setIngredients(prev =>
      prev.map(i => (i.id === ingredientId ? { ...i, [field]: value } : i))
    );
  };

  const handleAddIngredient = () => {
    setIngredients(prev => [
      ...prev,
      { id: generateId(), name: '', quantity: '', checked: false, alreadyHave: false },
    ]);
  };

  const handleRemoveIngredient = (ingredientId: string) => {
    setIngredients(prev => prev.filter(i => i.id !== ingredientId));
  };

  const handleAddToGrocery = () => {
    router.push('/(tabs)/grocery');
  };

  const handleOpenCookAgain = () => {
    if (!recipe) return;
    setCookAgainIngredients(recipe.ingredients.map(i => ({ ...i })));
    const today = new Date().toISOString().split('T')[0];
    setCookAgainDate(today);
    setCookAgainReminder(false);
    setShowCookAgainModal(true);
  };

  const handleConfirmCookAgain = () => {
    if (!recipe) return;
    cookAgain(recipe.id, {
      ingredients: cookAgainIngredients,
      cookDate: cookAgainDate || undefined,
      reminderEnabled: cookAgainReminder && !!cookAgainDate,
    });
    setShowCookAgainModal(false);
    Alert.alert('Cook Again!', 'Grocery list has been reset for this recipe.', [
      { text: 'View Grocery List', onPress: () => router.push('/(tabs)/grocery') },
      { text: 'OK' },
    ]);
  };

  const handleCookAgainUpdateIngredient = (ingredientId: string, field: 'name' | 'quantity', value: string) => {
    setCookAgainIngredients(prev =>
      prev.map(i => (i.id === ingredientId ? { ...i, [field]: value } : i))
    );
  };

  const handleCookAgainRemoveIngredient = (ingredientId: string) => {
    setCookAgainIngredients(prev => prev.filter(i => i.id !== ingredientId));
  };

  const handleCookAgainAddIngredient = () => {
    setCookAgainIngredients(prev => [
      ...prev,
      { id: generateId(), name: '', quantity: '', checked: false, alreadyHave: false },
    ]);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <View style={styles.headerButtons}>
              {isEditing ? (
                <TouchableOpacity onPress={handleSaveChanges} style={styles.headerButton}>
                  <Check size={22} color={Colors.primary} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.headerButton}>
                  <Edit3 size={20} color={Colors.text} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleDelete} style={styles.headerButton}>
                <Trash2 size={20} color={Colors.error} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {recipe.imageUri ? (
          <Image source={{ uri: recipe.imageUri }} style={styles.heroImage} />
        ) : (
          <View style={[styles.heroPlaceholder, { backgroundColor: Colors.surfaceAlt }]}>
            <Text style={styles.heroEmoji}>{categoryInfo.emoji}</Text>
          </View>
        )}

        <View style={styles.content}>
          <View style={styles.statusRow}>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>
                {recipe.status === 'cooked' ? '✓ Cooked' : 'Saved'}
              </Text>
            </View>
            {!isEditing && recipe.status === 'cooked' && (
              <TouchableOpacity
                style={styles.cookAgainTopButton}
                onPress={handleOpenCookAgain}
              >
                <RotateCcw size={16} color={Colors.white} />
                <Text style={styles.cookAgainTopButtonText}>Cook Again</Text>
              </TouchableOpacity>
            )}
          </View>

          {isEditing ? (
            <TextInput
              style={styles.titleInput}
              value={title}
              onChangeText={setTitle}
              placeholder="Recipe title"
            />
          ) : (
            <Text style={styles.title}>{recipe.title}</Text>
          )}

          {isEditing ? (
            <View style={styles.categoryEdit}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {RECIPE_CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat.value}
                    style={[
                      styles.categoryChip,
                      category === cat.value && styles.categoryChipActive,
                    ]}
                    onPress={() => setCategory(cat.value)}
                  >
                    <Text>{cat.emoji}</Text>
                    <Text
                      style={[
                        styles.categoryChipText,
                        category === cat.value && styles.categoryChipTextActive,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : (
            <View style={styles.metaRow}>
              <Text style={styles.category}>
                {categoryInfo.emoji} {categoryInfo.label}
              </Text>
              {recipe.cookDate && (
                <View style={styles.dateContainer}>
                  <Calendar size={14} color={Colors.textSecondary} />
                  <Text style={styles.dateText}>
                    {new Date(recipe.cookDate + 'T00:00:00').toLocaleDateString()}
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Ingredients</Text>
              {isEditing && (
                <TouchableOpacity onPress={handleAddIngredient}>
                  <Text style={styles.addText}>+ Add</Text>
                </TouchableOpacity>
              )}
            </View>
            {(isEditing ? ingredients : recipe.ingredients).map((ingredient) => (
              <View key={ingredient.id} style={styles.ingredientItem}>
                {isEditing ? (
                  <>
                    <View style={styles.ingredientCard}>
                      <TextInput
                        style={styles.ingredientCardQty}
                        value={ingredient.quantity}
                        onChangeText={(v) => handleUpdateIngredient(ingredient.id, 'quantity', v)}
                        placeholder="Qty"
                        placeholderTextColor={Colors.textLight}
                        multiline
                        textAlignVertical="top"
                      />
                      <TextInput
                        style={styles.ingredientCardName}
                        value={ingredient.name}
                        onChangeText={(v) => handleUpdateIngredient(ingredient.id, 'name', v)}
                        placeholder="Ingredient"
                        placeholderTextColor={Colors.textLight}
                        multiline
                        textAlignVertical="top"
                      />
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRemoveIngredient(ingredient.id)}
                      style={styles.ingredientDeleteBtn}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                      <Trash2 size={18} color={Colors.textLight} />
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <View style={styles.bulletPoint} />
                    <Text style={styles.ingredientText}>
                      {ingredient.quantity ? `${ingredient.quantity} ` : ''}
                      {ingredient.name}
                    </Text>
                  </>
                )}
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Instructions</Text>
            {recipe.steps.map((step, index) => (
              <View key={step.id} style={styles.stepItem}>
                <View style={styles.stepNumberCircle}>
                  <Text style={styles.stepNumber}>{index + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step.instruction}</Text>
              </View>
            ))}
          </View>

          {isEditing && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Schedule</Text>
              <TextInput
                style={styles.dateInput}
                value={cookDate}
                onChangeText={setCookDate}
                placeholder="YYYY-MM-DD"
              />
              <TouchableOpacity
                style={styles.reminderRow}
                onPress={() => setReminderEnabled(!reminderEnabled)}
              >
                <Bell size={18} color={reminderEnabled ? Colors.primary : Colors.textLight} />
                <Text style={styles.reminderLabel}>Reminder</Text>
                <View style={[styles.toggle, reminderEnabled && styles.toggleActive]}>
                  <View style={[styles.toggleThumb, reminderEnabled && styles.toggleThumbActive]} />
                </View>
              </TouchableOpacity>
            </View>
          )}

          {!isEditing && recipe.status === 'saved' && (
            <View style={styles.actionsSection}>
              <TouchableOpacity style={styles.actionButton} onPress={handleAddToGrocery}>
                <ShoppingCart size={20} color={Colors.primary} />
                <Text style={styles.actionButtonText}>View Grocery List</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, styles.cookButton]}
                onPress={handleMarkCooked}
              >
                <ChefHat size={20} color={Colors.white} />
                <Text style={[styles.actionButtonText, styles.cookButtonText]}>
                  Mark as Cooked
                </Text>
              </TouchableOpacity>
            </View>
          )}

        </View>
      </ScrollView>

      <Modal
        visible={showCookAgainModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCookAgainModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCookAgainModal(false)}>
              <X size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Cook Again</Text>
            <TouchableOpacity onPress={handleConfirmCookAgain}>
              <Text style={styles.modalConfirmText}>Confirm</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <Text style={styles.modalSectionTitle}>Schedule (optional)</Text>
            <TextInput
              style={styles.modalDateInput}
              value={cookAgainDate}
              onChangeText={setCookAgainDate}
              placeholder="YYYY-MM-DD (leave empty to skip)"
              placeholderTextColor={Colors.textLight}
            />

            <View style={styles.reminderToggleRow}>
              <View>
                <Text style={styles.reminderToggleLabel}>Remind me</Text>
                <Text style={styles.reminderToggleHint}>
                  {cookAgainDate ? 'Get a notification on cook day' : 'Set a date above to enable'}
                </Text>
              </View>
              <Switch
                value={cookAgainReminder}
                onValueChange={setCookAgainReminder}
                disabled={!cookAgainDate}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>

            <View style={styles.modalSectionHeader}>
              <Text style={styles.modalSectionTitle}>Ingredients</Text>
              <TouchableOpacity onPress={handleCookAgainAddIngredient}>
                <Text style={styles.addText}>+ Add</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalHint}>Edit or remove ingredients before adding to grocery list</Text>

            {cookAgainIngredients.map(ingredient => (
              <View key={ingredient.id} style={styles.modalIngredientRow}>
                <View style={styles.modalIngredientCard}>
                  <TextInput
                    style={styles.modalIngredientCardQty}
                    value={ingredient.quantity}
                    onChangeText={(v) => handleCookAgainUpdateIngredient(ingredient.id, 'quantity', v)}
                    placeholder="Qty"
                    placeholderTextColor={Colors.textLight}
                    multiline
                    textAlignVertical="top"
                  />
                  <TextInput
                    style={styles.modalIngredientCardName}
                    value={ingredient.name}
                    onChangeText={(v) => handleCookAgainUpdateIngredient(ingredient.id, 'name', v)}
                    placeholder="Ingredient"
                    placeholderTextColor={Colors.textLight}
                    multiline
                    textAlignVertical="top"
                  />
                </View>
                <TouchableOpacity
                  onPress={() => handleCookAgainRemoveIngredient(ingredient.id)}
                  style={styles.modalIngredientDeleteBtn}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Trash2 size={18} color={Colors.textLight} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  notFoundText: {
    fontSize: 18,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  backLink: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    padding: 6,
  },
  scrollView: {
    flex: 1,
  },
  heroImage: {
    width: '100%',
    height: 240,
  },
  heroPlaceholder: {
    width: '100%',
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmoji: {
    fontSize: 72,
  },
  content: {
    padding: 20,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  title: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
    lineHeight: 32,
  },
  titleInput: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
    padding: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 16,
  },
  category: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  categoryEdit: {
    marginBottom: 20,
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
  categoryChipText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  categoryChipTextActive: {
    color: Colors.white,
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  addText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 12,
  },
  bulletPoint: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  ingredientText: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  },
  ingredientCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  ingredientCardQty: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
    paddingVertical: 4,
    minWidth: 56,
    maxWidth: 120,
    minHeight: 24,
  },
  ingredientCardName: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
    paddingVertical: 4,
    minHeight: 24,
  },
  ingredientDeleteBtn: {
    padding: 8,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 14,
  },
  stepNumberCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    lineHeight: 24,
  },
  dateInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reminderLabel: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  toggle: {
    width: 46,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.border,
    padding: 2,
  },
  toggleActive: {
    backgroundColor: Colors.primary,
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.white,
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  actionsSection: {
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  cookButton: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  cookButtonText: {
    color: Colors.white,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cookAgainTopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  cookAgainTopButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  reminderToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reminderToggleLabel: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  reminderToggleHint: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 2,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  modalBody: {
    flex: 1,
    padding: 20,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 10,
  },
  modalSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 10,
  },
  modalHint: {
    fontSize: 13,
    color: Colors.textLight,
    marginBottom: 16,
  },
  modalDateInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
  },
  modalIngredientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 10,
  },
  modalIngredientCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  modalIngredientCardQty: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
    paddingVertical: 4,
    minWidth: 56,
    maxWidth: 120,
    minHeight: 24,
  },
  modalIngredientCardName: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
    paddingVertical: 4,
    minHeight: 24,
  },
  modalIngredientDeleteBtn: {
    padding: 8,
  },
});
