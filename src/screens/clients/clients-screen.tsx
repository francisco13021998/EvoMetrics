import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';

import { StatusBanner } from '@/components/feedback/status-banner';
import { AppButton } from '@/components/forms/app-button';
import { ScreenContainer } from '@/components/layout/screen-container';
import { ClientRow } from '@/components/surface/client-row';
import { DashboardMetricCard } from '@/components/surface/dashboard-metric-card';
import { ThemedText } from '@/components/themed-text';
import { Accent, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { clientPaymentsService } from '@/services/client-payments';
import { clientsService } from '@/services/clients';
import { syncDeviceNotifications } from '@/services/device-notifications';
import { revisionsService } from '@/services/revisions';
import { Client } from '@/types/domain';
import { ClientDashboardData, buildDashboardNotifications, formatDashboardNotificationDate } from '@/utils/client-notifications';
import { calculateClientPaymentStatus, calculateMonthlyRevenueFromClients } from '@/utils/client-payments';
import { calculateClientRevisionStatus } from '@/utils/client-revisions';

function getNotificationPresentation(kind: 'payment' | 'revision') {
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
  const { user } = useAuth();
  const theme = useTheme();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientData, setClientData] = useState<ClientDashboardData[]>([]);
  const [notifications, setNotifications] = useState<ReturnType<typeof buildDashboardNotifications>>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [isCalendarDetailOpen, setIsCalendarDetailOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [selectedCalendarDateKey, setSelectedCalendarDateKey] = useState<string | null>(null);

  const userName = (user?.user_metadata?.fullName as string | undefined)?.trim() || user?.email?.split('@')[0] || 'Usuario';
  const clinicName = (user?.user_metadata?.clinicName as string | undefined)?.trim() || null;
  const syncStatus = isLoadingClients ? 'Sincronizando...' : clientsError ? 'Requiere revisión' : 'Sincronizado';
  const activeClients = clients.filter((client) => client.estado === 'activo');
  const monthlyRevenue = calculateMonthlyRevenueFromClients(activeClients);
  const pendingNotificationCount = notifications.length;
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
    .slice(0, 5);

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

      const nextNotifications = buildDashboardNotifications(nextClientData);

      setClientData(nextClientData);
      setNotifications(nextNotifications);
      void syncDeviceNotifications(nextClientData);
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

  function goToClientsList() {
    router.push('/clientes');
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
    <ScreenContainer>
      <View style={styles.heroPanel}>
        <View style={styles.brandStrip}>
          <View style={styles.brandBadge}>
            <Image source={require('../../../assets/branding/logo-evometrics.png')} style={styles.brandLogo} resizeMode="contain" />
          </View>
          <View style={styles.brandCopy}>
            <ThemedText type="label" style={styles.brandEyebrow}>
              Dashboard
            </ThemedText>
            <ThemedText type="small" style={styles.brandText}>
              Control de clientes EvoMetrics
            </ThemedText>
          </View>
          <View style={styles.brandActions}>
            <Pressable
              onPress={openClientPaymentNotifications}
              accessibilityLabel="Notificaciones de pagos"
              style={({ pressed }) => [
                styles.notificationButton,
                {
                  borderColor: theme.backgroundSelected,
                  backgroundColor: pressed ? '#F6F9FE' : '#FFFFFF',
                  opacity: pressed ? 0.92 : 1,
                },
              ]}>
              <ThemedText type="smallBold" style={styles.notificationIcon}>🔔</ThemedText>
              {pendingNotificationCount > 0 ? (
                <View style={styles.notificationBadge}>
                  <ThemedText type="smallBold" style={styles.notificationBadgeText}>
                    {pendingNotificationCount > 99 ? '99+' : pendingNotificationCount}
                  </ThemedText>
                </View>
              ) : null}
            </Pressable>
            <AppButton
              label="Salir"
              variant="ghost"
              size="compact"
              onPress={handleLogout}
              loading={isSigningOut}
              fullWidth={false}
            />
          </View>
        </View>

        <View style={styles.heroTopRow}>
          <ThemedText type="label" style={styles.heroEyebrow}>
            Resumen operativo
          </ThemedText>
          <View style={styles.heroIdentity}>
            <ThemedText style={styles.heroTitle}>{userName}</ThemedText>
            <View style={styles.heroMetaRow}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.heroSubtitle}>
                {clinicName || 'Centro o marca pendiente'}
              </ThemedText>
              <View style={styles.statusPill}>
                <View style={[styles.statusDot, clientsError ? styles.statusDotWarning : styles.statusDotOk]} />
                <ThemedText type="small" style={styles.statusText}>
                  {syncStatus}
                </ThemedText>
              </View>
            </View>
          </View>
        </View>

        {/* Métricas en una fila */}
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
          />
        </View>

        <View style={styles.recentCard}>
          <View style={styles.recentCardHeader}>
            <ThemedText type="label" style={styles.recentCardTitle}>
              Clientes recientes
            </ThemedText>
            <Pressable
              onPress={goToClientsList}
              style={({ pressed }) => [
                styles.recentCardAction,
                {
                  borderColor: theme.backgroundSelected,
                  backgroundColor: pressed ? '#F4F8FE' : '#FFFFFF',
                  opacity: pressed ? 0.92 : 1,
                },
              ]}>
              <ThemedText type="smallBold" style={styles.recentCardActionText}>
                Ver todos
              </ThemedText>
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
            <ThemedText type="label" style={styles.calendarLabel}>
              Calendario
            </ThemedText>
          </View>

          <View style={styles.calendarControlsRow}>
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

          <View style={styles.calendarWeekRow}>
            {calendarWeekdayLabels.map((label) => (
              <ThemedText key={label} type="small" themeColor="textSecondary" style={styles.calendarWeekLabel}>
                {label}
              </ThemedText>
            ))}
          </View>

          <View style={styles.calendarGrid}>
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

      </View>

      <Modal transparent visible={isCalendarDetailOpen} animationType="fade" onRequestClose={closeCalendarDayDetail}>
        <Pressable style={styles.calendarDetailBackdrop} onPress={closeCalendarDayDetail}>
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
        <Pressable style={styles.notificationsBackdrop} onPress={closeClientPaymentNotifications}>
          <Pressable style={[styles.notificationsPanel, { borderColor: theme.backgroundSelected }]} onPress={() => null}>
            <View style={styles.notificationsList}>
              {notifications.length === 0 ? (
                <StatusBanner tone="info" message="Todo está al corriente por ahora." />
              ) : (
                notifications.map((notification) => (
                  (() => {
                    const presentation = getNotificationPresentation(notification.kind);

                    return (
                  <Pressable
                    key={`${notification.kind}-${notification.clientId}`}
                    onPress={() => (notification.kind === 'payment' ? goToClientPayments(notification.clientId) : goToClientProfile(notification.clientId))}
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
                        <ThemedText type="smallBold">{notification.clientName}</ThemedText>
                        <ThemedText type="small" style={[styles.notificationKindText, { color: presentation.text }]}>
                          {presentation.title}
                        </ThemedText>
                      </View>
                      <View style={[styles.notificationTypePill, { borderColor: presentation.border, backgroundColor: presentation.accentSoft }]}>
                        <ThemedText type="smallBold" style={[styles.notificationTypePillText, { color: presentation.text }]}>
                          {notification.kind === 'payment' ? 'Cobro' : 'Revisión'}
                        </ThemedText>
                      </View>
                    </View>
                    {notification.kind === 'payment' ? (
                      <>
                        <ThemedText type="small" themeColor="textSecondary" style={styles.notificationDetailText}>
                          Último pago: {formatDashboardNotificationDate(notification.lastDate)}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary" style={styles.notificationDetailText}>
                          Siguiente vencimiento: {formatDashboardNotificationDate(notification.nextDate)}
                        </ThemedText>
                      </>
                    ) : (
                      <>
                        <ThemedText type="small" themeColor="textSecondary" style={styles.notificationDetailText}>
                          Última revisión: {formatDashboardNotificationDate(notification.lastDate)}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary" style={styles.notificationDetailText}>
                          Siguiente revisión: {formatDashboardNotificationDate(notification.nextDate)}
                        </ThemedText>
                      </>
                    )}
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
  heroPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.large,
    borderWidth: 1,
    borderColor: '#D8E5F8',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 12,
    shadowColor: '#12336E',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  brandStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E1EAF8',
  },
  brandBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D6E2F8',
    backgroundColor: '#F8FBFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogo: {
    width: 32,
    height: 32,
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
  brandEyebrow: {
    color: '#1E4FBF',
  },
  brandText: {
    color: '#3F5780',
    lineHeight: 18,
  },
  heroTopRow: {
    gap: 6,
  },
  heroIdentity: {
    gap: 5,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  heroEyebrow: {
    color: Accent.primary,
  },
  heroTitle: {
    color: '#10203B',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  heroSubtitle: {
    flex: 1,
    lineHeight: 19,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 6,
    backgroundColor: '#F3F8FF',
    borderWidth: 1,
    borderColor: '#D8E6FB',
    borderRadius: Radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
  },
  statusDotOk: {
    backgroundColor: '#1F57D6',
  },
  statusDotWarning: {
    backgroundColor: '#DC5B5B',
  },
  statusText: {
    color: '#27406A',
    lineHeight: 17,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  calendarCard: {
    borderRadius: Radius.large,
    borderWidth: 1,
    borderColor: '#D9E5F5',
    backgroundColor: '#FAFCFF',
    padding: 12,
    paddingBottom: 18,
    gap: 10,
    shadowColor: '#10203B',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  calendarHeader: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarLabel: {
    color: Accent.primary,
    textAlign: 'center',
  },
  calendarControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 6,
  },
  calendarNavButton: {
    width: 30,
    height: 30,
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
    color: '#27406A',
    textTransform: 'capitalize',
  },
  calendarWeekRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 4,
    marginTop: 12,
    marginBottom: 8,
  },
  calendarWeekLabel: {
    width: '13%',
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 4,
    rowGap: 6,
  },
  calendarCellSpacer: {
    width: '13%',
    aspectRatio: 1,
  },
  calendarCell: {
    width: '13%',
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: '#E5ECF7',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  calendarCellPressable: {
    flex: 1,
  },
  calendarCellToday: {
    borderColor: Accent.primary,
    backgroundColor: '#F4F8FE',
  },
  calendarCellBusy: {
    backgroundColor: '#FAFCFF',
  },
  calendarDayLabel: {
    color: '#112746',
    lineHeight: 16,
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
    marginBottom: 12,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  calendarDetailPanel: {
    borderWidth: 1,
    borderRadius: Radius.large,
    backgroundColor: '#FFFFFF',
    padding: Spacing.three,
    gap: Spacing.three,
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
    borderRadius: Radius.large,
    borderWidth: 1,
    borderColor: '#D9E5F5',
    backgroundColor: '#FAFCFF',
    padding: 12,
    gap: 10,
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
    gap: 8,
  },
  recentCardTitle: {
    color: Accent.primary,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  recentCardList: {
    gap: 6,
  },
  recentCardAction: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentCardActionText: {
    color: Accent.primary,
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationIcon: {
    color: Accent.primary,
    fontSize: 18,
    lineHeight: 18,
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
    backgroundColor: 'rgba(16, 32, 59, 0.18)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  notificationsPanel: {
    borderWidth: 1,
    borderRadius: Radius.large,
    backgroundColor: '#FFFFFF',
    padding: Spacing.three,
    gap: Spacing.three,
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
  },
  notificationsHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  notificationsCloseButton: {
    width: 32,
    height: 32,
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
    gap: Spacing.two,
  },
  notificationItem: {
    borderWidth: 1,
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: 8,
    shadowColor: '#10203B',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  notificationItemTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
});