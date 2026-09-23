import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { StatusBanner } from '@/components/feedback/status-banner';
import { ScreenContainer } from '@/components/layout/screen-container';
import { ClientRow } from '@/components/surface/client-row';
import { DashboardMetricCard } from '@/components/surface/dashboard-metric-card';
import { ThemedText } from '@/components/themed-text';
import { Accent, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { clientPaymentsService } from '@/services/client-payments';
import { clientsService } from '@/services/clients';
import { syncDeviceNotificationsForUser } from '@/services/device-notifications';
import { eventsService } from '@/services/events';
import { revisionsService } from '@/services/revisions';
import { Client } from '@/types/domain';
import {
    buildDashboardNotifications,
    ClientDashboardData,
    DashboardNotificationItem,
    formatDashboardNotificationDate,
} from '@/utils/client-notifications';
import { calculateClientPaymentStatus, calculateMonthlyRevenueFromClients } from '@/utils/client-payments';
import { calculateClientRevisionStatus } from '@/utils/client-revisions';
import { buildEventNotifications, EventNotificationItem, formatEventNotificationDate } from '@/utils/event-notifications';

type DashboardNotification = DashboardNotificationItem | EventNotificationItem;

type GroupedDashboardNotification = {
  kind: 'payment' | 'revision' | 'event';
  grouped: true;
  count: number;
};

type NotificationListItem = DashboardNotification | GroupedDashboardNotification;

function isGroupedNotification(item: NotificationListItem): item is GroupedDashboardNotification {
  return 'grouped' in item && item.grouped;
}

function getGroupedNotificationCopy(kind: GroupedDashboardNotification['kind'], count: number) {
  if (kind === 'payment') {
    return { title: `${count} pagos pendientes`, subtitle: 'Toca para ver todos los pagos' };
  }

  if (kind === 'revision') {
    return { title: `${count} revisiones pendientes`, subtitle: 'Toca para ver tus clientes' };
  }

  return { title: `${count} eventos próximos`, subtitle: 'Toca para ver tu agenda' };
}

function getNotificationPresentation(kind: 'payment' | 'revision' | 'event') {
  if (kind === 'payment') {
    return {
      icon: '💶',
      title: 'Pago pendiente',
      accent: '#16A34A',
      accentSoft: '#ECFDF5',
      border: '#BBF7D0',
      text: '#166534',
      background: '#F5FDF8',
    };
  }

  if (kind === 'revision') {
    return {
      icon: '📅',
      title: 'Revisión pendiente',
      accent: '#D97706',
      accentSoft: '#FFF7ED',
      border: '#FED7AA',
      text: '#9A3412',
      background: '#FFFBF3',
    };
  }

  return {
    icon: '🗓️',
    title: 'Evento próximo',
    accent: '#2563EB',
    accentSoft: '#EFF6FF',
    border: '#BFDBFE',
    text: '#1D4ED8',
    background: '#F8FBFF',
  };
}

type CalendarDayInfo = {
  paymentCount: number;
  revisionCount: number;
};

type CalendarDueItem = {
  kind: 'payment' | 'revision';
  date: Date;
  clientId: string;
  clientName: string;
};

function getDateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1, 0, 0, 0, 0);
}

function shiftMonth(value: Date, offset: number) {
  return new Date(value.getFullYear(), value.getMonth() + offset, 1, 0, 0, 0, 0);
}

function formatSpanishLongDate(value: Date) {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
    .format(value)
    .replace(/^(.)/, (match) => match.toUpperCase());
}

export function ClientsScreen() {
  const { signOut, user } = useAuth();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientData, setClientData] = useState<ClientDashboardData[]>([]);
  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [isCalendarDetailOpen, setIsCalendarDetailOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [selectedCalendarDateKey, setSelectedCalendarDateKey] = useState<string | null>(null);

  const userName = (user?.user_metadata?.fullName as string | undefined)?.trim() || user?.email?.split('@')[0] || 'Usuario';
  const firstName = userName.split(/\s+/)[0];
  const clinicName = (user?.user_metadata?.clinicName as string | undefined)?.trim() || null;
  const syncStatus = isLoadingClients ? 'Sincronizando...' : clientsError ? 'Requiere revisión' : 'Sincronizado';
  const isCompactWidth = width < 390;
  const activeClients = clients.filter((client) => client.estado === 'activo');
  const monthlyRevenue = calculateMonthlyRevenueFromClients(activeClients);
  const pendingNotificationCount = notifications.length;
  const groupedNotifications = useMemo<NotificationListItem[]>(() => {
    const byKind = new Map<GroupedDashboardNotification['kind'], DashboardNotification[]>();

    notifications.forEach((notification) => {
      const bucket = byKind.get(notification.kind) ?? [];
      bucket.push(notification);
      byKind.set(notification.kind, bucket);
    });

    const result: NotificationListItem[] = [];

    byKind.forEach((items, kind) => {
      if (items.length > 1) {
        result.push({ kind, grouped: true, count: items.length });
      } else {
        result.push(items[0]);
      }
    });

    return result;
  }, [notifications]);
  const greeting = new Date().getHours() < 12 ? 'Buenos días' : new Date().getHours() < 20 ? 'Buenas tardes' : 'Buenas noches';
  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
        .format(new Date())
        .replace(/^(.)/, (match) => match.toUpperCase()),
    []
  );
  const calendarMonthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('es-ES', {
        month: 'long',
        year: 'numeric',
      })
        .format(calendarMonth)
        .replace(/^(.)/, (match) => match.toUpperCase()),
    [calendarMonth]
  );
  const calendarWeekdayLabels = useMemo(() => ['L', 'M', 'X', 'J', 'V', 'S', 'D'], []);
  const todayStart = useMemo(() => startOfDay(new Date()), []);
  const calendarGrid = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const offset = (firstDay.getDay() + 6) % 7;
    const cells: (number | null)[] = Array.from({ length: offset }, () => null);

    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(day);
    }

    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    return cells;
  }, [calendarMonth]);
  const calendarDueItems = useMemo(() => {
    const dueItems: CalendarDueItem[] = [];

    clientData.forEach(({ client, payments, revisions }) => {
      const paymentStatus = calculateClientPaymentStatus(client, payments);
      const revisionStatus = calculateClientRevisionStatus(client, revisions);

      if (paymentStatus.nextPaymentDate && paymentStatus.nextPaymentDate >= todayStart) {
        dueItems.push({
          kind: 'payment',
          date: paymentStatus.nextPaymentDate,
          clientId: client.id,
          clientName: client.name,
        });
      }

      if (revisionStatus.nextRevisionDate && revisionStatus.nextRevisionDate >= todayStart) {
        dueItems.push({
          kind: 'revision',
          date: revisionStatus.nextRevisionDate,
          clientId: client.id,
          clientName: client.name,
        });
      }
    });

    return dueItems;
  }, [clientData, todayStart]);
  const calendarDays = useMemo(() => {
    const monthMap = new Map<string, CalendarDayInfo>();

    calendarDueItems.forEach((item) => {
      if (item.date.getFullYear() !== calendarMonth.getFullYear() || item.date.getMonth() !== calendarMonth.getMonth()) {
        return;
      }

      const dateKey = getDateKey(item.date);
      const currentValue = monthMap.get(dateKey) ?? { paymentCount: 0, revisionCount: 0 };

      if (item.kind === 'payment') {
        currentValue.paymentCount += 1;
      } else {
        currentValue.revisionCount += 1;
      }

      monthMap.set(dateKey, currentValue);
    });

    return monthMap;
  }, [calendarDueItems, calendarMonth]);
  const selectedCalendarDate = useMemo(() => {
    if (!selectedCalendarDateKey) {
      return null;
    }

    const [yearString, monthString, dayString] = selectedCalendarDateKey.split('-');
    const year = Number(yearString);
    const month = Number(monthString);
    const day = Number(dayString);

    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
      return null;
    }

    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }, [selectedCalendarDateKey]);
  const selectedCalendarItems = useMemo(() => {
    if (!selectedCalendarDate) {
      return [] as CalendarDueItem[];
    }

    const dateKey = getDateKey(selectedCalendarDate);

    return calendarDueItems
      .filter((item) => getDateKey(item.date) === dateKey)
      .sort((left, right) => {
        if (left.kind !== right.kind) {
          return left.kind === 'payment' ? -1 : 1;
        }

        return left.clientName.localeCompare(right.clientName, 'es-ES');
      });
  }, [calendarDueItems, selectedCalendarDate]);
  const recentRevisionClients = [...clientData]
    .filter(({ revisions }) => revisions.length > 0)
    .sort((left, right) => {
      const leftRevision = new Date(left.revisions[0].reviewedAt).getTime();
      const rightRevision = new Date(right.revisions[0].reviewedAt).getTime();

      return rightRevision - leftRevision;
    })
    .slice(0, 3);

  const loadClients = useCallback(async () => {
    if (!user?.id) {
      setClients([]);
      setClientData([]);
      setNotifications([]);
      setIsLoadingClients(false);
      return;
    }

    setIsLoadingClients(true);
    setClientsError(null);

    try {
      const nextClients = await clientsService.listByOwner(user.id);
      setClients(nextClients);

      const nextClientData = await Promise.all(
        nextClients.map(async (client) => ({
          client,
          payments: await clientPaymentsService.listByClient(client.id),
          revisions: await revisionsService.listByClient(client.id),
        }))
      );

      const nextEvents = await eventsService.listByOwner(user.id);
      const horizonStart = startOfDay(new Date());
      const horizonEnd = new Date(horizonStart);
      horizonEnd.setDate(horizonEnd.getDate() + 90);
      const nextOccurrences = await eventsService.syncOccurrencesForOwner(user.id, horizonStart, horizonEnd);

      const nextNotifications: DashboardNotification[] = [
        ...buildDashboardNotifications(nextClientData),
        ...buildEventNotifications({
          clients: nextClients,
          events: nextEvents,
          occurrences: nextOccurrences,
        }),
      ].sort((left, right) => {
        const leftDate = new Date(left.nextDate ?? left.lastDate ?? '').getTime();
        const rightDate = new Date(right.nextDate ?? right.lastDate ?? '').getTime();

        return leftDate - rightDate;
      });

      setClientData(nextClientData);
      setNotifications(nextNotifications);
      void syncDeviceNotificationsForUser(user.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudieron cargar los clientes.';
      setClientsError(message);
      setClientData([]);
      setNotifications([]);
    } finally {
      setIsLoadingClients(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  useFocusEffect(
    React.useCallback(() => {
      void loadClients();
    }, [loadClients])
  );

  async function handleLogout() {
    setIsSigningOut(true);

    try {
      await signOut();
      router.replace('/login');
    } finally {
      setIsSigningOut(false);
    }
  }

  function openClientPaymentNotifications() {
    setIsNotificationsModalOpen(true);
  }

  function closeClientPaymentNotifications() {
    setIsNotificationsModalOpen(false);
  }

  function goToClientPayments(clientId: string) {
    setIsNotificationsModalOpen(false);
    router.push(`/clients/${clientId}/payments`);
  }

  function goToClientProfile(clientId: string) {
    setIsNotificationsModalOpen(false);
    router.push(`/clients/${clientId}`);
  }

  function goToEventOccurrence(occurrenceId: string) {
    setIsNotificationsModalOpen(false);
    router.push(`/events/occurrences/${occurrenceId}`);
  }

  function goToClientsList() {
    router.push('/clientes');
  }

  function goToNewClient() {
    router.push('/clients/new');
  }

  function goToAgenda() {
    router.push('/agenda');
  }

  function goToPayments() {
    router.push('/pagos');
  }

  function handlePreviousMonth() {
    setCalendarMonth((currentMonth) => shiftMonth(currentMonth, -1));
  }

  function handleNextMonth() {
    setCalendarMonth((currentMonth) => shiftMonth(currentMonth, 1));
  }

  function openCalendarDayDetail(date: Date) {
    setSelectedCalendarDateKey(getDateKey(date));
    setIsCalendarDetailOpen(true);
  }

  function closeCalendarDayDetail() {
    setIsCalendarDetailOpen(false);
  }

  return (
    <ScreenContainer contentStyle={styles.screenContent}>
      <View style={styles.heroPanel}>
        <View style={styles.brandStrip}>
          <View style={styles.brandBadge}>
            <Image source={require('../../../assets/branding/logo-evometrics.png')} style={styles.brandLogo} resizeMode="contain" />
          </View>
          <View style={styles.brandCopy}>
            <ThemedText type="smallBold" style={styles.brandName}>
              EvoMetrics
            </ThemedText>
            <ThemedText type="small" style={styles.brandText}>
              Panel profesional
            </ThemedText>
          </View>
          <View style={styles.brandActions}>
            <Pressable
              onPress={openClientPaymentNotifications}
              accessibilityRole="button"
              accessibilityLabel={`Notificaciones${pendingNotificationCount ? `, ${pendingNotificationCount} pendientes` : ', ninguna pendiente'}`}
              hitSlop={8}
              style={({ pressed }) => [
                styles.notificationButton,
                pressed && styles.headerActionPressed,
              ]}>
              <Ionicons name="notifications-outline" size={23} color="#FFFFFF" />
              {pendingNotificationCount > 0 ? (
                <View style={styles.notificationBadge}>
                  <ThemedText type="smallBold" style={styles.notificationBadgeText}>
                    {pendingNotificationCount > 99 ? '99+' : pendingNotificationCount}
                  </ThemedText>
                </View>
              ) : null}
            </Pressable>
            <Pressable
              onPress={handleLogout}
              disabled={isSigningOut}
              accessibilityRole="button"
              accessibilityLabel="Cerrar sesión"
              hitSlop={8}
              style={({ pressed }) => [styles.notificationButton, pressed && styles.headerActionPressed]}>
              <Ionicons name="log-out-outline" size={23} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        <View style={styles.heroIdentity}>
          <ThemedText style={styles.heroGreeting}>{greeting},</ThemedText>
          <ThemedText numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75} style={styles.heroTitle}>
            {firstName}
          </ThemedText>
          <ThemedText type="small" style={styles.heroSubtitle}>
            {clinicName || 'Tu espacio profesional'}
          </ThemedText>
        </View>

        <View style={[styles.heroMetaRow, isCompactWidth && styles.heroMetaRowCompact]}>
          <View style={styles.statusPill} accessibilityLabel={`Estado: ${syncStatus}`}>
            <View style={[styles.statusDot, clientsError ? styles.statusDotWarning : styles.statusDotOk]} />
            <ThemedText type="smallBold" style={styles.statusText}>
              {syncStatus}
            </ThemedText>
          </View>
          <ThemedText type="small" style={styles.todayText}>{todayLabel}</ThemedText>
        </View>
      </View>

      {clientsError ? <StatusBanner tone="danger" message={clientsError} /> : null}

      <View style={styles.sectionBlock}>
        <View style={styles.metricsGrid}>
          <DashboardMetricCard
            icon={<Ionicons name="people" size={16} color="#FFFFFF" />}
            label="Clientes activos"
            value={String(activeClients.length)}
          />
          <DashboardMetricCard
            icon={<Ionicons name="logo-euro" size={16} color="#FFFFFF" />}
            label="Ganancias mensuales"
            value={`${monthlyRevenue.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`}
            tone="primary"
          />
        </View>
      </View>

      <View style={styles.quickActionsCard}>
        <View style={styles.sectionHeadingRow}>
          <View>
            <ThemedText style={styles.sectionTitle}>Acciones rápidas</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">Tareas frecuentes</ThemedText>
          </View>
        </View>
        <View style={styles.quickActionsRow}>
          {[
            { label: 'Nuevo cliente', icon: 'person-add-outline' as const, onPress: goToNewClient },
            { label: 'Ver agenda', icon: 'calendar-outline' as const, onPress: goToAgenda },
            { label: 'Gestionar pagos', icon: 'card-outline' as const, onPress: goToPayments },
          ].map((action) => (
            <Pressable
              key={action.label}
              onPress={action.onPress}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              style={({ pressed }) => [styles.quickAction, pressed && styles.quickActionPressed]}>
              <View style={styles.quickActionIcon}>
                <Ionicons name={action.icon} size={21} color={Accent.primary} />
              </View>
              <ThemedText type="smallBold" style={styles.quickActionLabel}>{action.label}</ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

        <View style={styles.recentCard}>
          <View style={styles.recentCardHeader}>
            <View>
              <ThemedText style={styles.sectionTitle}>Actividad reciente</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Últimas revisiones registradas</ThemedText>
            </View>
            <Pressable
              onPress={goToClientsList}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.recentCardAction,
                pressed && styles.quickActionPressed,
              ]}>
              <ThemedText type="smallBold" style={styles.recentCardActionText}>
                Ver clientes
              </ThemedText>
              <Ionicons name="arrow-forward" size={16} color={Accent.primary} />
            </Pressable>
          </View>

          <View style={styles.recentCardList}>
            {recentRevisionClients.length === 0 ? (
              <StatusBanner tone="info" message="Aún no hay revisiones registradas para mostrar." />
            ) : (
              recentRevisionClients.map(({ client, revisions }, index) => {
                return (
                  <ClientRow
                    key={client.id}
                    name={client.name}
                    meta={`Última revisión · ${formatDashboardNotificationDate(revisions[0].reviewedAt)}`}
                    onPress={() => goToClientProfile(client.id)}
                    last={index === recentRevisionClients.length - 1}
                    compact
                  />
                );
              })
            )}
          </View>
        </View>

        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <View>
              <ThemedText style={styles.sectionTitle}>Próximos vencimientos</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Pagos y revisiones programadas</ThemedText>
            </View>
          </View>

          <View style={[styles.calendarControlsRow, isCompactWidth && styles.calendarControlsRowCompact]}>
            <Pressable onPress={handlePreviousMonth} style={styles.calendarNavButton} accessibilityLabel="Mes anterior">
              <Ionicons name="chevron-back" size={16} color={Accent.primary} />
            </Pressable>
            <ThemedText type="smallBold" style={styles.calendarMonthLabel}>
              {calendarMonthLabel}
            </ThemedText>
            <Pressable onPress={handleNextMonth} style={styles.calendarNavButton} accessibilityLabel="Mes siguiente">
              <Ionicons name="chevron-forward" size={16} color={Accent.primary} />
            </Pressable>
          </View>

          <View style={[styles.calendarWeekRow, isCompactWidth && styles.calendarWeekRowCompact]}>
            {calendarWeekdayLabels.map((label) => (
              <ThemedText key={label} type="small" themeColor="textSecondary" style={styles.calendarWeekLabel}>
                {label}
              </ThemedText>
            ))}
          </View>

          <View style={[styles.calendarGrid, isCompactWidth && styles.calendarGridCompact]}>
            {calendarGrid.map((day, index) => {
              if (day === null) {
                return <View key={`empty-${index}`} style={styles.calendarCellSpacer} />;
              }

              const currentDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
              const today = new Date();
              const isToday =
                currentDate.getFullYear() === today.getFullYear() &&
                currentDate.getMonth() === today.getMonth() &&
                currentDate.getDate() === today.getDate();
              const dayInfo = calendarDays.get(getDateKey(currentDate));
              const hasPayment = Boolean(dayInfo?.paymentCount);
              const hasRevision = Boolean(dayInfo?.revisionCount);
              const hasBoth = hasPayment && hasRevision;
              const totalEvents = (dayInfo?.paymentCount ?? 0) + (dayInfo?.revisionCount ?? 0);

              return (
                <Pressable
                  key={`day-${day}`}
                  onPress={() => openCalendarDayDetail(currentDate)}
                  style={[
                    styles.calendarCell,
                    isToday && styles.calendarCellToday,
                    hasPayment || hasRevision ? styles.calendarCellBusy : null,
                  ]}>
                  <ThemedText
                    type="smallBold"
                    style={[
                      styles.calendarDayLabel,
                      hasBoth ? styles.calendarDayLabelCombined : null,
                      isToday && styles.calendarDayLabelToday,
                      !hasPayment && !hasRevision ? styles.calendarDayLabelMuted : null,
                    ]}>
                    {day}
                  </ThemedText>

                  <View style={styles.calendarCellMarkers}>
                    {hasBoth ? (
                      <View style={styles.calendarMarkerRow}>
                        <View style={[styles.calendarMarkerDot, styles.calendarMarkerCombined]} />
                        <ThemedText type="small" style={styles.calendarMarkerCount}>
                          {totalEvents}
                        </ThemedText>
                      </View>
                    ) : hasPayment ? (
                      <View style={styles.calendarMarkerRow}>
                        <View style={[styles.calendarMarkerDot, styles.calendarMarkerPayment]} />
                        {dayInfo!.paymentCount > 1 ? (
                          <ThemedText type="small" style={styles.calendarMarkerCount}>
                            {dayInfo!.paymentCount}
                          </ThemedText>
                        ) : null}
                      </View>
                    ) : hasRevision ? (
                      <View style={styles.calendarMarkerRow}>
                        <View style={[styles.calendarMarkerDot, styles.calendarMarkerRevision]} />
                        {dayInfo!.revisionCount > 1 ? (
                          <ThemedText type="small" style={styles.calendarMarkerCount}>
                            {dayInfo!.revisionCount}
                          </ThemedText>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

      <Modal transparent visible={isCalendarDetailOpen} animationType="fade" onRequestClose={closeCalendarDayDetail}>
        <Pressable style={[styles.calendarDetailBackdrop, isCompactWidth && styles.calendarDetailBackdropCompact]} onPress={closeCalendarDayDetail}>
          <Pressable style={[styles.calendarDetailPanel, { borderColor: theme.backgroundSelected }]} onPress={() => null}>
            <View style={styles.calendarDetailHeader}>
              <View style={styles.calendarDetailHeaderCopy}>
                <ThemedText type="label" style={styles.calendarDetailLabel}>
                  Detalle del día
                </ThemedText>
                <ThemedText style={styles.calendarDetailTitle}>
                  {selectedCalendarDate ? formatSpanishLongDate(selectedCalendarDate) : 'Día'}
                </ThemedText>
              </View>
              <Pressable onPress={closeCalendarDayDetail} style={styles.calendarDetailCloseButton}>
                <ThemedText type="smallBold" style={styles.calendarDetailCloseText}>×</ThemedText>
              </Pressable>
            </View>

            <View style={styles.calendarDetailList}>
              {selectedCalendarItems.length === 0 ? (
                <StatusBanner tone="info" message="Ese día no tiene pagos ni revisiones pendientes." />
              ) : (
                selectedCalendarItems.map((item) => {
                  const presentation = getNotificationPresentation(item.kind);

                  return (
                    <View key={`${item.kind}-${item.clientId}-${item.date.toISOString()}`} style={styles.calendarDetailItem}>
                      <View style={[styles.calendarDetailMarker, { backgroundColor: presentation.accentSoft, borderColor: presentation.border }]}>
                        <ThemedText type="smallBold" style={[styles.calendarDetailMarkerText, { color: presentation.accent }]}>
                          {item.kind === 'payment' ? 'P' : 'R'}
                        </ThemedText>
                      </View>
                      <View style={styles.calendarDetailItemCopy}>
                        <ThemedText type="smallBold" style={styles.calendarDetailClientName}>
                          {item.clientName}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary" style={styles.calendarDetailItemDate}>
                          {formatDashboardNotificationDate(item.date.toISOString())}
                        </ThemedText>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent visible={isNotificationsModalOpen} animationType="fade" onRequestClose={closeClientPaymentNotifications}>
        <Pressable style={[styles.notificationsBackdrop, isCompactWidth && styles.notificationsBackdropCompact]} onPress={closeClientPaymentNotifications}>
          <Pressable style={[styles.notificationsPanel, { borderColor: theme.backgroundSelected }]} onPress={() => null}>
            <View style={styles.notificationsHeader}>
              <View style={styles.notificationItemCopy}>
                <ThemedText style={styles.sectionTitle}>Notificaciones</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {pendingNotificationCount === 0 ? 'Todo está al día' : `${pendingNotificationCount} asuntos requieren atención`}
                </ThemedText>
              </View>
              <Pressable
                onPress={closeClientPaymentNotifications}
                accessibilityRole="button"
                accessibilityLabel="Cerrar notificaciones"
                style={styles.notificationsCloseButton}>
                <Ionicons name="close" size={22} color={Accent.primary} />
              </Pressable>
            </View>
            <View style={styles.notificationsList}>
              {groupedNotifications.length === 0 ? (
                <StatusBanner tone="info" message="Todo está al corriente por ahora." />
              ) : (
                groupedNotifications.map((notification) => (
                  (() => {
                    const presentation = getNotificationPresentation(notification.kind);

                    if (isGroupedNotification(notification)) {
                      const groupedCopy = getGroupedNotificationCopy(notification.kind, notification.count);

                      return (
                        <Pressable
                          key={`group-${notification.kind}`}
                          onPress={() => {
                            if (notification.kind === 'payment') {
                              goToPayments();
                              setIsNotificationsModalOpen(false);
                              return;
                            }

                            if (notification.kind === 'revision') {
                              goToClientsList();
                              setIsNotificationsModalOpen(false);
                              return;
                            }

                            goToAgenda();
                            setIsNotificationsModalOpen(false);
                          }}
                          style={({ pressed }) => [
                            styles.notificationItem,
                            {
                              borderColor: presentation.border,
                              backgroundColor: pressed ? presentation.accentSoft : presentation.background,
                            },
                          ]}>
                          <View style={styles.notificationItemTop}>
                            <View style={[styles.notificationIconBadge, { backgroundColor: presentation.accentSoft, borderColor: presentation.border }]}>
                              <ThemedText type="smallBold" style={[styles.notificationIconEmoji, { color: presentation.accent }]}>
                                {presentation.icon}
                              </ThemedText>
                            </View>
                            <View style={styles.notificationItemCopy}>
                              <ThemedText type="smallBold">{groupedCopy.title}</ThemedText>
                              <ThemedText type="small" style={[styles.notificationKindText, { color: presentation.text }]}>
                                {groupedCopy.subtitle}
                              </ThemedText>
                            </View>
                            <View style={[styles.notificationCountPill, { borderColor: presentation.border, backgroundColor: presentation.accentSoft }]}>
                              <ThemedText type="smallBold" style={[styles.notificationCountPillText, { color: presentation.accent }]}>
                                {notification.count}
                              </ThemedText>
                            </View>
                          </View>
                        </Pressable>
                      );
                    }

                    const isEventNotification = notification.kind === 'event';

                    return (
                  <Pressable
                    key={`${notification.kind}-${notification.kind === 'event' ? notification.occurrenceId : notification.clientId}`}
                    onPress={() => {
                      if (notification.kind === 'event') {
                        goToEventOccurrence(notification.occurrenceId);
                        return;
                      }

                      if (notification.kind === 'payment') {
                        goToClientPayments(notification.clientId);
                        return;
                      }

                      if (notification.kind === 'revision') {
                        goToClientProfile(notification.clientId);
                        return;
                      }

                    }}
                    style={({ pressed }) => [
                      styles.notificationItem,
                      {
                        borderColor: presentation.border,
                        backgroundColor: pressed ? presentation.accentSoft : presentation.background,
                      },
                    ]}>
                    <View style={styles.notificationItemTop}>
                      <View style={[styles.notificationIconBadge, { backgroundColor: presentation.accentSoft, borderColor: presentation.border }]}>
                        <ThemedText type="smallBold" style={[styles.notificationIconEmoji, { color: presentation.accent }]}>
                          {presentation.icon}
                        </ThemedText>
                      </View>
                      <View style={styles.notificationItemCopy}>
                        {isEventNotification ? (
                          <>
                            <ThemedText type="smallBold">{notification.eventTitle}</ThemedText>
                            <ThemedText type="small" style={[styles.notificationKindText, { color: presentation.text }]}>
                              {notification.clientName}
                            </ThemedText>
                          </>
                        ) : (
                          <>
                            <ThemedText type="smallBold">{notification.clientName}</ThemedText>
                            <ThemedText type="small" style={[styles.notificationKindText, { color: presentation.text }]}>
                              {presentation.title}
                            </ThemedText>
                          </>
                        )}
                      </View>
                      <View style={[styles.notificationTypePill, { borderColor: presentation.border, backgroundColor: presentation.accentSoft }]}>
                        <ThemedText type="smallBold" style={[styles.notificationTypePillText, { color: presentation.text }]}>
                          {notification.kind === 'payment' ? 'Cobro' : notification.kind === 'revision' ? 'Revisión' : 'Evento'}
                        </ThemedText>
                      </View>
                    </View>
                    {isEventNotification ? (
                      <ThemedText type="small" themeColor="textSecondary" style={styles.notificationDetailText}>
                        Inicio: {formatEventNotificationDate(notification.nextDate)}
                      </ThemedText>
                    ) : null}
                  </Pressable>
                    );
                  })()
                ))
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },
  heroPanel: {
    backgroundColor: '#173E91',
    borderRadius: 24,
    padding: 20,
    gap: 24,
    shadowColor: '#102D68',
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 7,
    overflow: 'hidden',
  },
  brandStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandBadge: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogo: {
    width: 34,
    height: 34,
  },
  brandCopy: {
    flex: 1,
    minWidth: 0,
    gap: 0,
  },
  brandActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandName: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 20,
  },
  brandText: {
    color: '#C7D7FF',
    lineHeight: 18,
  },
  heroIdentity: {
    gap: 2,
  },
  heroGreeting: {
    color: '#C7D7FF',
    fontSize: 16,
    lineHeight: 22,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  heroMetaRowCompact: {
    gap: 10,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  heroSubtitle: {
    color: '#DCE6FF',
    lineHeight: 20,
    marginTop: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
  },
  statusDotOk: {
    backgroundColor: '#67E8B1',
  },
  statusDotWarning: {
    backgroundColor: '#DC5B5B',
  },
  statusText: {
    color: '#FFFFFF',
    lineHeight: 17,
  },
  todayText: {
    color: '#C7D7FF',
    lineHeight: 18,
  },
  headerActionPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }],
  },
  quickActionsCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DFE7F2',
    borderRadius: 22,
    padding: 16,
    gap: 14,
    shadowColor: '#183153',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickAction: {
    flex: 1,
    minHeight: 94,
    borderWidth: 1,
    borderColor: '#E1E9F5',
    borderRadius: 16,
    backgroundColor: '#F8FAFE',
    paddingHorizontal: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  quickActionPressed: {
    opacity: 0.74,
    transform: [{ scale: 0.98 }],
  },
  quickActionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#E8F0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    color: '#223653',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  sectionBlock: {
    gap: 12,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    color: '#10203B',
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  calendarCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#DFE7F2',
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 14,
    shadowColor: '#10203B',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  calendarHeader: {
    alignItems: 'flex-start',
  },
  calendarControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 4,
  },
  calendarControlsRowCompact: {
    gap: 8,
  },
  calendarNavButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: '#D4E3FA',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarMonthLabel: {
    flex: 1,
    textAlign: 'center',
    color: '#1D2E4A',
  },
  calendarWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 0,
    marginTop: 10,
    marginBottom: 6,
  },
  calendarWeekRowCompact: {
    marginTop: 8,
  },
  calendarWeekLabel: {
    width: '13.2%',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 0,
    rowGap: 6,
  },
  calendarGridCompact: {
    rowGap: 8,
  },
  calendarCellSpacer: {
    width: '13.2%',
    aspectRatio: 1,
  },
  calendarCell: {
    width: '13.2%',
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: '#E5ECF7',
    borderRadius: 12,
    backgroundColor: '#F8FAFD',
    padding: 5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  calendarCellPressable: {
    flex: 1,
  },
  calendarCellToday: {
    borderColor: Accent.primary,
    backgroundColor: '#EAF1FF',
  },
  calendarCellBusy: {
    backgroundColor: '#FAFCFF',
  },
  calendarDayLabel: {
    color: '#112746',
    lineHeight: 15,
    textAlign: 'center',
  },
  calendarDayLabelCombined: {
    marginTop: 2,
  },
  calendarDayLabelBusy: {
    fontSize: 12,
    lineHeight: 14,
  },
  calendarDayLabelToday: {
    color: Accent.primary,
  },
  calendarDayLabelMuted: {
    color: '#9DB0D1',
  },
  calendarCellMarkers: {
    gap: 4,
  },
  calendarMarkerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  calendarMarkerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  calendarMarkerPayment: {
    backgroundColor: '#16A34A',
  },
  calendarMarkerRevision: {
    backgroundColor: '#D97706',
  },
  calendarMarkerCombined: {
    backgroundColor: Accent.primary,
  },
  calendarMarkerCount: {
    color: '#60738F',
    fontSize: 9,
    lineHeight: 10,
  },
  calendarDetailBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 24, 45, 0.42)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  calendarDetailBackdropCompact: {
    paddingHorizontal: Spacing.two,
  },
  calendarDetailPanel: {
    borderWidth: 1,
    borderRadius: Radius.large,
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 12,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    shadowColor: '#10203B',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  calendarDetailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  calendarDetailHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  calendarDetailLabel: {
    color: Accent.primary,
  },
  calendarDetailTitle: {
    color: '#10203B',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  calendarDetailCloseButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FBFF',
  },
  calendarDetailCloseText: {
    color: Accent.primary,
    lineHeight: 20,
  },
  calendarDetailList: {
    gap: 8,
  },
  calendarDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E3EBF7',
    borderRadius: Radius.medium,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#FBFDFF',
  },
  calendarDetailMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  calendarDetailMarkerText: {
    fontSize: 11,
    lineHeight: 12,
  },
  calendarDetailItemCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  calendarDetailClientName: {
    color: '#112746',
  },
  calendarDetailKind: {
    lineHeight: 16,
  },
  calendarDetailItemDate: {
    flexShrink: 0,
    lineHeight: 16,
  },
  recentCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#DFE7F2',
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 14,
    shadowColor: '#10203B',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  recentCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  recentCardList: {
    gap: 8,
  },
  recentCardAction: {
    borderRadius: Radius.pill,
    minHeight: 44,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
    backgroundColor: '#EDF3FF',
  },
  recentCardActionText: {
    color: Accent.primary,
  },
  notificationButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: -5,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: Accent.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    lineHeight: 12,
  },
  notificationsBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 24, 45, 0.42)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  notificationsBackdropCompact: {
    paddingHorizontal: Spacing.two,
  },
  notificationsPanel: {
    borderWidth: 1,
    borderRadius: Radius.large,
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 12,
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    shadowColor: '#10203B',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  notificationsHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  notificationsCloseButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FBFF',
  },
  notificationsCloseText: {
    color: Accent.primary,
    lineHeight: 20,
  },
  notificationsList: {
    gap: 10,
  },
  notificationItem: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 10,
    shadowColor: '#10203B',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  notificationItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  notificationIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  notificationIconEmoji: {
    fontSize: 18,
    lineHeight: 20,
  },
  notificationItemCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
    paddingTop: 1,
  },
  notificationKindText: {
    lineHeight: 16,
  },
  notificationTypePill: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  notificationTypePillText: {
    fontSize: 11,
    lineHeight: 12,
  },
  notificationDetailText: {
    lineHeight: 18,
  },
  notificationCountPill: {
    minWidth: 30,
    height: 30,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationCountPillText: {
    fontSize: 14,
    lineHeight: 16,
  },
});
