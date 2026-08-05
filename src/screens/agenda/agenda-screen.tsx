import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';

import { StatusBanner } from '@/components/feedback/status-banner';
import { ScreenContainer } from '@/components/layout/screen-container';
import { ThemedText } from '@/components/themed-text';
import { Accent, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { clientPaymentsService } from '@/services/client-payments';
import { clientsService } from '@/services/clients';
import { revisionsService } from '@/services/revisions';
import { Client, ClientPayment, Revision } from '@/types/domain';
import { calculateClientPaymentStatus } from '@/utils/client-payments';
import { calculateClientRevisionStatus } from '@/utils/client-revisions';

type AgendaMode = 'day' | 'week' | 'month';

type AgendaClientData = {
  client: Client;
  payments: ClientPayment[];
  revisions: Revision[];
};

type AgendaKind = 'revision' | 'payment';

type AgendaEvent = {
  id: string;
  kind: AgendaKind;
  clientId: string;
  clientName: string;
  date: Date;
  title: string;
  subtitle: string;
  timeLabel: string;
  color: string;
  statusLabel: string;
};

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
}

function addDays(value: Date, offset: number) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate() + offset, 0, 0, 0, 0);
}

function startOfWeekMonday(value: Date) {
  const date = startOfDay(value);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(date, diff);
}

function getDateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function formatMonthLabel(value: Date) {
  return new Intl.DateTimeFormat('es-ES', {
    month: 'long',
    year: 'numeric',
  })
    .format(value)
    .replace(/^(.)/, (match) => match.toUpperCase());
}

function formatShortDay(value: Date) {
  return new Intl.DateTimeFormat('es-ES', { weekday: 'short' })
    .format(value)
    .replace('.', '')
    .replace(/^(.)/, (match) => match.toUpperCase());
}

function formatDayNumber(value: Date) {
  return String(value.getDate());
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

function getWeekStart(value: Date) {
  const date = startOfDay(value);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(date, diff);
}

function buildMonthGrid(value: Date) {
  const year = value.getFullYear();
  const month = value.getMonth();
  const firstDay = new Date(year, month, 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array.from({ length: offset }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(day);
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function getTimeByKind(kind: AgendaKind, seed: string) {
  const hash = seed.split('').reduce((total, char) => total + char.charCodeAt(0), 0);
  const revisionTimes = ['09:00', '11:00', '18:00'];
  const paymentTimes = ['13:30', '14:00', '17:00'];

  if (kind === 'payment') {
    return paymentTimes[hash % paymentTimes.length];
  }

  return revisionTimes[hash % revisionTimes.length];
}

function getEventColor(kind: AgendaKind) {
  return kind === 'payment'
    ? { accent: '#16A34A', soft: '#ECFDF5', border: '#BBF7D0' }
    : { accent: '#D97706', soft: '#FFF7ED', border: '#FED7AA' };
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function buildAgendaEvents(clientData: AgendaClientData[], referenceDate = new Date()) {
  const today = startOfDay(referenceDate);
  const horizon = addDays(today, 30);
  const events: AgendaEvent[] = [];

  clientData.forEach(({ client, payments, revisions }) => {
    const paymentStatus = calculateClientPaymentStatus(client, payments, referenceDate);
    const revisionStatus = calculateClientRevisionStatus(client, revisions, referenceDate);

    if (paymentStatus.nextPaymentDate) {
      const nextPaymentDate = startOfDay(paymentStatus.nextPaymentDate);

      if (nextPaymentDate >= today && nextPaymentDate <= horizon) {
        const color = getEventColor('payment');

        events.push({
          id: `payment-${client.id}-${getDateKey(nextPaymentDate)}`,
          kind: 'payment',
          clientId: client.id,
          clientName: client.name,
          date: nextPaymentDate,
          title: 'Cobro mensual',
          subtitle: `Cuota de ${client.name}`,
          timeLabel: getTimeByKind('payment', client.id),
          color: color.accent,
          statusLabel: paymentStatus.isPending ? 'Pendiente' : 'Programado',
        });
      }
    }

    if (revisionStatus.nextRevisionDate) {
      const nextRevisionDate = startOfDay(revisionStatus.nextRevisionDate);

      if (nextRevisionDate >= today && nextRevisionDate <= horizon) {
        const color = getEventColor('revision');

        events.push({
          id: `revision-${client.id}-${getDateKey(nextRevisionDate)}`,
          kind: 'revision',
          clientId: client.id,
          clientName: client.name,
          date: nextRevisionDate,
          title: 'Revisión corporal',
          subtitle: `Seguimiento de ${client.name}`,
          timeLabel: getTimeByKind('revision', client.id),
          color: color.accent,
          statusLabel: revisionStatus.isPending ? 'Pendiente' : 'Programado',
        });
      }
    }
  });

  return events.sort((left, right) => left.date.getTime() - right.date.getTime() || left.timeLabel.localeCompare(right.timeLabel));
}

export function AgendaScreen() {
  const { user } = useAuth();
  const [clientData, setClientData] = useState<AgendaClientData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMode, setSelectedMode] = useState<AgendaMode>('day');
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [weekStartDate, setWeekStartDate] = useState(() => startOfWeekMonday(startOfDay(new Date())));
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1, 0, 0, 0, 0));
  const [selectedCalendarDateKey, setSelectedCalendarDateKey] = useState<string | null>(null);

  const loadAgenda = useCallback(async () => {
    if (!user?.id) {
      setClientData([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const nextClients = await clientsService.listByOwner(user.id);
      const nextClientData = await Promise.all(
        nextClients.map(async (client) => ({
          client,
          payments: await clientPaymentsService.listByClient(client.id),
          revisions: await revisionsService.listByClient(client.id),
        }))
      );

      setClientData(nextClientData);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cargar la agenda.';
      Alert.alert('Error', message);
      setClientData([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadAgenda();
  }, [loadAgenda]);

  useFocusEffect(
    React.useCallback(() => {
      void loadAgenda();
    }, [loadAgenda])
  );

  const agendaEvents = useMemo(() => buildAgendaEvents(clientData), [clientData]);
  const today = startOfDay(new Date());
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
  const calendarDays = useMemo(() => {
    const monthMap = new Map<string, { paymentCount: number; revisionCount: number }>();

    agendaEvents.forEach((event) => {
      if (event.date.getFullYear() !== calendarMonth.getFullYear() || event.date.getMonth() !== calendarMonth.getMonth()) {
        return;
      }

      const dateKey = getDateKey(event.date);
      const currentValue = monthMap.get(dateKey) ?? { paymentCount: 0, revisionCount: 0 };

      if (event.kind === 'payment') {
        currentValue.paymentCount += 1;
      } else {
        currentValue.revisionCount += 1;
      }

      monthMap.set(dateKey, currentValue);
    });

    return monthMap;
  }, [agendaEvents, calendarMonth]);
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
      return [] as AgendaEvent[];
    }

    const dateKey = getDateKey(selectedCalendarDate);

    return agendaEvents
      .filter((event) => getDateKey(event.date) === dateKey)
      .sort((left, right) => left.timeLabel.localeCompare(right.timeLabel));
  }, [agendaEvents, selectedCalendarDate]);
  const weekStart = weekStartDate;
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const selectedDayWeekStart = useMemo(() => getWeekStart(selectedDate), [selectedDate]);
  const selectedDayWeekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(selectedDayWeekStart, index)),
    [selectedDayWeekStart]
  );
  const selectedDayEvents = useMemo(
    () => agendaEvents.filter((event) => getDateKey(event.date) === getDateKey(selectedDate)),
    [agendaEvents, selectedDate]
  );
  const weekEvents = useMemo(
    () => agendaEvents.filter((event) => event.date >= weekStart && event.date < addDays(weekStart, 7)),
    [agendaEvents, weekStart]
  );
  const monthGrid = useMemo(() => buildMonthGrid(selectedDate), [selectedDate]);
  const timeSlots = useMemo(() => {
    const earliestEventHour = weekEvents.reduce((minimumHour, event) => {
      const eventHour = Number(event.timeLabel.split(':')[0]);

      if (!Number.isFinite(eventHour)) {
        return minimumHour;
      }

      return Math.min(minimumHour, eventHour);
    }, 8);

    const startHour = Math.min(8, earliestEventHour);

    return Array.from({ length: 24 - startHour }, (_, hourOffset) => `${String(startHour + hourOffset).padStart(2, '0')}:00`);
  }, [weekEvents]);

  function handlePreviousWeek() {
    setWeekStartDate((currentWeekStart) => addDays(currentWeekStart, -7));
  }

  function handleNextWeek() {
    setWeekStartDate((currentWeekStart) => addDays(currentWeekStart, 7));
  }

  function handlePreviousDay() {
    setSelectedDate((currentDate) => addDays(currentDate, -1));
  }

  function handleNextDay() {
    setSelectedDate((currentDate) => addDays(currentDate, 1));
  }

  function handlePreviousMonth() {
    setCalendarMonth((currentMonth) => new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1, 0, 0, 0, 0));
  }

  function handleNextMonth() {
    setCalendarMonth((currentMonth) => new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1, 0, 0, 0, 0));
  }

  function openCalendarDayDetail(date: Date) {
    setSelectedCalendarDateKey(getDateKey(date));
  }

  function closeCalendarDayDetail() {
    setSelectedCalendarDateKey(null);
  }

  function goToNewEvent() {
    router.push('/revisions/new');
  }

  function openClient(clientId: string) {
    router.push(`/clients/${clientId}`);
  }

  return (
    <ScreenContainer>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <ThemedText style={styles.title}>Calendario</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            Agenda de hoy
          </ThemedText>
        </View>
      </View>

      <View style={styles.modeShell}>
        {(['day', 'week', 'month'] as AgendaMode[]).map((mode) => {
          const isActive = selectedMode === mode;
          const label = mode === 'day' ? 'Día' : mode === 'week' ? 'Semana' : 'Mes';

          return (
            <Pressable
              key={mode}
              onPress={() => setSelectedMode(mode)}
              style={({ pressed }) => [styles.modeButton, isActive && styles.modeButtonActive, { opacity: pressed ? 0.92 : 1 }]}>
              <ThemedText type="smallBold" style={[styles.modeButtonText, isActive && styles.modeButtonTextActive]}>
                {label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {selectedMode === 'week' ? (
        <View style={styles.weekContainer}>
          <View style={styles.weekHeaderRow}>
            <Pressable onPress={handlePreviousWeek} style={({ pressed }) => [styles.weekNavButton, { opacity: pressed ? 0.88 : 1 }]} accessibilityLabel="Semana anterior">
              <Ionicons name="chevron-back" size={16} color={Accent.primary} />
            </Pressable>
            <ThemedText type="smallBold" style={styles.weekHeaderLabel}>
              Semana del {formatShortDay(weekStart)} {formatDayNumber(weekStart)}
            </ThemedText>
            <Pressable onPress={handleNextWeek} style={({ pressed }) => [styles.weekNavButton, { opacity: pressed ? 0.88 : 1 }]} accessibilityLabel="Semana siguiente">
              <Ionicons name="chevron-forward" size={16} color={Accent.primary} />
            </Pressable>
          </View>

          <View style={styles.weekStripCard}>
            {weekDays.map((day) => {
              const dayKey = getDateKey(day);
              const isToday = dayKey === getDateKey(today);
              const hasEvents = weekEvents.some((event) => getDateKey(event.date) === dayKey);

              return (
                <Pressable key={dayKey} onPress={() => { setSelectedDate(day); setSelectedMode('day'); }} style={[styles.weekDay, isToday && styles.weekDaySelected]}>
                  <ThemedText type="small" style={[styles.weekDayLabel, isToday && styles.weekDayLabelSelected]}>
                    {formatShortDay(day)}
                  </ThemedText>
                  <ThemedText style={[styles.weekDayNumber, isToday && styles.weekDayNumberSelected]}>{formatDayNumber(day)}</ThemedText>
                  <View style={[styles.weekDayDot, hasEvents && styles.weekDayDotVisible, isToday && styles.weekDayDotToday]} />
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {selectedMode === 'week' ? (
        <View style={styles.timelineCard}>
          <View style={styles.timelineHeaderRow}>
            <View style={styles.timelineDayLabelsSpacer} />
            {weekDays.map((day) => (
              <View key={getDateKey(day)} style={styles.timelineDayLabelCell}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.timelineDayLabel}>
                  {formatShortDay(day)}
                </ThemedText>
                <ThemedText type="smallBold" style={styles.timelineDayNumber}>
                  {formatDayNumber(day)}
                </ThemedText>
              </View>
            ))}
          </View>

          <View style={styles.timelineBody}>
            {timeSlots.map((slot) => (
              <View key={slot} style={styles.timelineRow}>
                <View style={styles.timelineTimeCell}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.timelineTimeText}>
                    {slot}
                  </ThemedText>
                </View>
                {weekDays.map((day) => {
                  const dayKey = getDateKey(day);
                  const slotHour = slot.split(':')[0];
                  const slotEvents = weekEvents.filter((event) => getDateKey(event.date) === dayKey && event.timeLabel.startsWith(`${slotHour}:`));

                  return (
                    <View key={`${dayKey}-${slot}`} style={styles.timelineCell}>
                      {slotEvents.map((event) => (
                        <Pressable
                          key={event.id}
                          onPress={() => openClient(event.clientId)}
                          style={({ pressed }) => [
                            styles.timelineEvent,
                            { backgroundColor: getEventColor(event.kind).soft, borderColor: getEventColor(event.kind).border },
                            { opacity: pressed ? 0.92 : 1 },
                          ]}>
                          <View style={[styles.timelineEventDot, { backgroundColor: event.color }]} />
                        </Pressable>
                      ))}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {selectedMode === 'month' ? (
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
              const isToday =
                currentDate.getFullYear() === today.getFullYear() &&
                currentDate.getMonth() === today.getMonth() &&
                currentDate.getDate() === today.getDate();
              const dayInfo = calendarDays.get(getDateKey(currentDate));
              const hasPayment = Boolean(dayInfo?.paymentCount);
              const hasRevision = Boolean(dayInfo?.revisionCount);

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
                      hasPayment || hasRevision ? styles.calendarDayLabelBusy : null,
                      isToday && styles.calendarDayLabelToday,
                      !hasPayment && !hasRevision ? styles.calendarDayLabelMuted : null,
                    ]}>
                    {day}
                  </ThemedText>

                  <View style={styles.calendarCellMarkers}>
                    {hasPayment ? (
                      <View style={styles.calendarMarkerRow}>
                        <View style={[styles.calendarMarkerDot, styles.calendarMarkerPayment]} />
                        {dayInfo!.paymentCount > 1 ? (
                          <ThemedText type="small" style={styles.calendarMarkerCount}>
                            {dayInfo!.paymentCount}
                          </ThemedText>
                        ) : null}
                      </View>
                    ) : null}
                    {hasRevision ? (
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
      ) : null}

      <Modal transparent visible={selectedCalendarDate !== null} animationType="fade" onRequestClose={closeCalendarDayDetail}>
        <Pressable style={styles.calendarDetailBackdrop} onPress={closeCalendarDayDetail}>
          <Pressable style={styles.calendarDetailPanel} onPress={() => null}>
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
                <ThemedText type="smallBold" style={styles.calendarDetailCloseText}>
                  ×
                </ThemedText>
              </Pressable>
            </View>

            <View style={styles.calendarDetailList}>
              {selectedCalendarItems.length === 0 ? (
                <StatusBanner tone="info" message="Ese día no tiene eventos programados." />
              ) : (
                selectedCalendarItems.map((event) => (
                  <Pressable key={event.id} onPress={() => openClient(event.clientId)} style={styles.calendarDetailItem}>
                    <View style={[styles.calendarDetailMarker, { backgroundColor: `${event.color}18`, borderColor: `${event.color}30` }]}>
                      <ThemedText type="smallBold" style={[styles.calendarDetailMarkerText, { color: event.color }]}>
                        {event.kind === 'payment' ? 'P' : 'R'}
                      </ThemedText>
                    </View>
                    <View style={styles.calendarDetailItemCopy}>
                      <ThemedText type="smallBold" style={styles.calendarDetailClientName}>
                        {event.clientName}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.calendarDetailKind}>
                        {event.title}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.calendarDetailKind}>
                        {event.subtitle}
                      </ThemedText>
                    </View>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.calendarDetailItemDate}>
                      {event.timeLabel} · {event.statusLabel}
                    </ThemedText>
                  </Pressable>
                ))
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {selectedMode === 'day' ? (
        <View style={styles.dayContainer}>
          <View style={styles.dayHeaderRow}>
            <Pressable onPress={handlePreviousDay} style={({ pressed }) => [styles.dayNavButton, { opacity: pressed ? 0.88 : 1 }]} accessibilityLabel="Día anterior">
              <Ionicons name="chevron-back" size={16} color={Accent.primary} />
            </Pressable>
            <View style={styles.dayHeaderCenter}>
              <ThemedText type="smallBold" style={styles.dayHeaderLabel}>
                {formatShortDay(selectedDate)} {formatDayNumber(selectedDate)}
              </ThemedText>
              <View style={styles.dayHeaderDot} />
            </View>
            <Pressable onPress={handleNextDay} style={({ pressed }) => [styles.dayNavButton, { opacity: pressed ? 0.88 : 1 }]} accessibilityLabel="Día siguiente">
              <Ionicons name="chevron-forward" size={16} color={Accent.primary} />
            </Pressable>
          </View>

          <View style={styles.dayStripCard}>
            {selectedDayWeekDays.map((day) => {
              const dayKey = getDateKey(day);
              const isSelected = dayKey === getDateKey(selectedDate);
              const hasEvents = agendaEvents.some((event) => getDateKey(event.date) === dayKey);

              return (
                <Pressable key={dayKey} onPress={() => setSelectedDate(day)} style={[styles.weekDay, isSelected && styles.weekDaySelected]}>
                  <ThemedText type="small" style={[styles.weekDayLabel, isSelected && styles.weekDayLabelSelected]}>
                    {formatShortDay(day)}
                  </ThemedText>
                  <ThemedText style={[styles.weekDayNumber, isSelected && styles.weekDayNumberSelected]}>{formatDayNumber(day)}</ThemedText>
                  <View style={[styles.weekDayDot, hasEvents && styles.weekDayDotVisible, isSelected && styles.weekDayDotToday]} />
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {selectedMode === 'day' ? (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <ThemedText style={styles.sectionTitle}>Agenda del día</ThemedText>
            </View>
          </View>

          {isLoading ? (
            <StatusBanner tone="info" loading message="Sincronizando agenda." />
          ) : selectedDayEvents.length === 0 ? (
            <StatusBanner tone="info" message="No hay eventos para este día." />
          ) : (
            selectedDayEvents.map((event, index) => (
              <Pressable
                key={event.id}
                onPress={() => openClient(event.clientId)}
                style={({ pressed }) => [
                  styles.dayRow,
                  index !== selectedDayEvents.length - 1 && styles.dayRowSpacing,
                  { opacity: pressed ? 0.92 : 1 },
                ]}>
                <View style={[styles.dayRowAccent, { backgroundColor: event.color }]} />
                <View style={styles.dayRowTime}>
                  <ThemedText type="smallBold" style={styles.dayRowTimeText}>
                    {event.timeLabel}
                  </ThemedText>
                  <View style={[styles.dayRowAvatar, { backgroundColor: `${event.color}18` }]}>
                    <ThemedText type="smallBold" style={[styles.dayRowAvatarText, { color: event.color }]}>
                      {getInitials(event.clientName) || event.clientName.charAt(0).toUpperCase()}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.dayRowInfo}>
                  <ThemedText type="smallBold" style={styles.dayRowTitle} numberOfLines={1}>
                    {event.clientName}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {event.title}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {event.subtitle}
                  </ThemedText>
                </View>
                <View style={styles.dayRowStatusWrap}>
                  <View style={[styles.dayRowStatus, { backgroundColor: `${event.color}12`, borderColor: `${event.color}24` }]}>
                    <ThemedText type="smallBold" style={[styles.dayRowStatusText, { color: event.color }]}>
                      {event.statusLabel}
                    </ThemedText>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#8AA0C2" />
                </View>
              </Pressable>
            ))
          )}
        </View>
      ) : null}

      {!isLoading && agendaEvents.length === 0 ? (
        <StatusBanner tone="info" message="Aún no hay eventos programados para mostrar en la agenda." />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingBottom: 8,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: '#10203B',
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    lineHeight: 18,
  },
  modeShell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: '#F4F7FC',
    borderWidth: 1,
    borderColor: '#E0E8F4',
    padding: 4,
    gap: 4,
    marginTop: 8,
  },
  modeButton: {
    flex: 1,
    height: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButtonActive: {
    backgroundColor: Accent.primary,
  },
  modeButtonText: {
    color: '#5F6E87',
  },
  modeButtonTextActive: {
    color: '#FFFFFF',
  },
  weekContainer: {
    marginTop: 12,
    gap: 8,
  },
  weekHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  weekHeaderLabel: {
    flex: 1,
    textAlign: 'center',
    color: '#10203B',
  },
  weekNavButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7FAFF',
  },
  weekStripCard: {
    marginTop: 0,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E3EAF5',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  weekDay: {
    flex: 1,
    minWidth: 0,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 2,
  },
  weekDaySelected: {
    backgroundColor: Accent.primary,
  },
  weekDayLabel: {
    color: '#5F6E87',
  },
  weekDayLabelSelected: {
    color: '#DDE7FF',
  },
  weekDayNumber: {
    color: '#112746',
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '700',
  },
  weekDayNumberSelected: {
    color: '#FFFFFF',
  },
  weekDayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'transparent',
  },
  weekDayDotVisible: {
    backgroundColor: '#8AA0C2',
  },
  weekDayDotToday: {
    backgroundColor: '#FFFFFF',
  },
  dayContainer: {
    marginTop: 12,
    gap: 8,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dayHeaderCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  dayHeaderLabel: {
    color: '#10203B',
    textTransform: 'capitalize',
  },
  dayHeaderDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Accent.primary,
  },
  dayNavButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7FAFF',
  },
  dayStripCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E3EAF5',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timelineCard: {
    marginTop: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E3EAF5',
    backgroundColor: '#FFFFFF',
    padding: 2,
    gap: 2,
  },
  timelineHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 1,
  },
  timelineDayLabelsSpacer: {
    width: 40,
  },
  timelineDayLabelCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  timelineDayLabel: {
    color: '#6A7891',
  },
  timelineBody: {
    gap: 0,
  },
  timelineRow: {
    flexDirection: 'row',
    minHeight: 18,
  },
  timelineTimeCell: {
    width: 28,
    alignItems: 'flex-end',
    paddingRight: 3,
    paddingTop: 0,
  },
  timelineTimeText: {
    fontSize: 8,
    lineHeight: 9,
  },
  timelineCell: {
    flex: 1,
    minHeight: 18,
    borderLeftWidth: 1,
    borderLeftColor: '#F0F4FA',
    paddingHorizontal: 1,
    paddingVertical: 0,
    gap: 0,
    justifyContent: 'center',
  },
  timelineEvent: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 0,
    paddingVertical: 0,
    alignSelf: 'center',
    width: 8,
    height: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineEventDot: {
    width: 2,
    height: 2,
    borderRadius: 1,
  },
  calendarCard: {
    marginTop: 12,
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
    marginTop: 4,
  },
  calendarNavButton: {
    width: 30,
    height: 30,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D4E3FA',
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
    marginTop: 14,
    marginBottom: 12,
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
  },
  calendarCellSpacer: {
    width: '13%',
    aspectRatio: 1,
  },
  calendarCell: {
    width: '13%',
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5ECF7',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  calendarCellBusy: {
    backgroundColor: '#FAFCFF',
    justifyContent: 'flex-start',
    paddingTop: 10,
  },
  calendarCellToday: {
    borderColor: Accent.primary,
  },
  calendarDayLabel: {
    color: '#112746',
  },
  calendarDayLabelBusy: {
    fontSize: 11,
    lineHeight: 13,
  },
  calendarDayLabelMuted: {
    color: '#9DB0D1',
  },
  calendarDayLabelToday: {
    color: Accent.primary,
  },
  calendarCellMarkers: {
    gap: 6,
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
  calendarMarkerCount: {
    color: '#60738F',
    fontSize: 11,
    lineHeight: 12,
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
  sectionCard: {
    marginTop: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E3EAF5',
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  sectionTitle: {
    color: '#10203B',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E8EEF6',
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#FBFDFF',
  },
  dayRowSpacing: {
    marginBottom: 8,
  },
  dayRowAccent: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 999,
  },
  dayRowTime: {
    width: 50,
    alignItems: 'center',
    gap: 6,
  },
  dayRowTimeText: {
    color: '#10203B',
    lineHeight: 16,
  },
  dayRowAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayRowAvatarText: {
    fontSize: 14,
    lineHeight: 16,
  },
  dayRowInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  dayRowTitle: {
    color: '#10203B',
  },
  dayRowStatusWrap: {
    alignItems: 'center',
    gap: 4,
  },
  dayRowStatus: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dayRowStatusText: {
    fontSize: 12,
    lineHeight: 14,
  },
});