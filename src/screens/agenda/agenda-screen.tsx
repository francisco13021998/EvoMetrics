import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { StatusBanner } from '@/components/feedback/status-banner';
import { ScreenContainer } from '@/components/layout/screen-container';
import { ThemedText } from '@/components/themed-text';
import { Accent, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { clientPaymentsService } from '@/services/client-payments';
import { clientsService } from '@/services/clients';
import { eventsService } from '@/services/events';
import { revisionsService } from '@/services/revisions';
import { Client, ClientPayment, Event, EventOccurrence, Revision } from '@/types/domain';
import { calculateClientPaymentStatus } from '@/utils/client-payments';
import { calculateClientRevisionStatus } from '@/utils/client-revisions';

type AgendaMode = 'day' | 'week' | 'month';

type AgendaClientData = {
  client: Client;
  payments: ClientPayment[];
  revisions: Revision[];
};

type AgendaKind = 'revision' | 'payment' | 'event';

type AgendaEvent = {
  id: string;
  kind: AgendaKind;
  clientId: string | null;
  eventId: string | null;
  occurrenceId: string | null;
  clientName: string;
  date: Date;
  title: string;
  subtitle: string;
  timeLabel: string;
  color: string;
  statusLabel: string;
};

function formatTimeLabel(value: Date) {
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

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

function getTimeByKind(kind: AgendaKind, seed: string) {
  const hash = seed.split('').reduce((total, char) => total + char.charCodeAt(0), 0);
  const revisionTimes = ['09:00', '11:00', '18:00'];
  const paymentTimes = ['13:30', '14:00', '17:00'];
  const eventTimes = ['08:00', '10:30', '16:00'];

  if (kind === 'payment') {
    return paymentTimes[hash % paymentTimes.length];
  }

  if (kind === 'event') {
    return eventTimes[hash % eventTimes.length];
  }

  return revisionTimes[hash % revisionTimes.length];
}

function getEventColor(kind: AgendaKind) {
  if (kind === 'payment') {
    return { accent: '#16A34A', soft: '#ECFDF5', border: '#BBF7D0' };
  }

  if (kind === 'event') {
    return { accent: '#2563EB', soft: '#EFF6FF', border: '#BFDBFE' };
  }

  return { accent: '#D97706', soft: '#FFF7ED', border: '#FED7AA' };
}

function getEventStatusLabel(status: EventOccurrence['status']) {
  if (status === 'completed') {
    return 'Completado';
  }

  if (status === 'cancelled') {
    return 'Cancelado';
  }

  if (status === 'rescheduled') {
    return 'Reprogramado';
  }

  return 'Programado';
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

type AgendaBuildInput = {
  clientData: AgendaClientData[];
  events: Event[];
  occurrences: EventOccurrence[];
};

function buildAgendaEvents({ clientData, events, occurrences }: AgendaBuildInput, referenceDate = new Date()) {
  const today = startOfDay(referenceDate);
  const horizon = addDays(today, 30);
  const agendaEvents: AgendaEvent[] = [];
  const clientById = new Map(clientData.map(({ client }) => [client.id, client] as const));
  const eventById = new Map(events.map((event) => [event.id, event] as const));

  clientData.forEach(({ client, payments, revisions }) => {
    const paymentStatus = calculateClientPaymentStatus(client, payments, referenceDate);
    const revisionStatus = calculateClientRevisionStatus(client, revisions, referenceDate);

    if (paymentStatus.nextPaymentDate) {
      const nextPaymentDate = startOfDay(paymentStatus.nextPaymentDate);

      if (nextPaymentDate >= today && nextPaymentDate <= horizon) {
        const color = getEventColor('payment');

        agendaEvents.push({
          id: `payment-${client.id}-${getDateKey(nextPaymentDate)}`,
          kind: 'payment',
          clientId: client.id,
          eventId: null,
          occurrenceId: null,
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

        agendaEvents.push({
          id: `revision-${client.id}-${getDateKey(nextRevisionDate)}`,
          kind: 'revision',
          clientId: client.id,
          eventId: null,
          occurrenceId: null,
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

  occurrences.forEach((occurrence) => {
    const event = eventById.get(occurrence.eventId);

    if (!event) {
      return;
    }

    const plannedStartAt = new Date(occurrence.plannedStartAt);

    if (Number.isNaN(plannedStartAt.getTime()) || plannedStartAt < today || plannedStartAt > horizon) {
      return;
    }

    const client = event.clientId ? clientById.get(event.clientId) ?? null : null;

    agendaEvents.push({
      id: `event-${occurrence.id}`,
      kind: 'event',
      clientId: client?.id ?? event.clientId,
      eventId: event.id,
      occurrenceId: occurrence.id,
      clientName: client?.name ?? 'Evento',
      date: plannedStartAt,
      title: event.title,
      subtitle: event.description ?? event.location ?? 'Evento programado',
      timeLabel: formatTimeLabel(plannedStartAt),
      color: getEventColor('event').accent,
      statusLabel: getEventStatusLabel(occurrence.status),
    });
  });

  return agendaEvents.sort((left, right) => left.date.getTime() - right.date.getTime() || left.timeLabel.localeCompare(right.timeLabel));
}

export function AgendaScreen() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isCompactWidth = width < 390;
  const [clientData, setClientData] = useState<AgendaClientData[]>([]);
  const [eventSeries, setEventSeries] = useState<Event[]>([]);
  const [eventOccurrences, setEventOccurrences] = useState<EventOccurrence[]>([]);
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
      const today = startOfDay(new Date());
      const horizon = addDays(today, 30);
      const horizonEnd = new Date(horizon.getFullYear(), horizon.getMonth(), horizon.getDate(), 23, 59, 59, 999);
      const nextClients = await clientsService.listByOwner(user.id);
      const nextClientData = await Promise.all(
        nextClients.map(async (client) => ({
          client,
          payments: await clientPaymentsService.listByClient(client.id),
          revisions: await revisionsService.listByClient(client.id),
        }))
      );
      const nextEventSeries = await eventsService.listByOwner(user.id);

      await Promise.all(
        nextEventSeries.map((event) => eventsService.syncOccurrencesForEvent(event.id, user.id, today, horizonEnd))
      );

      const nextEventOccurrences = await eventsService.listOccurrencesByOwner(
        user.id,
        today.toISOString(),
        horizonEnd.toISOString()
      );

      setClientData(nextClientData);
      setEventSeries(nextEventSeries);
      setEventOccurrences(nextEventOccurrences);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cargar la agenda.';
      Alert.alert('Error', message);
      setClientData([]);
      setEventSeries([]);
      setEventOccurrences([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadAgenda();
  }, [loadAgenda]);

  useFocusEffect(
    React.useCallback(() => {
      setSelectedMode('day');
      void loadAgenda();
    }, [loadAgenda])
  );

  const agendaEvents = useMemo(
    () => buildAgendaEvents({ clientData, events: eventSeries, occurrences: eventOccurrences }),
    [clientData, eventSeries, eventOccurrences]
  );
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
    const monthMap = new Map<string, { paymentCount: number; revisionCount: number; eventCount: number }>();

    agendaEvents.forEach((event) => {
      if (event.date.getFullYear() !== calendarMonth.getFullYear() || event.date.getMonth() !== calendarMonth.getMonth()) {
        return;
      }

      const dateKey = getDateKey(event.date);
      const currentValue = monthMap.get(dateKey) ?? { paymentCount: 0, revisionCount: 0, eventCount: 0 };

      if (event.kind === 'payment') {
        currentValue.paymentCount += 1;
      } else if (event.kind === 'revision') {
        currentValue.revisionCount += 1;
      } else {
        currentValue.eventCount += 1;
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

  function openEventForm() {
    router.push('/events/new');
  }

  function openAgendaItem(event: AgendaEvent) {
    if (event.kind === 'event' && event.occurrenceId) {
      router.push(`/events/occurrences/${event.occurrenceId}`);
      return;
    }

    if (event.clientId) {
      openClient(event.clientId);
    }
  }

  function openClient(clientId: string) {
    if (!clientId) {
      return;
    }

    router.push(`/clients/${clientId}`);
  }

  return (
    <ScreenContainer contentStyle={styles.screenContent}>
      <View style={styles.headerPanel}>
        <View style={styles.headerRow}>
          <View style={styles.headerIcon}>
            <Ionicons name="calendar-outline" size={25} color={Accent.primary} />
          </View>
          <View style={styles.headerCopy}>
            <ThemedText style={styles.title}>Agenda</ThemedText>
          </View>
          <Pressable
            onPress={openEventForm}
            style={({ pressed }) => [styles.createEventButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Crear evento">
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </Pressable>
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
              accessibilityRole="button"
              accessibilityLabel={`Ver agenda por ${label.toLowerCase()}`}
              accessibilityState={{ selected: isActive }}
              style={({ pressed }) => [styles.modeButton, isActive && styles.modeButtonActive, pressed && styles.pressed]}>
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
            <Pressable onPress={handlePreviousWeek} style={({ pressed }) => [styles.navButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Semana anterior">
              <Ionicons name="chevron-back" size={18} color={Accent.primary} />
            </Pressable>
            <ThemedText type="smallBold" style={styles.weekHeaderLabel}>
              Semana del {formatShortDay(weekStart)} {formatDayNumber(weekStart)}
            </ThemedText>
            <Pressable onPress={handleNextWeek} style={({ pressed }) => [styles.navButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Semana siguiente">
              <Ionicons name="chevron-forward" size={18} color={Accent.primary} />
            </Pressable>
          </View>

          <View style={styles.weekStripCard}>
            {weekDays.map((day) => {
              const dayKey = getDateKey(day);
              const isToday = dayKey === getDateKey(today);
              const hasEvents = weekEvents.some((event) => getDateKey(event.date) === dayKey);

              return (
                <Pressable
                  key={dayKey}
                  onPress={() => { setSelectedDate(day); setSelectedMode('day'); }}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatSpanishLongDate(day)}${hasEvents ? ', con eventos' : ', sin eventos'}`}
                  style={({ pressed }) => [styles.weekDay, isToday && styles.weekDaySelected, pressed && styles.pressed]}>
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
                          onPress={() => openAgendaItem(event)}
                          accessibilityRole="button"
                          accessibilityLabel={`${event.timeLabel}, ${event.title}, ${event.clientName}`}
                          style={({ pressed }) => [
                            styles.timelineEvent,
                            { backgroundColor: getEventColor(event.kind).soft, borderColor: getEventColor(event.kind).border },
                            pressed && styles.pressed,
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
            <View>
              <ThemedText style={styles.calendarTitle}>Próximos vencimientos</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Pagos, revisiones y eventos programados</ThemedText>
            </View>
          </View>

          <View style={[styles.calendarControlsRow, isCompactWidth && styles.calendarControlsRowCompact]}>
            <Pressable onPress={handlePreviousMonth} style={({ pressed }) => [styles.calendarNavButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Mes anterior">
              <Ionicons name="chevron-back" size={16} color={Accent.primary} />
            </Pressable>
            <ThemedText type="smallBold" style={styles.calendarMonthLabel}>
              {calendarMonthLabel}
            </ThemedText>
            <Pressable onPress={handleNextMonth} style={({ pressed }) => [styles.calendarNavButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Mes siguiente">
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
              const isToday =
                currentDate.getFullYear() === today.getFullYear() &&
                currentDate.getMonth() === today.getMonth() &&
                currentDate.getDate() === today.getDate();
              const dayInfo = calendarDays.get(getDateKey(currentDate));
              const hasPayment = Boolean(dayInfo?.paymentCount);
              const hasRevision = Boolean(dayInfo?.revisionCount);
              const hasEvent = Boolean(dayInfo?.eventCount);

              return (
                <Pressable
                  key={`day-${day}`}
                  onPress={() => openCalendarDayDetail(currentDate)}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatSpanishLongDate(currentDate)}${hasPayment || hasRevision || hasEvent ? ', con elementos programados' : ', sin elementos programados'}`}
                  style={({ pressed }) => [
                    styles.calendarCell,
                    isToday && styles.calendarCellToday,
                    hasPayment || hasRevision || hasEvent ? styles.calendarCellBusy : null,
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText
                    type="smallBold"
                    style={[
                      styles.calendarDayLabel,
                      hasPayment || hasRevision || hasEvent ? styles.calendarDayLabelBusy : null,
                      isToday && styles.calendarDayLabelToday,
                      !hasPayment && !hasRevision && !hasEvent ? styles.calendarDayLabelMuted : null,
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
                    {hasEvent ? (
                      <View style={styles.calendarMarkerRow}>
                        <View style={[styles.calendarMarkerDot, styles.calendarMarkerEvent]} />
                        {dayInfo!.eventCount > 1 ? (
                          <ThemedText type="small" style={styles.calendarMarkerCount}>
                            {dayInfo!.eventCount}
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
              <Pressable onPress={closeCalendarDayDetail} accessibilityRole="button" accessibilityLabel="Cerrar detalle del día" style={({ pressed }) => [styles.calendarDetailCloseButton, pressed && styles.pressed]}>
                <Ionicons name="close" size={21} color={Accent.primary} />
              </Pressable>
            </View>

            <View style={styles.calendarDetailList}>
              {selectedCalendarItems.length === 0 ? (
                <StatusBanner tone="info" message="Ese día no tiene eventos programados." />
              ) : (
                selectedCalendarItems.map((event) => (
                  <Pressable
                    key={event.id}
                    onPress={() => openAgendaItem(event)}
                    accessibilityRole="button"
                    accessibilityLabel={`${event.timeLabel}, ${event.title}, ${event.clientName}, ${event.statusLabel}`}
                    style={({ pressed }) => [styles.calendarDetailItem, pressed && styles.pressed]}>
                    <View style={[styles.calendarDetailMarker, { backgroundColor: `${event.color}18`, borderColor: `${event.color}30` }]}>
                      <ThemedText type="smallBold" style={[styles.calendarDetailMarkerText, { color: event.color }]}>
                        {event.kind === 'payment' ? 'P' : event.kind === 'revision' ? 'R' : 'E'}
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
            <Pressable onPress={handlePreviousDay} style={({ pressed }) => [styles.navButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Día anterior">
              <Ionicons name="chevron-back" size={18} color={Accent.primary} />
            </Pressable>
            <View style={styles.dayHeaderCenter}>
              <ThemedText type="smallBold" style={styles.dayHeaderLabel}>
                {formatShortDay(selectedDate)} {formatDayNumber(selectedDate)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.dayHeaderMeta}>
                {selectedDayEvents.length} {selectedDayEvents.length === 1 ? 'elemento' : 'elementos'}
              </ThemedText>
            </View>
            <Pressable onPress={handleNextDay} style={({ pressed }) => [styles.navButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Día siguiente">
              <Ionicons name="chevron-forward" size={18} color={Accent.primary} />
            </Pressable>
          </View>

          <View style={styles.dayStripCard}>
            {selectedDayWeekDays.map((day) => {
              const dayKey = getDateKey(day);
              const isSelected = dayKey === getDateKey(selectedDate);
              const hasEvents = agendaEvents.some((event) => getDateKey(event.date) === dayKey);

              return (
                <Pressable
                  key={dayKey}
                  onPress={() => setSelectedDate(day)}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatSpanishLongDate(day)}${hasEvents ? ', con eventos' : ', sin eventos'}`}
                  accessibilityState={{ selected: isSelected }}
                  style={({ pressed }) => [styles.weekDay, isSelected && styles.weekDaySelected, pressed && styles.pressed]}>
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
          {isLoading ? (
            <StatusBanner tone="info" loading message="Sincronizando agenda." />
          ) : selectedDayEvents.length === 0 ? (
            <StatusBanner tone="info" message="No hay eventos para este día." />
          ) : (
            selectedDayEvents.map((event, index) => (
              <Pressable
                key={event.id}
                onPress={() => openAgendaItem(event)}
                accessibilityRole="button"
                accessibilityLabel={`${event.timeLabel}, ${event.title}, ${event.clientName}, ${event.statusLabel}`}
                style={({ pressed }) => [
                  styles.dayRow,
                  index !== selectedDayEvents.length - 1 && styles.dayRowSpacing,
                  pressed && styles.dayRowPressed,
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
  screenContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },
  headerPanel: {
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F0FF',
    borderWidth: 1,
    borderColor: '#D2E0FA',
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  createEventButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Accent.primary,
  },
  pressed: {
    opacity: 0.74,
    transform: [{ scale: 0.98 }],
  },
  title: {
    color: '#10203B',
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  modeShell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#EAF0FA',
    borderWidth: 1,
    borderColor: '#D9E3F1',
    padding: 4,
    gap: 4,
  },
  modeButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButtonActive: {
    backgroundColor: Accent.primary,
  },
  modeButtonText: {
    color: '#526179',
    fontSize: 13,
    lineHeight: 16,
  },
  modeButtonTextActive: {
    color: '#FFFFFF',
  },
  weekContainer: {
    gap: 10,
  },
  weekHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  weekHeaderLabel: {
    flex: 1,
    textAlign: 'center',
    color: '#10203B',
    fontSize: 15,
    lineHeight: 19,
  },
  navButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8E4F6',
  },
  weekStripCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DFE7F2',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 9,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 5,
  },
  weekDay: {
    flex: 1,
    minWidth: 0,
    minHeight: 62,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    gap: 3,
  },
  weekDaySelected: {
    backgroundColor: Accent.primary,
  },
  weekDayLabel: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 14,
  },
  weekDayLabelSelected: {
    color: '#DCE7FF',
  },
  weekDayNumber: {
    color: '#112746',
    fontSize: 17,
    lineHeight: 20,
    fontWeight: '800',
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
    backgroundColor: '#91A0B5',
  },
  weekDayDotToday: {
    backgroundColor: '#FFFFFF',
  },
  dayContainer: {
    gap: 10,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  dayHeaderCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
  },
  dayHeaderLabel: {
    color: '#10203B',
    textTransform: 'capitalize',
    fontSize: 16,
    lineHeight: 20,
  },
  dayHeaderMeta: {
    lineHeight: 16,
  },
  dayStripCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DFE7F2',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 5,
  },
  timelineCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DFE7F2',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 6,
  },
  timelineHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 6,
  },
  timelineDayLabelsSpacer: {
    width: 42,
  },
  timelineDayLabelCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  timelineDayLabel: {
    color: '#64748B',
    fontSize: 10,
    lineHeight: 13,
  },
  timelineDayNumber: {
    color: '#10203B',
    fontSize: 13,
    lineHeight: 16,
  },
  timelineBody: {
    gap: 0,
  },
  timelineRow: {
    flexDirection: 'row',
    minHeight: 24,
  },
  timelineTimeCell: {
    width: 42,
    alignItems: 'flex-end',
    paddingRight: 7,
    paddingTop: 2,
  },
  timelineTimeText: {
    fontSize: 9,
    lineHeight: 12,
  },
  timelineCell: {
    flex: 1,
    minHeight: 24,
    borderLeftWidth: 1,
    borderLeftColor: '#EEF3FA',
    borderTopWidth: 1,
    borderTopColor: '#F4F7FB',
    paddingHorizontal: 2,
    justifyContent: 'center',
  },
  timelineEvent: {
    borderWidth: 1,
    borderRadius: 7,
    alignSelf: 'center',
    width: 12,
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineEventDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
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
  calendarTitle: {
    color: '#10203B',
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: -0.2,
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D4E3FA',
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5ECF7',
    backgroundColor: '#F8FAFD',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    padding: 5,
  },
  calendarCellBusy: {
    backgroundColor: '#FAFCFF',
  },
  calendarCellToday: {
    borderColor: Accent.primary,
    backgroundColor: '#EAF1FF',
  },
  calendarDayLabel: {
    color: '#112746',
    lineHeight: 15,
    textAlign: 'center',
  },
  calendarDayLabelBusy: {
    fontSize: 12,
    lineHeight: 14,
  },
  calendarDayLabelMuted: {
    color: '#9DB0D1',
  },
  calendarDayLabelToday: {
    color: Accent.primary,
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
  calendarMarkerEvent: {
    backgroundColor: '#2563EB',
  },
  calendarMarkerCount: {
    color: '#60738F',
    fontSize: 9,
    lineHeight: 11,
  },
  calendarDetailBackdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    backgroundColor: 'rgba(15, 27, 51, 0.36)',
  },
  calendarDetailPanel: {
    borderWidth: 1,
    borderRadius: 22,
    borderColor: '#E1E8F3',
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
    lineHeight: 18,
  },
  calendarDetailTitle: {
    color: '#10203B',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  calendarDetailCloseButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FBFF',
    borderWidth: 1,
    borderColor: '#D8E4F6',
  },
  calendarDetailList: {
    gap: 8,
  },
  calendarDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E6EDF7',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FBFDFF',
  },
  calendarDetailMarker: {
    width: 36,
    height: 36,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  calendarDetailMarkerText: {
    fontSize: 12,
    lineHeight: 14,
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
    textAlign: 'right',
  },
  sectionCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DFE7F2',
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 10,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#F8FAFD',
  },
  dayRowSpacing: {
    marginBottom: 7,
  },
  dayRowPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.993 }],
  },
  dayRowAccent: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 999,
  },
  dayRowTime: {
    width: 52,
    alignItems: 'center',
    gap: 6,
  },
  dayRowTimeText: {
    color: '#10203B',
    lineHeight: 16,
  },
  dayRowAvatar: {
    width: 38,
    height: 38,
    borderRadius: 14,
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
    gap: 3,
  },
  dayRowTitle: {
    color: '#10203B',
    fontSize: 16,
    lineHeight: 20,
  },
  dayRowStatusWrap: {
    alignItems: 'center',
    gap: 4,
  },
  dayRowStatus: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
    maxWidth: 116,
  },
  dayRowStatusText: {
    fontSize: 11,
    lineHeight: 13,
  },
});
