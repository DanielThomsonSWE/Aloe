import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import type { AddMedicationResult, TimeEntry } from './AddMedicationFlow';

const REMINDER_IDS_KEY = 'aloe:reminder-notification-ids:v1';
const ANDROID_CHANNEL_ID = 'aloe-medication-reminders';
const weekdayNumber: Record<TimeEntry['days'][number], number> = {
  Sun: 1, Mon: 2, Tue: 3, Wed: 4, Thu: 5, Fri: 6, Sat: 7,
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestReminderPermission() {
  if (Platform.OS === 'web') {
    throw new Error('Medication reminders are available in the iOS and Android app.');
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Medication reminders',
      importance: AndroidImportance.HIGH,
      sound: 'default',
    });
  }

  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Allow notifications in your device settings to use medication reminders.');
  }
}

const scheduleSegments = (schedule: string) => schedule.split(' · ').map(value => value.trim()).filter(Boolean);

export function parseReminderSchedule(schedule: string): TimeEntry[] {
  const segments = scheduleSegments(schedule);
  return segments.flatMap((segment, index) => {
    if (/^Reminder on$/i.test(segment)) return [];
    const reminder = /^Reminder on$/i.test(segments[index + 1] ?? '');
    const match = segment.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)\s*\(([^)]*)\)$/i);
    if (!match) return [];

    const weekdays: TimeEntry['days'] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const days = match[4].split(',').map(value => value.trim()).filter(
      (day): day is TimeEntry['days'][number] => weekdays.includes(day as TimeEntry['days'][number]),
    );
    if (!days.length) return [];

    return [{
      hour: match[1],
      minute: match[2],
      period: match[3].toUpperCase() as TimeEntry['period'],
      days,
      reminder,
    }];
  });
}

async function storedIds(): Promise<Record<string, string[]>> {
  const value = await AsyncStorage.getItem(REMINDER_IDS_KEY);
  return value ? JSON.parse(value) as Record<string, string[]> : {};
}

async function createScheduledIds(medicationId: string, medication: AddMedicationResult) {
  const scheduledIds: string[] = [];

  try {
    for (const time of medication.times.filter(entry => entry.reminder)) {
      const hour12 = Number(time.hour);
      const hour = (hour12 % 12) + (time.period === 'PM' ? 12 : 0);
      for (const day of time.days) {
        const identifier = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Medication reminder',
            body: `Time to take ${medication.name} (${medication.dosage}), as prescribed.`,
            sound: 'default',
            data: { medicationId },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: weekdayNumber[day],
            hour,
            minute: Number(time.minute),
            ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
          },
        });
        scheduledIds.push(identifier);
      }
    }
    return scheduledIds;
  } catch (error) {
    await Promise.all(scheduledIds.map(id => Notifications.cancelScheduledNotificationAsync(id)));
    throw error;
  }
}

export async function scheduleMedicationReminders(medicationId: string, medication: AddMedicationResult) {
  const idsByMedication = await storedIds();
  const scheduledIds = await createScheduledIds(medicationId, medication);
  idsByMedication[medicationId] = scheduledIds;
  await AsyncStorage.setItem(REMINDER_IDS_KEY, JSON.stringify(idsByMedication));
}

export async function replaceMedicationReminders(medicationId: string, medication: AddMedicationResult) {
  const idsByMedication = await storedIds();
  const oldIds = idsByMedication[medicationId] ?? [];
  const scheduledIds = await createScheduledIds(medicationId, medication);
  idsByMedication[medicationId] = scheduledIds;

  try {
    await AsyncStorage.setItem(REMINDER_IDS_KEY, JSON.stringify(idsByMedication));
  } catch (error) {
    await Promise.all(scheduledIds.map(id => Notifications.cancelScheduledNotificationAsync(id)));
    throw error;
  }

  await Promise.all(oldIds.map(id => Notifications.cancelScheduledNotificationAsync(id)));
}

export async function cancelMedicationReminders(medicationId: string) {
  const idsByMedication = await storedIds();
  const ids = idsByMedication[medicationId] ?? [];
  await Promise.all(ids.map(id => Notifications.cancelScheduledNotificationAsync(id)));
  delete idsByMedication[medicationId];
  await AsyncStorage.setItem(REMINDER_IDS_KEY, JSON.stringify(idsByMedication));
}
