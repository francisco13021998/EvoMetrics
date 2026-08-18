import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { EmptyState } from '@/components/feedback/empty-state';
import { StatusBanner } from '@/components/feedback/status-banner';
import { AppButton } from '@/components/forms/app-button';
import { AppDateTimeInput } from '@/components/forms/app-date-time';
import { AppInput } from '@/components/forms/app-input';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { ScreenContainer } from '@/components/layout/screen-container';
import { ThemedText } from '@/components/themed-text';
import { Accent, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { clientsService } from '@/services/clients';
import { eventsService } from '@/services/events';
import { Client, Event, EventOccurrence } from '@/types/domain';
import { formatDateOnly, parseDateOnly } from '@/utils/client-age';

type EventOccurrenceDetailScreenProps = {
  occurrenceId?: string;
};

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

function getDurationMinutes(occurrence: EventOccurrence) {
  const start = new Date(occurrence.plannedStartAt);
  const end = new Date(occurrence.plannedEndAt);
  const diff = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));

  return diff || 60;
}

function formatDateTimeLabel(value: Date) {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(value)
    .replace(/^(.)/, (match) => match.toUpperCase());
}

function parseRescheduleState(occurrence: EventOccurrence) {
  const plannedStart = new Date(occurrence.plannedStartAt);
  const plannedEnd = new Date(occurrence.plannedEndAt);

  return {
    date: parseDateOnly(formatDateOnly(plannedStart)) ?? new Date(),
    time: toTimeDate(`${String(plannedStart.getHours()).padStart(2, '0')}:${String(plannedStart.getMinutes()).padStart(2, '0')}`, plannedStart),
    notes: occurrence.notes ?? '',
    durationMinutes: getDurationMinutes(occurrence),
    endDate: plannedEnd,
  };
}

export function EventOccurrenceDetailScreen({ occurrenceId }: EventOccurrenceDetailScreenProps) {
  const { user } = useAuth();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= 720;
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [occurrence, setOccurrence] = useState<EventOccurrence | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Date | null>(new Date());
  const [rescheduleTime, setRescheduleTime] = useState<Date | null>(new Date());
  const [rescheduleNotes, setRescheduleNotes] = useState('');

  useEffect(() => {
    if (!user?.id || !occurrenceId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    eventsService
      .getOccurrenceById(occurrenceId, user.id)
      .then(async (nextOccurrence) => {
        if (!nextOccurrence) {
          setOccurrence(null);
          return;
        }

        setOccurrence(nextOccurrence);
        setRescheduleNotes(nextOccurrence.notes ?? '');

        const nextEvent = await eventsService.getById(nextOccurrence.eventId, user.id);

        setEvent(nextEvent);

        if (nextEvent?.clientId) {
          const nextClient = await clientsService.getById(nextEvent.clientId, user.id);
          setClient(nextClient);
        } else {
          setClient(null);
        }

        const parsed = parseRescheduleState(nextOccurrence);
        setRescheduleDate(parsed.date);
        setRescheduleTime(parsed.time);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'No se pudo cargar la instancia.';
        setErrorMessage(message);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [occurrenceId, user?.id]);

  const durationMinutes = useMemo(() => (occurrence ? getDurationMinutes(occurrence) : 60), [occurrence]);

  async function handleComplete() {
    if (!occurrence || !user?.id) {
      return;
    }

    setIsSubmitting(true);

    try {
      const updated = await eventsService.completeOccurrence(occurrence.id, user.id);
      setOccurrence(updated);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo marcar como completado.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancel() {
    if (!occurrence || !user?.id) {
      return;
    }

    setIsSubmitting(true);

    try {
      const updated = await eventsService.cancelOccurrence(occurrence.id, user.id, new Date().toISOString(), rescheduleNotes.trim() || null);
      setOccurrence(updated);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo cancelar la instancia.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReschedule() {
    if (!occurrence || !user?.id || !rescheduleDate || !rescheduleTime) {
      setErrorMessage('Falta la nueva fecha u hora.');
      return;
    }

    const plannedStartAt = new Date(
      rescheduleDate.getFullYear(),
      rescheduleDate.getMonth(),
      rescheduleDate.getDate(),
      rescheduleTime.getHours(),
      rescheduleTime.getMinutes(),
      0,
      0
    );
    const plannedEndAt = new Date(plannedStartAt.getTime() + durationMinutes * 60000);

    setIsSubmitting(true);

    try {
      const result = await eventsService.rescheduleOccurrence(occurrence.id, user.id, {
        plannedStartAt: plannedStartAt.toISOString(),
        plannedEndAt: plannedEndAt.toISOString(),
        notes: rescheduleNotes.trim() || null,
      });

      setOccurrence(result.previous);
      router.replace(`/events/occurrences/${result.next.id}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo reprogramar la instancia.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <ScreenContainer>
        <PageHeader title="Cargando..." />
        <PageSection first>
          <StatusBanner tone="info" loading message="Obteniendo la instancia del evento." />
        </PageSection>
      </ScreenContainer>
    );
  }

  if (!occurrence && !errorMessage) {
    return (
      <ScreenContainer>
        <EmptyState
          title="Instancia no disponible"
          description="No se ha encontrado la instancia que intentas consultar."
          actionLabel="Volver a agenda"
          onAction={() => router.replace('/agenda')}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer contentStyle={styles.screenContent}>
      <PageHeader
        eyebrow="Instancia"
        title={event?.title ?? 'Detalle de evento'}
        subtitle={client ? `Para ${client.name}` : 'Sin cliente asociado'}
        rightSlot={
          <AppButton
            variant="surface"
            size="compact"
            fullWidth={false}
            onPress={() => router.push(`/events/${occurrence?.eventId ?? ''}/edit`)}
            disabled={!occurrence || isSubmitting}
            accessibilityLabel="Editar serie"
            label="Editar serie"
          />
        }
      />

      <PageSection first style={styles.sectionSpacing}>
        {errorMessage ? <StatusBanner tone="danger" message={errorMessage} /> : null}

        <View style={[styles.detailCard, { borderColor: theme.backgroundSelected }]}>
          <View style={styles.detailStrip} />
          <ThemedText type="label" style={styles.detailLabel}>
            Estado
          </ThemedText>
          <ThemedText style={styles.detailTitle}>
            {occurrence?.status === 'completed' ? 'Completado' : occurrence?.status === 'cancelled' ? 'Cancelado' : occurrence?.status === 'rescheduled' ? 'Reprogramado' : 'Programado'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {occurrence ? formatDateTimeLabel(new Date(occurrence.plannedStartAt)) : ''}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Duración estimada: {durationMinutes} min
          </ThemedText>
          {event?.location ? (
            <ThemedText type="small" themeColor="textSecondary">
              Ubicación: {event.location}
            </ThemedText>
          ) : null}
          {event?.description ? (
            <ThemedText type="small" themeColor="textSecondary">
              {event.description}
            </ThemedText>
          ) : null}
        </View>
      </PageSection>

      <PageSection title="Reprogramar" style={styles.sectionSpacing}>
        <View style={styles.formCard}>
          <View style={[styles.formRow, !isWide && styles.formRowStacked]}>
            <View style={styles.formCell}>
              <AppDateTimeInput
                label="Nueva fecha"
                value={rescheduleDate}
                mode="date"
                allowYearSelection
                onChange={setRescheduleDate}
              />
            </View>
            <View style={styles.formCell}>
              <AppDateTimeInput
                label="Nueva hora"
                value={rescheduleTime}
                mode="time"
                onChange={setRescheduleTime}
              />
            </View>
          </View>

          <AppInput
            label="Notas"
            placeholder="Motivo, contexto o recordatorio"
            value={rescheduleNotes}
            onChangeText={setRescheduleNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <View style={styles.actionsRow}>
            <AppButton label="Reprogramar" onPress={handleReschedule} loading={isSubmitting} />
            <AppButton label="Completar" variant="secondary" onPress={handleComplete} loading={isSubmitting} />
            <AppButton label="Cancelar instancia" variant="danger" onPress={handleCancel} loading={isSubmitting} />
          </View>
        </View>
      </PageSection>

      <View style={styles.bottomActions}>
        <AppButton label="Volver a agenda" variant="surface" onPress={() => router.replace('/agenda')} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    gap: 8,
  },
  sectionSpacing: {
    gap: Spacing.three,
  },
  detailCard: {
    borderWidth: 1,
    borderRadius: Radius.large,
    backgroundColor: '#FFFFFF',
    padding: Spacing.three,
    gap: Spacing.one,
  },
  detailStrip: {
    height: 4,
    borderRadius: 999,
    backgroundColor: Accent.primary,
    marginBottom: Spacing.one,
  },
  detailLabel: {
    color: Accent.primary,
  },
  detailTitle: {
    color: Accent.ink,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
  },
  formCard: {
    gap: Spacing.three,
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
  },
  actionsRow: {
    gap: Spacing.two,
  },
  bottomActions: {
    paddingVertical: Spacing.two,
  },
});