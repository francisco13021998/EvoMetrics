import { Client, Event, EventOccurrence } from '@/types/domain';
import { buildEventNotifications, EVENT_NOTIFICATION_WINDOW_DAYS } from '@/utils/event-notifications';
import { addDays, startOfDay } from '@/utils/date-only';

const REFERENCE_DATE = new Date(2026, 7, 20, 12, 0, 0, 0);

function makeEvent(overrides: Partial<Event>): Event {
  return {
    id: 'evento-1',
    ownerId: 'owner-1',
    clientId: 'cliente-1',
    title: 'Sesión de seguimiento',
    description: 'Descripción',
    location: null,
    kind: 'training',
    startDate: '2026-08-20',
    startTime: '10:00:00',
    durationMinutes: 60,
    timezone: 'Europe/Madrid',
    allDay: false,
    recurrenceEnabled: false,
    recurrenceFrequency: null,
    recurrenceInterval: null,
    recurrenceWeekdays: null,
    recurrenceMonthDay: null,
    recurrenceEndType: null,
    recurrenceEndDate: null,
    recurrenceCount: null,
    isActive: true,
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

function makeOccurrence(daysFromReference: number, overrides: Partial<EventOccurrence> = {}): EventOccurrence {
  const plannedStart = new Date(addDays(startOfDay(REFERENCE_DATE), daysFromReference));
  plannedStart.setHours(10, 0, 0, 0);

  return {
    id: `ocurrencia-${daysFromReference}`,
    eventId: 'evento-1',
    ownerId: 'owner-1',
    clientId: 'cliente-1',
    plannedStartAt: plannedStart.toISOString(),
    plannedEndAt: new Date(plannedStart.getTime() + 60 * 60 * 1000).toISOString(),
    status: 'scheduled',
    completedAt: null,
    cancelledAt: null,
    rescheduledFromOccurrenceId: null,
    notes: null,
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

const clients: Client[] = [
  {
    id: 'cliente-1',
    ownerId: 'owner-1',
    athleteUserId: null,
    name: 'Ana',
    sex: 'female',
    athleteLevel: 'beginner',
    heightCm: 165,
    birthDate: '1995-05-01',
    coachingPrice: 100,
    billingFrequency: 'monthly',
    forcePaymentPending: false,
    estado: 'activo',
    revisionFrequencyValue: null,
    revisionFrequencyUnit: null,
    createdAt: '2026-01-01T00:00:00Z',
  },
];

describe('buildEventNotifications — ventana de 7 días (regresión: badge inflado)', () => {
  const events = [makeEvent({})];

  it('incluye ocurrencias de hoy y de los próximos días dentro de la ventana', () => {
    const items = buildEventNotifications(
      { clients, events, occurrences: [makeOccurrence(0), makeOccurrence(3), makeOccurrence(EVENT_NOTIFICATION_WINDOW_DAYS)] },
      REFERENCE_DATE
    );

    expect(items).toHaveLength(3);
    expect(items[0].clientName).toBe('Ana');
    expect(items[0].eventTitle).toBe('Sesión de seguimiento');
  });

  it('excluye ocurrencias más allá de la ventana', () => {
    const items = buildEventNotifications(
      { clients, events, occurrences: [makeOccurrence(EVENT_NOTIFICATION_WINDOW_DAYS + 1), makeOccurrence(30)] },
      REFERENCE_DATE
    );

    expect(items).toHaveLength(0);
  });

  it('excluye ocurrencias pasadas y no programadas', () => {
    const items = buildEventNotifications(
      {
        clients,
        events,
        occurrences: [makeOccurrence(-1), makeOccurrence(2, { status: 'completed' }), makeOccurrence(2, { status: 'cancelled' })],
      },
      REFERENCE_DATE
    );

    expect(items).toHaveLength(0);
  });

  it('ignora ocurrencias de eventos desconocidos', () => {
    const items = buildEventNotifications(
      { clients, events, occurrences: [makeOccurrence(2, { eventId: 'evento-fantasma' })] },
      REFERENCE_DATE
    );

    expect(items).toHaveLength(0);
  });
});
