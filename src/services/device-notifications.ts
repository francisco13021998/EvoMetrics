import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { clientPaymentsService } from '@/services/client-payments';
import { clientsService } from '@/services/clients';
import { eventsService } from '@/services/events';
import { revisionsService } from '@/services/revisions';
import { buildDashboardNotifications, DashboardNotificationItem } from '@/utils/client-notifications';
import { buildEventNotifications, EventNotificationItem } from '@/utils/event-notifications';

const NOTIFICATION_CHANNEL_ID = 'evometrics-reminders';
const REMINDER_HOUR = 23;
const REMINDER_MINUTE = 59;
const REMINDER_REPEAT_DAYS = 2;
// 14 días (antes 90): con repetición cada 2 días y varios items, 90 días superaba de largo
// el límite de 64 notificaciones pendientes de iOS.
const REMINDER_SCHEDULE_HORIZON_DAYS = 14;
// Tope global de notificaciones programadas (iOS descarta a partir de 64).
const MAX_SCHEDULED_NOTIFICATIONS = 60;
// Los eventos avisan una única vez, un rato antes de empezar (no a las 23:59 del día del evento).
const EVENT_REMINDER_LEAD_MINUTES = 60;

type NotificationsModule = typeof import('expo-notifications');
type NotificationContentInput = import('expo-notifications').NotificationContentInput;
type ReminderNotificationItem = DashboardNotificationItem | EventNotificationItem;

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

  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
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
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
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

function addDays(value: Date, days: number) {
  const nextDate = new Date(value);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function getNotificationTriggerDate(value: Date) {
  const triggerDate = new Date(value);
  triggerDate.setHours(REMINDER_HOUR, REMINDER_MINUTE, 0, 0);
  return triggerDate;
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

  return parsedNextDate;
}

function getScheduledReminderDates(notification: ReminderNotificationItem, referenceDate: Date) {
  // Eventos: un único aviso poco antes de empezar; si ya pasó, nada.
  if (notification.kind === 'event') {
    if (!notification.nextDate) {
      return [];
    }

    const plannedStartAt = new Date(notification.nextDate);

    if (Number.isNaN(plannedStartAt.getTime())) {
      return [];
    }

    const reminderDate = new Date(plannedStartAt.getTime() - EVENT_REMINDER_LEAD_MINUTES * 60 * 1000);

    return reminderDate > referenceDate ? [reminderDate] : [];
  }

  const baseDate = getNotificationScheduleBaseDate(notification.nextDate);
  const firstReminderDate = getNotificationTriggerDate(baseDate);
  const scheduledDates: Date[] = [];
  const horizonDate = addDays(referenceDate, REMINDER_SCHEDULE_HORIZON_DAYS);

  // Items vencidos: nada de disparo inmediato en cada resync — el primer aviso es el próximo
  // 23:59 (hoy si aún no pasó, si no mañana).
  let nextReminderDate = firstReminderDate;

  if (nextReminderDate <= referenceDate) {
    const todayTrigger = getNotificationTriggerDate(referenceDate);
    nextReminderDate = todayTrigger > referenceDate ? todayTrigger : getNotificationTriggerDate(addDays(referenceDate, 1));
  }

  while (nextReminderDate <= horizonDate) {
    scheduledDates.push(nextReminderDate);
    nextReminderDate = addDays(nextReminderDate, REMINDER_REPEAT_DAYS);
  }

  return scheduledDates;
}

function getNotificationContent(notification: ReminderNotificationItem): NotificationContentInput {
  const title =
    notification.kind === 'payment' ? 'Pago pendiente' : notification.kind === 'revision' ? 'Revisión pendiente' : 'Evento próximo';
  const body =
    notification.kind === 'event'
      ? `${notification.eventTitle} está próxima.`
      : notification.kind === 'payment'
        ? `${notification.clientName} tiene un pago pendiente.`
        : `${notification.clientName} tiene una revisión pendiente.`;

  return {
    title,
    body,
    sound: 'default',
    priority: 'high',
    data: {
      kind: notification.kind,
      clientId: notification.clientId,
      clientName: notification.clientName,
      eventId: notification.kind === 'event' ? notification.eventId : undefined,
      occurrenceId: notification.kind === 'event' ? notification.occurrenceId : undefined,
    },
  };
}

async function scheduleNotification(Notifications: NotificationsModule, notification: ReminderNotificationItem, triggerDate: Date) {
  const secondsUntilTrigger = Math.max(1, Math.ceil((triggerDate.getTime() - Date.now()) / 1000));

  await Notifications.scheduleNotificationAsync({
    content: getNotificationContent(notification),
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: secondsUntilTrigger,
      repeats: false,
      channelId: NOTIFICATION_CHANNEL_ID,
    },
  });
}

export async function scheduleTestDeviceNotification() {
  if (!supportsDeviceNotifications()) {
    throw new Error('Las notificaciones no están disponibles en este entorno.');
  }

  const hasPermission = await ensureDeviceNotificationsPermission();

  if (!hasPermission) {
    throw new Error('No hay permiso para mostrar notificaciones en este dispositivo.');
  }

  const Notifications = await loadNotificationsModule();

  if (!Notifications) {
    throw new Error('No se pudo cargar el módulo de notificaciones.');
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Notificación de prueba',
      body: 'Si ves este mensaje, las notificaciones funcionan en tu dispositivo.',
      sound: 'default',
      priority: 'high',
      data: {
        kind: 'test',
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 60,
      repeats: false,
      channelId: NOTIFICATION_CHANNEL_ID,
    },
  });
}

async function buildEventNotificationData(userId: string) {
  const clients = await clientsService.listByOwner(userId);
  const events = await eventsService.listByOwner(userId);

  const horizonStart = new Date();
  const horizonEnd = new Date(horizonStart);
  horizonEnd.setDate(horizonEnd.getDate() + 90);
  const occurrences = await eventsService.syncOccurrencesForOwner(userId, horizonStart, horizonEnd);

  return buildEventNotifications({ clients, events, occurrences }, horizonStart);
}

export async function syncDeviceNotificationsForUser(userId: string) {
  if (!supportsDeviceNotifications()) {
    return false;
  }

  const clients = await clientsService.listByOwner(userId);
  const clientIds = clients.map((client) => client.id);

  const [paymentsByClientId, revisionsByClientId] = await Promise.all([
    clientPaymentsService.listByClients(clientIds),
    revisionsService.listByClients(clientIds),
  ]);

  const nextClientData = clients.map((client) => ({
    client,
    payments: paymentsByClientId[client.id] ?? [],
    revisions: revisionsByClientId[client.id] ?? [],
  }));

  const eventNotifications = await buildEventNotificationData(userId);

  const hasPermission = await ensureDeviceNotificationsPermission();

  if (!hasPermission) {
    return false;
  }

  const Notifications = await loadNotificationsModule();

  if (!Notifications) {
    return false;
  }

  await Notifications.cancelAllScheduledNotificationsAsync();

  const referenceDate = new Date();
  const notifications = [...buildDashboardNotifications(nextClientData), ...eventNotifications];

  // Se programan como máximo las MAX_SCHEDULED_NOTIFICATIONS más próximas en el tiempo.
  const pendingTriggers = notifications
    .flatMap((notification) =>
      getScheduledReminderDates(notification, referenceDate).map((triggerDate) => ({ notification, triggerDate }))
    )
    .sort((left, right) => left.triggerDate.getTime() - right.triggerDate.getTime())
    .slice(0, MAX_SCHEDULED_NOTIFICATIONS);

  for (const { notification, triggerDate } of pendingTriggers) {
    await scheduleNotification(Notifications, notification, triggerDate);
  }

  return true;
}