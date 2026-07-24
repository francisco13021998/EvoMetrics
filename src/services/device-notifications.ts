import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { clientPaymentsService } from '@/services/client-payments';
import { clientsService } from '@/services/clients';
import { revisionsService } from '@/services/revisions';
import { ClientDashboardData, DashboardNotificationItem, buildDashboardNotifications } from '@/utils/client-notifications';

const NOTIFICATION_CHANNEL_ID = 'evometrics-reminders';
const REMINDER_HOUR = 23;
const REMINDER_MINUTE = 59;

type NotificationsModule = typeof import('expo-notifications');
type NotificationContentInput = import('expo-notifications').NotificationContentInput;

type ExpoRuntimeInfo = {
  appOwnership?: string;
  executionEnvironment?: string;
};

function isExpoGoRuntime() {
  const runtimeInfo = Constants as unknown as ExpoRuntimeInfo;

  return runtimeInfo.appOwnership === 'expo' || runtimeInfo.executionEnvironment === 'storeClient';
}

export function supportsDeviceNotifications() {
  return !isExpoGoRuntime();
}

async function loadNotificationsModule(): Promise<NotificationsModule | null> {
  if (!supportsDeviceNotifications()) {
    return null;
  }

  return import('expo-notifications');
}

let isHandlerConfigured = false;

async function configureNotificationHandler() {
  if (isHandlerConfigured) {
    return null;
  }

  const Notifications = await loadNotificationsModule();

  if (!Notifications) {
    return null;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  isHandlerConfigured = true;

  return Notifications;
}

async function ensureAndroidChannel() {
  const Notifications = await loadNotificationsModule();

  if (!Notifications) {
    return;
  }

  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
    name: 'Recordatorios EvoMetrics',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

export async function ensureDeviceNotificationsPermission() {
  if (!supportsDeviceNotifications()) {
    return false;
  }

  await configureNotificationHandler();
  await ensureAndroidChannel();

  const Notifications = await loadNotificationsModule();

  if (!Notifications) {
    return false;
  }

  const currentPermission = await Notifications.getPermissionsAsync();

  if (currentPermission.status === 'granted') {
    return true;
  }

  const requestedPermission = await Notifications.requestPermissionsAsync();
  return requestedPermission.status === 'granted';
}

function getWeeklyTriggerFromDate(value: Date) {
  const triggerDate = new Date(value);
  const weekday = triggerDate.getDay() === 0 ? 1 : triggerDate.getDay() + 1;

  triggerDate.setHours(REMINDER_HOUR, REMINDER_MINUTE, 0, 0);

  return {
    weekday,
    hour: triggerDate.getHours(),
    minute: triggerDate.getMinutes(),
    repeats: true,
  };
}

function getNotificationScheduleBaseDate(nextDate: string | null) {
  const now = new Date();

  if (!nextDate) {
    return now;
  }

  const parsedNextDate = new Date(nextDate);

  if (Number.isNaN(parsedNextDate.getTime())) {
    return now;
  }

  return parsedNextDate > now ? parsedNextDate : now;
}

function getNotificationContent(notification: DashboardNotificationItem): NotificationContentInput {
  const isPayment = notification.kind === 'payment';

  return {
    title: isPayment ? 'Pago pendiente' : 'Revisión pendiente',
    body: isPayment
      ? `${notification.clientName} tiene un pago pendiente.`
      : `${notification.clientName} tiene una revisión pendiente.`,
    sound: 'default',
    data: {
      kind: notification.kind,
      clientId: notification.clientId,
      clientName: notification.clientName,
    },
  };
}

async function scheduleNotification(notification: DashboardNotificationItem) {
  const Notifications = await loadNotificationsModule();

  if (!Notifications) {
    return;
  }

  const baseDate = getNotificationScheduleBaseDate(notification.nextDate);

  await Notifications.scheduleNotificationAsync({
    content: getNotificationContent(notification),
    trigger: getWeeklyTriggerFromDate(baseDate),
  });
}

export async function syncDeviceNotifications(clientData: ClientDashboardData[]) {
  if (!supportsDeviceNotifications()) {
    return false;
  }

  const hasPermission = await ensureDeviceNotificationsPermission();

  if (!hasPermission) {
    return false;
  }

  const Notifications = await loadNotificationsModule();

  if (!Notifications) {
    return false;
  }

  await Notifications.cancelAllScheduledNotificationsAsync();

  const notifications = buildDashboardNotifications(clientData);

  for (const notification of notifications) {
    await scheduleNotification(notification);
  }

  return true;
}

export async function syncDeviceNotificationsForUser(userId: string) {
  if (!supportsDeviceNotifications()) {
    return false;
  }

  const clients = await clientsService.listByOwner(userId);

  const nextClientData = await Promise.all(
    clients.map(async (client) => ({
      client,
      payments: await clientPaymentsService.listByClient(client.id),
      revisions: await revisionsService.listByClient(client.id),
    }))
  );

  return syncDeviceNotifications(nextClientData);
}