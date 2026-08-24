import { Event, EventOccurrence } from '@/types/domain';
import { addDays, startOfDay, toLocalDate } from '@/utils/date-only';

export type EventOccurrenceDraft = Pick<
  EventOccurrence,
  'eventId' | 'ownerId' | 'clientId' | 'plannedStartAt' | 'plannedEndAt' | 'status' | 'notes'
>;

function parseTimeParts(value: string) {
  const [hourString = '0', minuteString = '0', secondString = '0'] = value.split(':');

  return {
    hour: Number(hourString),
    minute: Number(minuteString),
    second: Number(secondString),
  };
}

export function parseLocalDateTime(dateValue: string, timeValue: string) {
  const date = toLocalDate(dateValue);

  if (!date) {
    return null;
  }

  const { hour, minute, second } = parseTimeParts(timeValue);

  if (![hour, minute, second].every((part) => Number.isFinite(part))) {
    return null;
  }

  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, second, 0);
}

function addDurationMinutes(startAt: Date, durationMinutes: number) {
  return new Date(startAt.getTime() + durationMinutes * 60 * 1000);
}

function isWithinRange(candidate: Date, rangeStart: Date, rangeEnd: Date) {
  return candidate.getTime() >= rangeStart.getTime() && candidate.getTime() <= rangeEnd.getTime();
}

function getDefaultWeeklyDays(event: Event) {
  const startDate = toLocalDate(event.startDate);

  if (!startDate) {
    return [];
  }

  return [startDate.getDay()];
}

function getEffectiveEndDate(event: Event, rangeEndDay: Date) {
  if (event.recurrenceEndType === 'until' && event.recurrenceEndDate) {
    const recurrenceEnd = toLocalDate(event.recurrenceEndDate);

    if (recurrenceEnd) {
      return recurrenceEnd;
    }
  }

  return rangeEndDay;
}

function matchesWeeklyPattern(candidate: Date, eventStart: Date, interval: number, weekdays: number[]) {
  // Comparación por día: el candidato llega a medianoche y compararlo contra la hora exacta
  // del evento excluía siempre la primera ocurrencia de la serie (su propio día de inicio).
  if (candidate.getTime() < startOfDay(eventStart).getTime()) {
    return false;
  }

  const candidateWeekStart = new Date(candidate.getFullYear(), candidate.getMonth(), candidate.getDate() - candidate.getDay(), 0, 0, 0, 0);
  const startWeekStart = new Date(eventStart.getFullYear(), eventStart.getMonth(), eventStart.getDate() - eventStart.getDay(), 0, 0, 0, 0);
  // Math.round en lugar de Math.floor: entre semanas separadas por un cambio de horario (DST)
  // la diferencia real es N semanas ± 1 hora y floor rompería la paridad de weekDiff % interval.
  const weekDiff = Math.round((candidateWeekStart.getTime() - startWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000));

  return weekDiff >= 0 && weekDiff % interval === 0 && weekdays.includes(candidate.getDay());
}

function matchesMonthlyPattern(candidate: Date, eventStart: Date, interval: number, monthDay: number) {
  // Comparación por día (ver matchesWeeklyPattern).
  if (candidate.getTime() < startOfDay(eventStart).getTime()) {
    return false;
  }

  // Si el día pedido no existe en este mes (29-31), la ocurrencia cae en el último día del mes
  // (mismo criterio que addMonths en pagos/revisiones).
  const daysInMonth = new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate();
  const effectiveMonthDay = Math.min(monthDay, daysInMonth);

  if (candidate.getDate() !== effectiveMonthDay) {
    return false;
  }

  const monthDiff = (candidate.getFullYear() - eventStart.getFullYear()) * 12 + (candidate.getMonth() - eventStart.getMonth());

  return monthDiff >= 0 && monthDiff % interval === 0;
}

export function generateEventOccurrenceDrafts(event: Event, rangeStart: Date, rangeEnd: Date): EventOccurrenceDraft[] {
  const eventStart = parseLocalDateTime(event.startDate, event.startTime);

  if (!eventStart) {
    return [];
  }

  const normalizedRangeStart = startOfDay(rangeStart);
  // El límite superior respeta el instante recibido (la agenda pasa 23:59:59.999 para incluir
  // el último día completo); el recorrido por días usa su medianoche.
  const rangeEndDay = startOfDay(rangeEnd);
  const effectiveEndDate = getEffectiveEndDate(event, rangeEndDay);
  const recurrenceInterval = Math.max(1, event.recurrenceInterval ?? 1);
  const result: EventOccurrenceDraft[] = [];
  let generatedCount = 0;

  // Devuelve false cuando la serie se agota (fin por cantidad alcanzado). El contador avanza con
  // CADA ocurrencia teórica de la serie, caiga o no dentro del rango pedido: las ventanas de
  // consulta son rodantes y contar solo lo visible haría la serie infinita.
  const pushOccurrence = (plannedStartAt: Date): boolean => {
    if (event.recurrenceEndType === 'count' && event.recurrenceCount !== null && generatedCount >= event.recurrenceCount) {
      return false;
    }

    generatedCount += 1;

    if (!isWithinRange(plannedStartAt, normalizedRangeStart, rangeEnd)) {
      return true;
    }

    const plannedEndAt = addDurationMinutes(plannedStartAt, event.durationMinutes);

    result.push({
      eventId: event.id,
      ownerId: event.ownerId,
      clientId: event.clientId,
      plannedStartAt: plannedStartAt.toISOString(),
      plannedEndAt: plannedEndAt.toISOString(),
      status: 'scheduled',
      notes: null,
    });

    return true;
  };

  const buildOccurrenceAt = (candidate: Date) =>
    new Date(candidate.getFullYear(), candidate.getMonth(), candidate.getDate(), eventStart.getHours(), eventStart.getMinutes(), eventStart.getSeconds(), 0);

  if (!event.recurrenceEnabled) {
    pushOccurrence(eventStart);
    return result;
  }

  if (event.recurrenceFrequency === 'daily') {
    for (let candidate = startOfDay(eventStart); candidate.getTime() <= rangeEndDay.getTime() && candidate.getTime() <= effectiveEndDate.getTime(); candidate = addDays(candidate, recurrenceInterval)) {
      if (!pushOccurrence(buildOccurrenceAt(candidate))) {
        break;
      }
    }

    return result;
  }

  if (event.recurrenceFrequency === 'weekly') {
    const weekdays = (event.recurrenceWeekdays && event.recurrenceWeekdays.length > 0) ? event.recurrenceWeekdays : getDefaultWeeklyDays(event);

    for (let candidate = startOfDay(eventStart); candidate.getTime() <= rangeEndDay.getTime() && candidate.getTime() <= effectiveEndDate.getTime(); candidate = addDays(candidate, 1)) {
      if (matchesWeeklyPattern(candidate, eventStart, recurrenceInterval, weekdays)) {
        if (!pushOccurrence(buildOccurrenceAt(candidate))) {
          break;
        }
      }
    }

    return result;
  }

  if (event.recurrenceFrequency === 'monthly') {
    const monthDay = event.recurrenceMonthDay ?? eventStart.getDate();

    for (let candidate = startOfDay(eventStart); candidate.getTime() <= rangeEndDay.getTime() && candidate.getTime() <= effectiveEndDate.getTime(); candidate = addDays(candidate, 1)) {
      if (matchesMonthlyPattern(candidate, eventStart, recurrenceInterval, monthDay)) {
        if (!pushOccurrence(buildOccurrenceAt(candidate))) {
          break;
        }
      }
    }

    return result;
  }

  return result;
}
