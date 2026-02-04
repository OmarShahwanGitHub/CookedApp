import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { X, Type, Link2, Image as ImageIcon, ChevronRight, Trash2 } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import Colors from '@/constants/colors';
import { useRecipes } from '@/context/RecipeContext';
import { RecipeSource, ParsedRecipeData, Ingredient, RecipeStep, RecipeCategory } from '@/types/recipe';
import {
  parseRecipeFromText,
  parseRecipeFromLink,
  parseRecipeFromImages,
  generateId,
} from '@/utils/parseRecipe';
import { RECIPE_CATEGORIES } from '@/constants/categories';

type InputMode = 'select' | 'text' | 'link' | 'image';

export default function AddRecipeScreen() {
  const router = useRouter();
  const { addRecipe } = useRecipes();
  
  const [mode, setMode] = useState<InputMode>('select');
  const [textInput, setTextInput] = useState('');
  const [linkInput, setLinkInput] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [parsedData, setParsedData] = useState<ParsedRecipeData | null>(null);
  const [title, setTitle] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [steps, setSteps] = useState<RecipeStep[]>([]);
  const [category, setCategory] = useState<RecipeCategory>('other');
  const [cookDate, setCookDate] = useState<string>('');
  const [reminderEnabled, setReminderEnabled] = useState(false);

  const handleClose = () => {
    router.back();
  };

  const handleSelectMode = (newMode: InputMode) => {
    setMode(newMode);
  };

  const handlePickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      setSelectedImages(prev => [...prev, ...result.assets.map(a => a.uri)]);
    }
  };

  const handleRemoveImage = (uri: string) => {
    setSelectedImages(prev => prev.filter(img => img !== uri));
  };

  const handleParse = async () => {
    setIsProcessing(true);
    
    try {
      let data: ParsedRecipeData;
      
      if (mode === 'text' && textInput.trim()) {
        data = await parseRecipeFromText(textInput);
      } else if (mode === 'link' && linkInput.trim()) {
        data = await parseRecipeFromLink(linkInput);
      } else if (mode === 'image' && selectedImages.length > 0) {
        data = await parseRecipeFromImages(selectedImages);
      } else {
        Alert.alert('Missing Input', 'Please provide recipe content to parse.');
        setIsProcessing(false);
        return;
      }

      setParsedData(data);
      setTitle(data.title);
      setIngredients(
        data.ingredients.map(i => ({
          ...i,
          id: generateId(),
          checked: false,
          alreadyHave: false,
        }))
      );
      setSteps(
        data.steps.map(s => ({
          ...s,
          id: generateId(),
        }))
      );
    } catch (error) {
      console.error('Parse error:', error);
      Alert.alert('Error', 'Failed to parse recipe. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateIngredient = (id: string, field: 'name' | 'quantity', value: string) => {
    setIngredients(prev =>
      prev.map(i => (i.id === id ? { ...i, [field]: value } : i))
    );
  };

  const handleRemoveIngredient = (id: string) => {
    setIngredients(prev => prev.filter(i => i.id !== id));
  };

  const handleAddIngredient = () => {
    setIngredients(prev => [
      ...prev,
      { id: generateId(), name: '', quantity: '', checked: false, alreadyHave: false },
    ]);
  };

  const handleUpdateStep = (id: string, instruction: string) => {
    setSteps(prev =>
      prev.map(s => (s.id === id ? { ...s, instruction } : s))
    );
  };

  const handleSaveRecipe = () => {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a recipe title.');
      return;
    }

    if (ingredients.filter(i => i.name.trim()).length === 0) {
      Alert.alert('Missing Ingredients', 'Please add at least one ingredient.');
      return;
    }

    const source: RecipeSource = mode === 'text' ? 'text' : mode === 'link' ? 'link' : 'image';

    addRecipe({
      title: title.trim(),
      description: parsedData?.description,
      ingredients: ingredients.filter(i => i.name.trim()),
      steps: steps.filter(s => s.instruction.trim()),
      category,
      status: 'saved',
      source,
      sourceUrl: mode === 'link' ? linkInput : undefined,
      imageUri: selectedImages[0],
      cookDate: cookDate || undefined,
      reminderEnabled,
    });

    router.back();
  };

  const renderModeSelect = () => (
    <View style={styles.modeSelectContainer}>
      <Text style={styles.modeTitle}>How would you like to add a recipe?</Text>
      
      <TouchableOpacity
        style={styles.modeOption}
        onPress={() => handleSelectMode('text')}
        testID="mode-text"
      >
        <View style={[styles.modeIcon, { backgroundColor: '#FEF3E7' }]}>
          <Type size={24} color={Colors.primary} />
        </View>
        <View style={styles.modeContent}>
          <Text style={styles.modeOptionTitle}>Paste Text</Text>
          <Text style={styles.modeOptionDesc}>Copy and paste recipe text</Text>
        </View>
        <ChevronRight size={20} color={Colors.textLight} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.modeOption}
        onPress={() => handleSelectMode('link')}
        testID="mode-link"
      >
        <View style={[styles.modeIcon, { backgroundColor: '#E8F4F0' }]}>
          <Link2 size={24} color={Colors.accent} />
        </View>
        <View style={styles.modeContent}>
          <Text style={styles.modeOptionTitle}>Paste Link</Text>
          <Text style={styles.modeOptionDesc}>Import from a recipe URL</Text>
        </View>
        <ChevronRight size={20} color={Colors.textLight} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.modeOption}
        onPress={() => handleSelectMode('image')}
        testID="mode-image"
      >
        <View style={[styles.modeIcon, { backgroundColor: '#F0E8F4' }]}>
          <ImageIcon size={24} color={Colors.secondary} />
        </View>
        <View style={styles.modeContent}>
          <Text style={styles.modeOptionTitle}>Upload Images</Text>
          <Text style={styles.modeOptionDesc}>Take or select recipe photos</Text>
        </View>
        <ChevronRight size={20} color={Colors.textLight} />
      </TouchableOpacity>
    </View>
  );

  const renderTextInput = () => (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>Paste your recipe text</Text>
      <TextInput
        style={styles.textArea}
        multiline
        placeholder="Paste recipe ingredients and instructions here..."
        placeholderTextColor={Colors.textLight}
        value={textInput}
        onChangeText={setTextInput}
        textAlignVertical="top"
        testID="text-input"
      />
      <TouchableOpacity
        style={[styles.parseButton, !textInput.trim() && styles.parseButtonDisabled]}
        onPress={handleParse}
        disabled={!textInput.trim() || isProcessing}
      >
        {isProcessing ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.parseButtonText}>Parse Recipe</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderLinkInput = () => (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>Paste recipe URL</Text>
      <TextInput
        style={styles.linkInput}
        placeholder="https://example.com/recipe"
        placeholderTextColor={Colors.textLight}
        value={linkInput}
        onChangeText={setLinkInput}
        autoCapitalize="none"
        keyboardType="url"
        testID="link-input"
      />
      <TouchableOpacity
        style={[styles.parseButton, !linkInput.trim() && styles.parseButtonDisabled]}
        onPress={handleParse}
        disabled={!linkInput.trim() || isProcessing}
      >
        {isProcessing ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.parseButtonText}>Import Recipe</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderImageInput = () => (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>Upload recipe images</Text>
      
      <TouchableOpacity style={styles.imagePickerButton} onPress={handlePickImages}>
        <ImageIcon size={24} color={Colors.primary} />
        <Text style={styles.imagePickerText}>Select Images</Text>
      </TouchableOpacity>

      {selectedImages.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagePreviewScroll}>
          {selectedImages.map((uri, index) => (
            <View key={index} style={styles.imagePreviewContainer}>
              <Image source={{ uri }} style={styles.imagePreview} />
              <TouchableOpacity
                style={styles.removeImageButton}
                onPress={() => handleRemoveImage(uri)}
              >
                <X size={14} color={Colors.white} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      <TouchableOpacity
        style={[styles.parseButton, selectedImages.length === 0 && styles.parseButtonDisabled]}
        onPress={handleParse}
        disabled={selectedImages.length === 0 || isProcessing}
      >
        {isProcessing ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.parseButtonText}>Parse Images</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderParsedRecipe = () => (
    <ScrollView style={styles.parsedContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recipe Title</Text>
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={setTitle}
          placeholder="Recipe name"
          placeholderTextColor={Colors.textLight}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Category</Text>
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
              <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
              <Text
                style={[
                  styles.categoryText,
                  category === cat.value && styles.categoryTextActive,
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Ingredients</Text>
          <TouchableOpacity onPress={handleAddIngredient}>
            <Text style={styles.addText}>+ Add</Text>
          </TouchableOpacity>
        </View>
        {ingredients.map((ingredient, index) => (
          <View key={ingredient.id} style={styles.ingredientRow}>
            <TextInput
              style={styles.quantityInput}
              value={ingredient.quantity}
              onChangeText={(v) => handleUpdateIngredient(ingredient.id, 'quantity', v)}
              placeholder="Qty"
              placeholderTextColor={Colors.textLight}
            />
            <TextInput
              style={styles.ingredientInput}
              value={ingredient.name}
              onChangeText={(v) => handleUpdateIngredient(ingredient.id, 'name', v)}
              placeholder="Ingredient name"
              placeholderTextColor={Colors.textLight}
            />
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => handleRemoveIngredient(ingredient.id)}
            >
              <Trash2 size={16} color={Colors.textLight} />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Instructions</Text>
        {steps.map((step, index) => (
          <View key={step.id} style={styles.stepRow}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{index + 1}</Text>
            </View>
            <TextInput
              style={styles.stepInput}
              value={step.instruction}
              onChangeText={(v) => handleUpdateStep(step.id, v)}
              placeholder="Step instruction"
              placeholderTextColor={Colors.textLight}
              multiline
            />
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Schedule (Optional)</Text>
        <TextInput
          style={styles.dateInput}
          value={cookDate}
          onChangeText={setCookDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={Colors.textLight}
        />
        <TouchableOpacity
          style={styles.reminderToggle}
          onPress={() => setReminderEnabled(!reminderEnabled)}
        >
          <View style={[styles.toggleTrack, reminderEnabled && styles.toggleTrackActive]}>
            <View style={[styles.toggleThumb, reminderEnabled && styles.toggleThumbActive]} />
          </View>
          <Text style={styles.reminderText}>Enable reminder</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSaveRecipe}>
        <Text style={styles.saveButtonText}>Save Recipe</Text>
      </TouchableOpacity>
      
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: parsedData ? 'Edit Recipe' : 'Add Recipe',
          headerLeft: () => (
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={24} color={Colors.text} />
            </TouchableOpacity>
          ),
          headerRight: () =>
            mode !== 'select' && !parsedData ? (
              <TouchableOpacity onPress={() => setMode('select')}>
                <Text style={styles.backText}>Back</Text>
              </TouchableOpacity>
            ) : null,
        }}
      />

      {parsedData ? (
        renderParsedRecipe()
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {mode === 'select' && renderModeSelect()}
          {mode === 'text' && renderTextInput()}
          {mode === 'link' && renderLinkInput()}
          {mode === 'image' && renderImageInput()}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  closeButton: {
    padding: 4,
  },
  backText: {
    fontSize: 16,
    color: Colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  modeSelectContainer: {
    gap: 16,
  },
  modeTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  modeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  modeIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  modeContent: {
    flex: 1,
  },
  modeOptionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  modeOptionDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  inputContainer: {
    gap: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  textArea: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    minHeight: 200,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  linkInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  parseButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  parseButtonDisabled: {
    backgroundColor: Colors.border,
  },
  parseButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  imagePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    gap: 12,
  },
  imagePickerText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.primary,
  },
  imagePreviewScroll: {
    flexGrow: 0,
  },
  imagePreviewContainer: {
    marginRight: 12,
    position: 'relative',
  },
  imagePreview: {
    width: 100,
    height: 100,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 4,
  },
  parsedContainer: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  addText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  titleInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
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
    fontSize: 16,
  },
  categoryText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  categoryTextActive: {
    color: Colors.white,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  quantityInput: {
    width: 70,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ingredientInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  removeButton: {
    padding: 8,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  stepInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 48,
  },
  dateInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  reminderToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.border,
    padding: 2,
  },
  toggleTrackActive: {
    backgroundColor: Colors.primary,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.white,
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  reminderText: {
    fontSize: 15,
    color: Colors.text,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  bottomSpacer: {
    height: 40,
  },
});
