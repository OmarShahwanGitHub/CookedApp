import { Platform } from 'react-native';

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    const Notifications = require('expo-notifications');
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;

    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    console.warn('Notifications not available');
    return false;
  }
}

export async function scheduleRecipeReminder(
  recipeId: string,
  recipeTitle: string,
  cookDate: string
): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    const Notifications = require('expo-notifications');
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return null;

    const triggerDate = new Date(cookDate + 'T00:00:00');
    triggerDate.setHours(9, 0, 0, 0);

    if (triggerDate.getTime() <= Date.now()) {
      return null;
    }

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Time to cook!',
        body: `Your recipe "${recipeTitle}" is scheduled for today.`,
        data: { recipeId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });

    return identifier;
  } catch (error) {
    console.warn('Failed to schedule notification:', error);
    return null;
  }
}

export async function cancelRecipeReminder(identifier: string): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const Notifications = require('expo-notifications');
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch (error) {
    console.warn('Failed to cancel notification:', error);
  }
}

export async function cancelAllReminders(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const Notifications = require('expo-notifications');
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.warn('Failed to cancel notifications:', error);
  }
}
