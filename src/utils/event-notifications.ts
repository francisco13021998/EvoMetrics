import { Client, Event, EventOccurrence } from '@/types/domain';
import { addDays, startOfDay } from '@/utils/date-only';

// Solo las ocurrencias de los próximos días generan notificación: con todo el horizonte
// sincronizado (90 días) el badge del dashboard se inflaba con eventos lejanos.
export const EVENT_NOTIFICATION_WINDOW_DAYS = 7;

export type EventNotificationItem = {
  kind: 'event';
  clientId: string | null;
  clientName: string;
  eventId: string;
  occurrenceId: string;
  eventTitle: string;
  eventSubtitle: string;
  lastDate: string | null;
  nextDate: string | null;
};

type EventNotificationInput = {
  clients: Client[];
  events: Event[];
  occurrences: EventOccurrence[];
};

function parseDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function buildEventNotifications({ clients, events, occurrences }: EventNotificationInput, referenceDate = new Date()) {
  const clientNameById = new Map(clients.map((client) => [client.id, client.name] as const));
  const eventById = new Map(events.map((event) => [event.id, event] as const));
  const normalizedReference = startOfDay(referenceDate);
  const windowEnd = addDays(normalizedReference, EVENT_NOTIFICATION_WINDOW_DAYS);

  return occurrences.flatMap((occurrence): EventNotificationItem[] => {
    const plannedStartAt = parseDate(occurrence.plannedStartAt);
    const event = eventById.get(occurrence.eventId);

    if (!event || !plannedStartAt || occurrence.status !== 'scheduled') {
      return [] as EventNotificationItem[];
    }

    const plannedStartDay = startOfDay(plannedStartAt);

    if (plannedStartDay < normalizedReference || plannedStartDay > windowEnd) {
      return [] as EventNotificationItem[];
    }

    return [
      {
        kind: 'event',
        clientId: event.clientId,
        clientName: event.clientId ? clientNameById.get(event.clientId) ?? 'Sin cliente' : 'Evento',
        eventId: event.id,
        occurrenceId: occurrence.id,
        eventTitle: event.title,
        eventSubtitle: event.description ?? event.location ?? 'Evento programado',
        lastDate: null,
        nextDate: plannedStartAt.toISOString(),
      },
    ];
  });
}

export function formatEventNotificationDate(value: string | null) {
  if (!value) {
    return 'Sin datos';
  }

  return new Date(value).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}