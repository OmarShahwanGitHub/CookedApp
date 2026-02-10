import { Stack } from 'expo-router';
import Colors from '@/constants/colors';

export default function LibraryLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: '600' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'My Recipes',
        }}
      />
    </Stack>
  );
}
