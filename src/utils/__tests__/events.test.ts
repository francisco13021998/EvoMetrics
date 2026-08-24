import { Event } from '@/types/domain';
import { generateEventOccurrenceDrafts, parseLocalDateTime } from '@/utils/events';

function makeEvent(overrides: Partial<Event>): Event {
  return {
    id: 'evento-1',
    ownerId: 'owner-1',
    clientId: null,
    title: 'Sesión',
    description: null,
    location: null,
    kind: 'training',
    startDate: '2026-08-01',
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

function localDay(year: number, month: number, day: number, hour = 0, minute = 0) {
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

describe('parseLocalDateTime', () => {
  it('combina fecha date-only y hora en hora LOCAL', () => {
    const parsed = parseLocalDateTime('2026-08-10', '10:30:00');

    expect(parsed).not.toBeNull();
    expect(parsed!.getDate()).toBe(10);
    expect(parsed!.getHours()).toBe(10);
    expect(parsed!.getMinutes()).toBe(30);
  });
});

describe('generateEventOccurrenceDrafts — evento único', () => {
  it('genera exactamente una ocurrencia dentro del rango', () => {
    const event = makeEvent({ startDate: '2026-08-10', startTime: '10:00:00' });
    const drafts = generateEventOccurrenceDrafts(event, localDay(2026, 8, 1), localDay(2026, 8, 31, 23, 59));

    expect(drafts).toHaveLength(1);
    expect(drafts[0].plannedStartAt).toBe(localDay(2026, 8, 10, 10).toISOString());
    expect(drafts[0].plannedEndAt).toBe(localDay(2026, 8, 10, 11).toISOString());
  });
});

describe('generateEventOccurrenceDrafts — fin por cantidad (regresión: serie infinita)', () => {
  const event = makeEvent({
    startDate: '2026-08-01',
    startTime: '09:00:00',
    recurrenceEnabled: true,
    recurrenceFrequency: 'daily',
    recurrenceInterval: 1,
    recurrenceEndType: 'count',
    recurrenceCount: 3,
  });

  it('genera exactamente N ocurrencias desde el inicio de la serie', () => {
    const drafts = generateEventOccurrenceDrafts(event, localDay(2026, 8, 1), localDay(2026, 8, 31, 23, 59));

    expect(drafts).toHaveLength(3);
    expect(drafts.map((draft) => new Date(draft.plannedStartAt).getDate())).toEqual([1, 2, 3]);
  });

  it('una ventana rodante posterior NO regenera la serie agotada', () => {
    const drafts = generateEventOccurrenceDrafts(event, localDay(2026, 8, 10), localDay(2026, 8, 20, 23, 59));

    expect(drafts).toHaveLength(0);
  });

  it('una ventana que corta la serie solo emite las que caen dentro, sin alterar el total', () => {
    const drafts = generateEventOccurrenceDrafts(event, localDay(2026, 8, 2), localDay(2026, 8, 20, 23, 59));

    expect(drafts.map((draft) => new Date(draft.plannedStartAt).getDate())).toEqual([2, 3]);
  });
});

describe('generateEventOccurrenceDrafts — límite superior del rango (regresión: último día excluido)', () => {
  it('incluye ocurrencias con hora del último día cuando rangeEnd es 23:59', () => {
    const event = makeEvent({ startDate: '2026-08-20', startTime: '10:00:00' });
    const drafts = generateEventOccurrenceDrafts(event, localDay(2026, 8, 20), localDay(2026, 8, 20, 23, 59));

    expect(drafts).toHaveLength(1);
  });

  it('respeta el instante exacto: una ocurrencia posterior a rangeEnd queda fuera', () => {
    const event = makeEvent({ startDate: '2026-08-20', startTime: '10:00:00' });
    const drafts = generateEventOccurrenceDrafts(event, localDay(2026, 8, 20), localDay(2026, 8, 20, 9, 0));

    expect(drafts).toHaveLength(0);
  });
});

describe('generateEventOccurrenceDrafts — semanal con intervalo', () => {
  it('intervalo 2 genera semanas alternas (día de la semana del inicio por defecto)', () => {
    // 2026-08-03 es lunes.
    const event = makeEvent({
      startDate: '2026-08-03',
      startTime: '18:00:00',
      recurrenceEnabled: true,
      recurrenceFrequency: 'weekly',
      recurrenceInterval: 2,
      recurrenceEndType: 'never',
    });

    const drafts = generateEventOccurrenceDrafts(event, localDay(2026, 8, 3), localDay(2026, 8, 30, 23, 59));

    expect(drafts.map((draft) => new Date(draft.plannedStartAt).getDate())).toEqual([3, 17]);
  });
});

describe('generateEventOccurrenceDrafts — mensual en día 29-31 (regresión: meses cortos saltados)', () => {
  it('un evento del día 31 cae en el último día de los meses cortos', () => {
    const event = makeEvent({
      startDate: '2026-01-31',
      startTime: '09:00:00',
      recurrenceEnabled: true,
      recurrenceFrequency: 'monthly',
      recurrenceInterval: 1,
      recurrenceEndType: 'never',
    });

    const february = generateEventOccurrenceDrafts(event, localDay(2026, 2, 1), localDay(2026, 2, 28, 23, 59));
    expect(february).toHaveLength(1);
    expect(new Date(february[0].plannedStartAt).getDate()).toBe(28);

    const april = generateEventOccurrenceDrafts(event, localDay(2026, 4, 1), localDay(2026, 4, 30, 23, 59));
    expect(april).toHaveLength(1);
    expect(new Date(april[0].plannedStartAt).getDate()).toBe(30);

    const march = generateEventOccurrenceDrafts(event, localDay(2026, 3, 1), localDay(2026, 3, 31, 23, 59));
    expect(march).toHaveLength(1);
    expect(new Date(march[0].plannedStartAt).getDate()).toBe(31);
  });
});

describe('generateEventOccurrenceDrafts — fin por fecha (until)', () => {
  it('no genera ocurrencias después de recurrenceEndDate', () => {
    const event = makeEvent({
      startDate: '2026-08-01',
      startTime: '09:00:00',
      recurrenceEnabled: true,
      recurrenceFrequency: 'daily',
      recurrenceInterval: 1,
      recurrenceEndType: 'until',
      recurrenceEndDate: '2026-08-03',
    });

    const drafts = generateEventOccurrenceDrafts(event, localDay(2026, 8, 1), localDay(2026, 8, 31, 23, 59));

    expect(drafts.map((draft) => new Date(draft.plannedStartAt).getDate())).toEqual([1, 2, 3]);
  });
});
