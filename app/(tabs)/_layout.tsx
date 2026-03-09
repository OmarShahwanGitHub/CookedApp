import React, { useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, ShoppingCart, BookOpen } from 'lucide-react-native';
import Colors from '@/constants/colors';
import HomeScreen from './(home)/index';
import GroceryScreen from './grocery/index';
import LibraryScreen from './library/index';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_BAR_HEIGHT = 56;

const tabs = [
  { key: 'home', title: 'Home', Icon: Home },
  { key: 'grocery', title: 'Grocery', Icon: ShoppingCart },
  { key: 'library', title: 'Library', Icon: BookOpen },
] as const;

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const goTo = useCallback((i: number) => {
    setIndex(i);
    scrollRef.current?.scrollTo({ x: i * SCREEN_WIDTH, animated: true });
  }, []);

  const onMomentumScrollEnd = useCallback((e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setIndex(i);
  }, []);

  const tabBarBottomPadding = insets.bottom;

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        directionalLockEnabled
        onMomentumScrollEnd={onMomentumScrollEnd}
        bounces={false}
        style={styles.pager}
      >
        <View style={[styles.page, { width: SCREEN_WIDTH }]}>
          <HomeScreen />
        </View>
        <View style={[styles.page, { width: SCREEN_WIDTH }]}>
          <GroceryScreen />
        </View>
        <View style={[styles.page, { width: SCREEN_WIDTH }]}>
          <LibraryScreen />
        </View>
      </ScrollView>

      <View style={[styles.tabBar, { paddingBottom: tabBarBottomPadding }]}>
        {tabs.map((tab, i) => {
          const active = index === i;
          const color = active ? Colors.primary : Colors.textLight;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tab}
              onPress={() => goTo(i)}
              activeOpacity={0.7}
            >
              <tab.Icon size={24} color={color} />
              <Text style={[styles.tabLabel, { color }]}>{tab.title}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    height: TAB_BAR_HEIGHT,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
});
