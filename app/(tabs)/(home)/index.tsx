import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Plus, ChefHat, Clock, BookOpen, Info } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useRecipes, useRecipesByStatus } from '@/context/RecipeContext';
import { canAddRecipe, checkSubscriptionStatus, getPromoCodesAvailable } from '@/services/subscriptionService';
import RecipeCard from '@/components/RecipeCard';
import EmptyState from '@/components/EmptyState';
import PaywallScreen from '@/components/PaywallScreen';

export default function HomeScreen() {
  const router = useRouter();
  const { recipes, isLoading } = useRecipes();
  const savedRecipes = useRecipesByStatus('saved');
  const [showPaywall, setShowPaywall] = useState(false);
  const [freePlanCount, setFreePlanCount] = useState<{ current: number; limit: number } | null>(null);

  const refreshFreePlanCount = useCallback(() => {
    checkSubscriptionStatus().then((status) => {
      if (!status.isSubscribed)
        setFreePlanCount({ current: status.currentCount, limit: status.limit });
      else setFreePlanCount(null);
    });
  }, []);

  useEffect(() => {
    refreshFreePlanCount();
  }, [recipes.length, refreshFreePlanCount]);

  useEffect(() => {
    refreshPromoAvailability();
  }, [refreshPromoAvailability]);

  useFocusEffect(
    useCallback(() => {
      refreshFreePlanCount();
      refreshPromoAvailability();
    }, [refreshFreePlanCount, refreshPromoAvailability])
  );
  const recentRecipes = [...recipes].sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  ).slice(0, 4);

  const upcomingRecipes = savedRecipes.filter(r => r.cookDate).sort((a, b) => 
    new Date(a.cookDate! + 'T00:00:00').getTime() - new Date(b.cookDate! + 'T00:00:00').getTime()
  ).slice(0, 3);

  const handleAddRecipe = async () => {
    const allowed = await canAddRecipe();
    if (!allowed) {
      setShowPaywall(true);
      return;
    }
    router.push('/add-recipe');
  };

  const handleRecipePress = (id: string) => {
    router.push(`/recipe/${id}`);
  };

  const showLimitInfo = () => {
    Alert.alert(
      'Free recipe limit',
      'You can add up to 10 recipes on the free plan. This count is based on how many recipes you\'ve ever created. Upgrade to Pro for unlimited recipes!',
      [{ text: 'OK' }]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading your recipes...</Text>
      </View>
    );
  }

  if (showPaywall) {
    return (
      <PaywallScreen
        onDismiss={() => setShowPaywall(false)}
        onSubscribed={() => {
          setShowPaywall(false);
          router.push('/add-recipe');
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      {freePlanCount != null && (
        <View style={[styles.countBadge, styles.countBadgeAttached]}>
          <Text style={styles.countBadgeText}>
            {freePlanCount.current}/{freePlanCount.limit} recipes used
          </Text>
          <TouchableOpacity
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={showLimitInfo}
            style={styles.countBadgeInfo}
          >
            <Info size={14} color={Colors.textSecondary} />
          </TouchableOpacity>
          {promoOffered && (
            <TouchableOpacity onPress={() => router.push('/redeem-code')} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
              <Text style={styles.redeemLink}>Promo</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, freePlanCount != null && { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddRecipe}
          activeOpacity={0.8}
          testID="add-recipe-button"
        >
          <View style={styles.addButtonIcon}>
            <Plus size={28} color={Colors.white} strokeWidth={2.5} />
          </View>
          <View style={styles.addButtonText}>
            <Text style={styles.addButtonTitle}>Add Recipe</Text>
            <Text style={styles.addButtonSubtitle}>
              Paste text, link, or upload images
            </Text>
          </View>
        </TouchableOpacity>

        {recipes.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={64} color={Colors.textLight} />}
            title="No recipes yet"
            message="Add your first recipe to get started. Paste from anywhere or upload a photo!"
          />
        ) : (
          <>
            {upcomingRecipes.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Clock size={18} color={Colors.primary} />
                  <Text style={styles.sectionTitle}>Upcoming</Text>
                </View>
                {upcomingRecipes.map(recipe => (
                  <TouchableOpacity
                    key={recipe.id}
                    style={styles.upcomingItem}
                    onPress={() => handleRecipePress(recipe.id)}
                  >
                    <Text style={styles.upcomingDate}>
                      {new Date(recipe.cookDate! + 'T00:00:00').toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                    <Text style={styles.upcomingTitle} numberOfLines={1}>
                      {recipe.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <ChefHat size={18} color={Colors.primary} />
                <Text style={styles.sectionTitle}>Recent Recipes</Text>
              </View>
              <View style={styles.recipeGrid}>
                {recentRecipes.map(recipe => (
                  <View key={recipe.id} style={styles.recipeCardWrapper}>
                    <RecipeCard
                      recipe={recipe}
                      onPress={() => handleRecipePress(recipe.id)}
                    />
                  </View>
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  countBadge: {
    position: 'absolute',
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  redeemLink: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  countBadgeAttached: {
    bottom: 6,
    left: 4,
  },
  countBadgeText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  countBadgeInfo: {
    padding: 2,
  },
  addButton: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  addButtonIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  addButtonText: {
    flex: 1,
  },
  addButtonTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.white,
    marginBottom: 4,
  },
  addButtonSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  upcomingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  upcomingDate: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
    width: 100,
  },
  upcomingTitle: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  recipeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  recipeCardWrapper: {
    width: '50%',
    padding: 6,
  },
});
