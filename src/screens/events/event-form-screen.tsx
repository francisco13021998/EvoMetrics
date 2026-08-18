import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { EmptyState } from '@/components/feedback/empty-state';
import { StatusBanner } from '@/components/feedback/status-banner';
import { AppButton } from '@/components/forms/app-button';
import { AppCheckbox } from '@/components/forms/app-checkbox';
import { AppDateTimeInput } from '@/components/forms/app-date-time';
import { AppInput } from '@/components/forms/app-input';
import { AppSelect } from '@/components/forms/app-select';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { ScreenContainer } from '@/components/layout/screen-container';
import { ThemedText } from '@/components/themed-text';
import { Accent, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { clientsService } from '@/services/clients';
import { eventsService } from '@/services/events';
import { Client, Event, EventKind, EventRecurrenceEndType, EventRecurrenceFrequency } from '@/types/domain';
import { formatDateOnly, parseDateOnly } from '@/utils/client-age';

type EventFormScreenProps = {
  mode: 'create' | 'edit';
  eventId?: string;
  clientId?: string;
};

type EventFormState = {
  clientId: string;
  title: string;
  description: string;
  location: string;
  kind: EventKind;
  date: Date;
  time: Date;
  durationMinutes: string;
  allDay: boolean;
  recurrenceEnabled: boolean;
  recurrenceFrequency: EventRecurrenceFrequency;
  recurrenceInterval: string;
  recurrenceWeekdays: number[];
  recurrenceMonthDay: string;
  recurrenceEndType: EventRecurrenceEndType;
  recurrenceEndDate: Date | null;
  recurrenceCount: string;
};

type ClientOption = {
  label: string;
  value: string;
};

const EVENT_KIND_OPTIONS: { label: string; value: EventKind }[] = [
  { label: 'Llamada', value: 'call' },
  { label: 'Reunión', value: 'meeting' },
  { label: 'Visita', value: 'visit' },
  { label: 'Entrenamiento', value: 'training' },
  { label: 'Otro', value: 'other' },
];

const FREQUENCY_OPTIONS: { label: string; value: EventRecurrenceFrequency }[] = [
  { label: 'Cada día', value: 'daily' },
  { label: 'Cada semana', value: 'weekly' },
  { label: 'Cada mes', value: 'monthly' },
];

const END_TYPE_OPTIONS: { label: string; value: EventRecurrenceEndType }[] = [
  { label: 'Sin fin', value: 'never' },
  { label: 'Hasta una fecha', value: 'until' },
  { label: 'Por cantidad', value: 'count' },
];

const WEEKDAY_OPTIONS: { label: string; value: number }[] = [
  { label: 'L', value: 1 },
  { label: 'M', value: 2 },
  { label: 'X', value: 3 },
  { label: 'J', value: 4 },
  { label: 'V', value: 5 },
  { label: 'S', value: 6 },
  { label: 'D', value: 0 },
];

function toTimeDate(value: string, referenceDate = new Date()) {
  const [hourString = '0', minuteString = '0'] = value.split(':');
  const hour = Number(hourString);
  const minute = Number(minuteString);

  return new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    Number.isFinite(hour) ? hour : 0,
    Number.isFinite(minute) ? minute : 0,
    0,
    0
  );
}

function formatTimeOnly(value: Date) {
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}:00`;
}

function parseEventFromDb(event: Event): EventFormState {
  const eventDate = parseDateOnly(event.startDate) ?? new Date();
  const eventTime = toTimeDate(event.startTime, eventDate);

  return {
    clientId: event.clientId ?? '',
    title: event.title,
    description: event.description ?? '',
    location: event.location ?? '',
    kind: event.kind,
    date: eventDate,
    time: eventTime,
    durationMinutes: String(event.durationMinutes),
    allDay: event.allDay,
    recurrenceEnabled: event.recurrenceEnabled,
    recurrenceFrequency: event.recurrenceFrequency ?? 'weekly',
    recurrenceInterval: String(event.recurrenceInterval ?? 1),
    recurrenceWeekdays: event.recurrenceWeekdays ?? [],
    recurrenceMonthDay: String(event.recurrenceMonthDay ?? eventDate.getDate()),
    recurrenceEndType: event.recurrenceEndType ?? 'never',
    recurrenceEndDate: event.recurrenceEndDate ? parseDateOnly(event.recurrenceEndDate) : null,
    recurrenceCount: String(event.recurrenceCount ?? 1),
  };
}

function initialFormState(defaultDate = new Date()): EventFormState {
  const date = new Date(defaultDate.getFullYear(), defaultDate.getMonth(), defaultDate.getDate(), 0, 0, 0, 0);
  const time = new Date(defaultDate.getFullYear(), defaultDate.getMonth(), defaultDate.getDate(), 9, 0, 0, 0);

  return {
    clientId: '',
    title: '',
    description: '',
    location: '',
    kind: 'meeting',
    date,
    time,
    durationMinutes: '60',
    allDay: false,
    recurrenceEnabled: false,
    recurrenceFrequency: 'weekly',
    recurrenceInterval: '1',
    recurrenceWeekdays: [date.getDay()],
    recurrenceMonthDay: String(date.getDate()),
    recurrenceEndType: 'never',
    recurrenceEndDate: null,
    recurrenceCount: '1',
  };
}

function formatEventFormDate(value: Date) {
  return formatDateOnly(value);
}

function parseNullableInteger(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) ? parsed : null;
}

function toggleWeekday(current: number[], weekday: number) {
  if (current.includes(weekday)) {
    return current.filter((value) => value !== weekday);
  }

  return [...current, weekday].sort((left, right) => left - right);
}

export function EventFormScreen({ mode, eventId, clientId: clientIdFromRoute }: EventFormScreenProps) {
  const { user } = useAuth();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= 720;
  const [isLoading, setIsLoading] = useState(mode === 'edit');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState<EventFormState>(() => initialFormState());

  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    Promise.all([
      clientsService.listByOwner(user.id),
      mode === 'edit' && eventId ? eventsService.getById(eventId, user.id) : Promise.resolve(null),
    ])
      .then(([nextClients, nextEvent]) => {
        setClients(nextClients);

        if (mode === 'edit' && eventId && !nextEvent) {
          setEvent(null);
          return;
        }

        if (nextEvent) {
          setEvent(nextEvent);
          setForm(parseEventFromDb(nextEvent));
          return;
        }

        const nextForm = initialFormState();

        if (clientIdFromRoute) {
          nextForm.clientId = clientIdFromRoute;
        }

        setForm(nextForm);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'No se pudo cargar el evento.';
        setErrorMessage(message);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [clientIdFromRoute, eventId, mode, user?.id]);

  const clientOptions = useMemo<ClientOption[]>(
    () => clients.map((client) => ({ label: client.name, value: client.id })),
    [clients]
  );

  async function handleSubmit() {
    if (!user?.id) {
      setErrorMessage('No hay una sesion activa.');
      return;
    }

    if (!form.title.trim()) {
      setErrorMessage('El titulo del evento es obligatorio.');
      return;
    }

    const parsedDuration = parseNullableInteger(form.durationMinutes);

    if (parsedDuration === null || parsedDuration <= 0) {
      setErrorMessage('La duracion debe ser un numero entero mayor que cero.');
      return;
    }

    const parsedInterval = parseNullableInteger(form.recurrenceInterval);
    const parsedMonthDay = parseNullableInteger(form.recurrenceMonthDay);
    const parsedCount = parseNullableInteger(form.recurrenceCount);

    if (form.recurrenceEnabled) {
      if (!parsedInterval || parsedInterval <= 0) {
        setErrorMessage('La recurrencia necesita un intervalo valido.');
        return;
      }

      if (form.recurrenceFrequency === 'weekly' && form.recurrenceWeekdays.length === 0) {
        setErrorMessage('Selecciona al menos un dia de la semana.');
        return;
      }

      if (form.recurrenceFrequency === 'monthly' && (!parsedMonthDay || parsedMonthDay < 1 || parsedMonthDay > 31)) {
        setErrorMessage('El dia del mes debe estar entre 1 y 31.');
        return;
      }

      if (form.recurrenceEndType === 'until' && !form.recurrenceEndDate) {
        setErrorMessage('Selecciona una fecha de fin para la recurrencia.');
        return;
      }

      if (form.recurrenceEndType === 'count' && (!parsedCount || parsedCount <= 0)) {
        setErrorMessage('La cantidad de repeticiones debe ser mayor que cero.');
        return;
      }
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    const eventPayload = {
      ownerId: user.id,
      clientId: form.clientId.trim() ? form.clientId : null,
      title: form.title.trim(),
      description: form.description.trim() || null,
      location: form.location.trim() || null,
      kind: form.kind,
      startDate: formatEventFormDate(form.date),
      startTime: formatTimeOnly(form.time),
      durationMinutes: parsedDuration,
      timezone: 'UTC',
      allDay: form.allDay,
      recurrenceEnabled: form.recurrenceEnabled,
      recurrenceFrequency: form.recurrenceEnabled ? form.recurrenceFrequency : null,
      recurrenceInterval: form.recurrenceEnabled ? parsedInterval : null,
      recurrenceWeekdays: form.recurrenceEnabled && form.recurrenceFrequency === 'weekly' ? form.recurrenceWeekdays : null,
      recurrenceMonthDay: form.recurrenceEnabled && form.recurrenceFrequency === 'monthly' ? parsedMonthDay : null,
      recurrenceEndType: form.recurrenceEnabled ? form.recurrenceEndType : null,
      recurrenceEndDate: form.recurrenceEnabled && form.recurrenceEndType === 'until' && form.recurrenceEndDate
        ? formatEventFormDate(form.recurrenceEndDate)
        : null,
      recurrenceCount: form.recurrenceEnabled && form.recurrenceEndType === 'count' ? parsedCount : null,
      isActive: true,
    };

    try {
      if (mode === 'create') {
        const createdEvent = await eventsService.create(eventPayload);
        router.replace(`/events/${createdEvent.id}/edit`);
        return;
      }

      if (!eventId) {
        throw new Error('No se ha encontrado el evento a editar.');
      }

      const updatedEvent = await eventsService.update(eventId, user.id, eventPayload);
      router.replace(`/events/${updatedEvent.id}/edit`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo guardar el evento.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <ScreenContainer>
        <PageHeader title="Cargando..." />
        <PageSection first>
          <StatusBanner tone="info" loading message="Obteniendo datos del evento." />
        </PageSection>
      </ScreenContainer>
    );
  }

  if (mode === 'edit' && !event && !errorMessage) {
    return (
      <ScreenContainer>
        <EmptyState
          title="Evento no disponible"
          description="No se ha encontrado el evento que intentas editar."
          actionLabel="Volver a agenda"
          onAction={() => router.replace('/agenda')}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer contentStyle={styles.screenContent}>
      <PageHeader
        eyebrow={mode === 'create' ? 'Alta' : 'Edicion'}
        title={mode === 'create' ? 'Nuevo evento' : 'Editar evento'}
        subtitle={mode === 'create' ? 'Programa una llamada, reunión o visita.' : 'Ajusta la serie o una ocurrencia futura.'}
        rightSlot={
          <AppButton
            variant="surface"
            size="compact"
            fullWidth={false}
            onPress={() => router.back()}
            disabled={isSubmitting}
            accessibilityLabel="Volver"
            leadingIcon={
              <View style={styles.backIconWrap}>
                <ThemedText type="smallBold" style={styles.backIcon}>←</ThemedText>
              </View>
            }
          />
        }
      />

      <PageSection first style={styles.formSection}>
        {isSubmitting ? <StatusBanner tone="info" loading message="Guardando..." /> : null}
        {errorMessage ? <StatusBanner tone="danger" message={errorMessage} /> : null}

        <View style={[styles.formCard, { borderColor: theme.backgroundSelected }]}>
          <View style={styles.formCardTopAccent} />

          <AppInput
            label="Título"
            placeholder="Llamada con Laura"
            value={form.title}
            onChangeText={(value) => setForm((current) => ({ ...current, title: value }))}
            autoCapitalize="sentences"
            autoCorrect={false}
            containerStyle={styles.formField}
          />

          <AppSelect
            label="Cliente"
            value={form.clientId || ''}
            options={clientOptions}
            placeholder="Sin cliente"
            onChange={(value) => setForm((current) => ({ ...current, clientId: value }))}
            containerStyle={styles.formField}
          />

          <AppSelect
            label="Tipo"
            value={form.kind}
            options={EVENT_KIND_OPTIONS}
            onChange={(value) => setForm((current) => ({ ...current, kind: value as EventKind }))}
            containerStyle={styles.formField}
          />

          <View style={[styles.formRow, !isWide && styles.formRowStacked]}>
            <View style={styles.formCell}>
              <AppDateTimeInput
                label="Fecha"
                value={form.date}
                mode="date"
                allowYearSelection
                helper="Inicio del evento o de la serie."
                onChange={(value) => setForm((current) => ({ ...current, date: value }))}
                shellStyle={styles.formField}
              />
            </View>
            <View style={styles.formCell}>
              <AppDateTimeInput
                label="Hora"
                value={form.time}
                mode="time"
                helper="Se guarda como hora local."
                onChange={(value) => setForm((current) => ({ ...current, time: value }))}
                shellStyle={styles.formField}
              />
            </View>
          </View>

          <View style={[styles.formRow, !isWide && styles.formRowStacked]}>
            <View style={styles.formCell}>
              <AppInput
                label="Duración"
                placeholder="60"
                keyboardType="number-pad"
                inputMode="numeric"
                unit="min"
                value={form.durationMinutes}
                onChangeText={(value) => setForm((current) => ({ ...current, durationMinutes: value }))}
                containerStyle={styles.formField}
              />
            </View>
            <View style={styles.formCell}>
              <AppCheckbox
                label="Evento de día completo"
                checked={form.allDay}
                onChange={(checked) => setForm((current) => ({ ...current, allDay: checked }))}
                helper="Mantiene la fecha pero oculta la hora en la UI futura."
              />
            </View>
          </View>

          <AppInput
            label="Ubicación"
            placeholder="Videollamada, despacho, gimnasio..."
            value={form.location}
            onChangeText={(value) => setForm((current) => ({ ...current, location: value }))}
            autoCapitalize="sentences"
            containerStyle={styles.formField}
          />

          <AppInput
            label="Descripción"
            placeholder="Detalles del evento"
            value={form.description}
            onChangeText={(value) => setForm((current) => ({ ...current, description: value }))}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            containerStyle={styles.formField}
          />
        </View>

        <View style={[styles.recurrenceCard, { borderColor: theme.backgroundSelected }]}>
          <AppCheckbox
            label="Repetir evento"
            checked={form.recurrenceEnabled}
            onChange={(checked) =>
              setForm((current) => ({
                ...current,
                recurrenceEnabled: checked,
              }))
            }
            helper="Convierte el evento en una serie recurrente."
          />

          {form.recurrenceEnabled ? (
            <View style={styles.recurrenceContent}>
              <AppSelect
                label="Frecuencia"
                value={form.recurrenceFrequency}
                options={FREQUENCY_OPTIONS}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    recurrenceFrequency: value as EventRecurrenceFrequency,
                  }))
                }
              />

              <View style={[styles.formRow, !isWide && styles.formRowStacked]}>
                <View style={styles.formCell}>
                  <AppInput
                    label="Cada"
                    placeholder="1"
                    keyboardType="number-pad"
                    inputMode="numeric"
                    value={form.recurrenceInterval}
                    onChangeText={(value) => setForm((current) => ({ ...current, recurrenceInterval: value }))}
                    helper="Por ejemplo, 2 para cada 2 semanas."
                  />
                </View>
                <View style={styles.formCell}>
                  <AppSelect
                    label="Termina"
                    value={form.recurrenceEndType}
                    options={END_TYPE_OPTIONS}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        recurrenceEndType: value as EventRecurrenceEndType,
                      }))
                    }
                  />
                </View>
              </View>

              {form.recurrenceFrequency === 'weekly' ? (
                <View style={styles.weekdayGrid}>
                  {WEEKDAY_OPTIONS.map((weekday) => {
                    const isActive = form.recurrenceWeekdays.includes(weekday.value);

                    return (
                      <Pressable
                        key={weekday.value}
                        onPress={() =>
                          setForm((current) => ({
                            ...current,
                            recurrenceWeekdays: toggleWeekday(current.recurrenceWeekdays, weekday.value),
                          }))
                        }
                        style={({ pressed }) => [
                          styles.weekdayChip,
                          isActive && styles.weekdayChipActive,
                          { opacity: pressed ? 0.92 : 1 },
                        ]}>
                        <ThemedText type="smallBold" style={[styles.weekdayChipText, isActive && styles.weekdayChipTextActive]}>
                          {weekday.label}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {form.recurrenceFrequency === 'monthly' ? (
                <AppInput
                  label="Dia del mes"
                  placeholder="15"
                  keyboardType="number-pad"
                  inputMode="numeric"
                  value={form.recurrenceMonthDay}
                  onChangeText={(value) => setForm((current) => ({ ...current, recurrenceMonthDay: value }))}
                  helper="Se programará cada mes en ese dia."
                />
              ) : null}

              {form.recurrenceEndType === 'until' ? (
                <AppDateTimeInput
                  label="Fecha de fin"
                  value={form.recurrenceEndDate}
                  mode="date"
                  allowYearSelection
                  onChange={(value) => setForm((current) => ({ ...current, recurrenceEndDate: value }))}
                />
              ) : null}

              {form.recurrenceEndType === 'count' ? (
                <AppInput
                  label="Cantidad de repeticiones"
                  placeholder="10"
                  keyboardType="number-pad"
                  inputMode="numeric"
                  value={form.recurrenceCount}
                  onChangeText={(value) => setForm((current) => ({ ...current, recurrenceCount: value }))}
                />
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={[styles.actions, { borderColor: theme.backgroundSelected }]}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.actionsCopy}>
            Puedes ajustar la serie y sus instancias después.
          </ThemedText>
          <AppButton label={mode === 'create' ? 'Crear evento' : 'Guardar cambios'} onPress={handleSubmit} loading={isSubmitting} />
          {mode === 'edit' ? (
            <AppButton label="Cancelar" variant="surface" onPress={() => router.back()} disabled={isSubmitting} />
          ) : null}
        </View>
      </PageSection>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    gap: 8,
  },
  backIcon: {
    color: Accent.primary,
    fontSize: 16,
    lineHeight: 16,
    textAlign: 'center',
  },
  backIconWrap: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formSection: {
    paddingTop: 12,
  },
  formCard: {
    borderWidth: 1,
    borderRadius: Radius.large,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
    overflow: 'hidden',
    shadowColor: '#12336E',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  formCardTopAccent: {
    height: 4,
    marginHorizontal: -Spacing.three,
    marginTop: -Spacing.two,
    marginBottom: Spacing.one,
    backgroundColor: Accent.primary,
  },
  formField: {
    marginBottom: 0,
  },
  formRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  formRowStacked: {
    flexDirection: 'column',
  },
  formCell: {
    flex: 1,
    gap: Spacing.two,
  },
  recurrenceCard: {
    borderWidth: 1,
    borderRadius: Radius.large,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
  recurrenceContent: {
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  weekdayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  weekdayChip: {
    minWidth: 42,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D7E3F4',
    backgroundColor: '#F8FBFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayChipActive: {
    backgroundColor: Accent.primary,
    borderColor: Accent.primary,
  },
  weekdayChipText: {
    color: '#5F6E87',
  },
  weekdayChipTextActive: {
    color: '#FFFFFF',
  },
  actions: {
    borderWidth: 1,
    borderRadius: Radius.large,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  actionsCopy: {
    lineHeight: 18,
  },
});