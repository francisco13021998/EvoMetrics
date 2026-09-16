import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { clientPaymentsService } from '@/services/client-payments';
import { clientsService } from '@/services/clients';
import { eventsService } from '@/services/events';
import { revisionsService } from '@/services/revisions';
import { ClientDashboardData, DashboardNotificationItem } from '@/utils/client-notifications';
import { calculateClientPaymentStatus } from '@/utils/client-payments';
import { calculateClientRevisionStatus } from '@/utils/client-revisions';
import { buildEventNotifications, EventNotificationItem } from '@/utils/event-notifications';

const NOTIFICATION_CHANNEL_ID = 'evometrics-reminders';
const REMINDER_HOUR = 10;
const REMINDER_MINUTE = 0;
const PAYMENT_ADVANCE_DAYS = 2;
const PAYMENT_REPEAT_DAYS = 2;
const REVISION_ADVANCE_DAYS = 3;
const REVISION_REPEAT_DAYS = 3;
const EVENT_ADVANCE_MINUTES = [60, 10] as const;
const REMINDER_SCHEDULE_HORIZON_DAYS = 90;

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

function addMinutes(value: Date, minutes: number) {
  const nextDate = new Date(value);
  nextDate.setMinutes(nextDate.getMinutes() + minutes);
  return nextDate;
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
}

function toReminderDate(value: Date | null) {
  return value ? value.toISOString() : null;
}

function getClientReminderDate(value: Date) {
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

function isSchedulableDate(value: Date, referenceDate: Date, horizonDate: Date) {
  return value > referenceDate && value <= horizonDate;
}

function buildClientScheduledReminderDates(
  notification: DashboardNotificationItem,
  referenceDate: Date,
  advanceDays: number,
  repeatDays: number
) {
  const baseDate = getNotificationScheduleBaseDate(notification.nextDate);
  const scheduledDates: Date[] = [];
  const horizonDate = addDays(referenceDate, REMINDER_SCHEDULE_HORIZON_DAYS);
  const advanceReminderDate = getClientReminderDate(addDays(baseDate, -advanceDays));
  const dueReminderDate = getClientReminderDate(baseDate);

  if (isSchedulableDate(advanceReminderDate, referenceDate, horizonDate)) {
    scheduledDates.push(advanceReminderDate);
  }

  if (isSchedulableDate(dueReminderDate, referenceDate, horizonDate)) {
    scheduledDates.push(dueReminderDate);
  }

  let repeatReminderDate = getClientReminderDate(addDays(baseDate, repeatDays));

  while (repeatReminderDate <= horizonDate) {
    if (repeatReminderDate > referenceDate) {
      scheduledDates.push(repeatReminderDate);
    }

    repeatReminderDate = getClientReminderDate(addDays(repeatReminderDate, repeatDays));
  }

  return scheduledDates;
}

function buildEventScheduledReminderDates(notification: EventNotificationItem, referenceDate: Date) {
  const eventDate = getNotificationScheduleBaseDate(notification.nextDate);
  const horizonDate = addDays(referenceDate, REMINDER_SCHEDULE_HORIZON_DAYS);

  return EVENT_ADVANCE_MINUTES
    .map((minutes) => addMinutes(eventDate, -minutes))
    .filter((triggerDate) => isSchedulableDate(triggerDate, referenceDate, horizonDate));
}

function getScheduledReminderDates(notification: ReminderNotificationItem, referenceDate: Date) {
  if (notification.kind === 'event') {
    return buildEventScheduledReminderDates(notification, referenceDate);
  }

  if (notification.kind === 'payment') {
    return buildClientScheduledReminderDates(notification, referenceDate, PAYMENT_ADVANCE_DAYS, PAYMENT_REPEAT_DAYS);
  }

  return buildClientScheduledReminderDates(notification, referenceDate, REVISION_ADVANCE_DAYS, REVISION_REPEAT_DAYS);
}

function buildClientDeviceReminderNotifications(clientData: ClientDashboardData[], referenceDate = new Date()) {
  return clientData.flatMap<DashboardNotificationItem>(({ client, payments, revisions }) => {
    if (client.estado === 'baja') {
      return [];
    }

    const paymentStatus = calculateClientPaymentStatus(client, payments, referenceDate);
    const revisionStatus = calculateClientRevisionStatus(client, revisions, referenceDate);
    const notifications: DashboardNotificationItem[] = [];

    if (client.forcePaymentPending || paymentStatus.nextPaymentDate) {
      notifications.push({
        kind: 'payment',
        clientId: client.id,
        clientName: client.name,
        lastDate: toReminderDate(paymentStatus.lastPaymentDate),
        nextDate: toReminderDate(paymentStatus.nextPaymentDate),
      });
    }

    if (revisionStatus.isConfigured && revisionStatus.nextRevisionDate) {
      notifications.push({
        kind: 'revision',
        clientId: client.id,
        clientName: client.name,
        lastDate: toReminderDate(revisionStatus.lastRevisionDate),
        nextDate: toReminderDate(revisionStatus.nextRevisionDate),
      });
    }

    return notifications;
  });
}

function getClientReminderPhase(notification: DashboardNotificationItem, triggerDate: Date) {
  const baseDate = startOfDay(getNotificationScheduleBaseDate(notification.nextDate));
  const normalizedTriggerDate = startOfDay(triggerDate);

  if (normalizedTriggerDate < baseDate) {
    return 'upcoming';
  }

  if (normalizedTriggerDate.getTime() === baseDate.getTime()) {
    return 'dueToday';
  }

  return 'overdue';
}

function getClientNotificationCopy(notification: DashboardNotificationItem, triggerDate: Date) {
  const phase = getClientReminderPhase(notification, triggerDate);

  if (notification.kind === 'payment') {
    if (phase === 'upcoming') {
      return {
        title: 'Pago próximo',
        body: `${notification.clientName} tiene un pago próximo.`,
      };
    }

    if (phase === 'dueToday') {
      return {
        title: 'Pago vence hoy',
        body: `${notification.clientName} tiene un pago previsto para hoy.`,
      };
    }

    return {
      title: 'Pago pendiente',
      body: `${notification.clientName} tiene un pago pendiente.`,
    };
  }

  if (phase === 'upcoming') {
    return {
      title: 'Revisión próxima',
      body: `${notification.clientName} tiene una revisión próxima.`,
    };
  }

  if (phase === 'dueToday') {
    return {
      title: 'Revisión hoy',
      body: `${notification.clientName} tiene una revisión prevista para hoy.`,
    };
  }

  return {
    title: 'Revisión pendiente',
    body: `${notification.clientName} tiene una revisión pendiente.`,
  };
}

function getEventNotificationCopy(notification: EventNotificationItem, triggerDate: Date) {
  const eventDate = getNotificationScheduleBaseDate(notification.nextDate);
  const minutesUntilEvent = Math.round((eventDate.getTime() - triggerDate.getTime()) / 60000);
  const timeText = minutesUntilEvent >= 60 ? 'en 1 hora' : 'en 10 minutos';

  return {
    title: `Evento ${timeText}`,
    body: `${notification.eventTitle} empieza ${timeText}.`,
  };
}

function getNotificationContent(notification: ReminderNotificationItem, triggerDate: Date): NotificationContentInput {
  const isEvent = notification.kind === 'event';

  if (isEvent) {
    const copy = getEventNotificationCopy(notification, triggerDate);

    return {
      title: copy.title,
      body: copy.body,
      sound: 'default',
      priority: 'high',
      data: {
        kind: notification.kind,
        clientId: notification.clientId,
        clientName: notification.clientName,
        eventId: notification.eventId,
        occurrenceId: notification.occurrenceId,
      },
    };
  }

  const copy = getClientNotificationCopy(notification, triggerDate);

  return {
    title: copy.title,
    body: copy.body,
    sound: 'default',
    priority: 'high',
    data: {
      kind: notification.kind,
      clientId: notification.clientId,
      clientName: notification.clientName,
    },
  };
}

async function scheduleNotification(Notifications: NotificationsModule, notification: ReminderNotificationItem, triggerDate: Date) {
  await Notifications.scheduleNotificationAsync({
    content: getNotificationContent(notification, triggerDate),
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
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

  const referenceDate = new Date();
  const notifications = buildClientDeviceReminderNotifications(clientData, referenceDate);

  for (const notification of notifications) {
    const scheduledDates = getScheduledReminderDates(notification, referenceDate);

    for (const triggerDate of scheduledDates) {
      await scheduleNotification(Notifications, notification, triggerDate);
    }
  }

  return true;
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

export async function resyncDeviceNotificationsIfNeeded(clientData: ClientDashboardData[]) {
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

  const referenceDate = new Date();
  const notifications = buildClientDeviceReminderNotifications(clientData, referenceDate);

  for (const notification of notifications) {
    const scheduledDates = getScheduledReminderDates(notification, referenceDate);

    for (const triggerDate of scheduledDates) {
      await scheduleNotification(Notifications, notification, triggerDate);
    }
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

  const eventNotifications = await buildEventNotificationData(userId);

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

  const referenceDate = new Date();
  const notifications = [...buildClientDeviceReminderNotifications(nextClientData, referenceDate), ...eventNotifications];

  for (const notification of notifications) {
    const scheduledDates = getScheduledReminderDates(notification, referenceDate);

    for (const triggerDate of scheduledDates) {
      await scheduleNotification(Notifications, notification, triggerDate);
    }
  }

  return true;
}
