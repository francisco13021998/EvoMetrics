import { Event, EventOccurrence } from '@/types/domain';

export type EventOccurrenceDraft = Pick<
  EventOccurrence,
  'eventId' | 'ownerId' | 'clientId' | 'plannedStartAt' | 'plannedEndAt' | 'status' | 'notes'
>;

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
}

function addDays(value: Date, offset: number) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate() + offset, 0, 0, 0, 0);
}

function toDateOnly(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : startOfDay(value);
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return startOfDay(parsed);
}

function parseTimeParts(value: string) {
  const [hourString = '0', minuteString = '0', secondString = '0'] = value.split(':');

  return {
    hour: Number(hourString),
    minute: Number(minuteString),
    second: Number(secondString),
  };
}

export function parseLocalDateTime(dateValue: string, timeValue: string) {
  const date = toDateOnly(dateValue);

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
  const startDate = toDateOnly(event.startDate);

  if (!startDate) {
    return [];
  }

  return [startDate.getDay()];
}

function getEffectiveEndDate(event: Event, rangeEnd: Date) {
  if (event.recurrenceEndType === 'until' && event.recurrenceEndDate) {
    const recurrenceEnd = toDateOnly(event.recurrenceEndDate);

    if (recurrenceEnd) {
      return recurrenceEnd;
    }
  }

  return rangeEnd;
}

function matchesWeeklyPattern(candidate: Date, eventStart: Date, interval: number, weekdays: number[]) {
  if (candidate.getTime() < eventStart.getTime()) {
    return false;
  }

  const candidateWeekStart = new Date(candidate.getFullYear(), candidate.getMonth(), candidate.getDate() - candidate.getDay(), 0, 0, 0, 0);
  const startWeekStart = new Date(eventStart.getFullYear(), eventStart.getMonth(), eventStart.getDate() - eventStart.getDay(), 0, 0, 0, 0);
  const weekDiff = Math.floor((candidateWeekStart.getTime() - startWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000));

  return weekDiff >= 0 && weekDiff % interval === 0 && weekdays.includes(candidate.getDay());
}

function matchesMonthlyPattern(candidate: Date, eventStart: Date, interval: number, monthDay: number) {
  if (candidate.getTime() < eventStart.getTime()) {
    return false;
  }

  if (candidate.getDate() !== monthDay) {
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
  const normalizedRangeEnd = startOfDay(rangeEnd);
  const effectiveEndDate = getEffectiveEndDate(event, normalizedRangeEnd);
  const recurrenceInterval = Math.max(1, event.recurrenceInterval ?? 1);
  const result: EventOccurrenceDraft[] = [];
  let generatedCount = 0;

  const pushOccurrence = (plannedStartAt: Date) => {
    if (!isWithinRange(plannedStartAt, normalizedRangeStart, normalizedRangeEnd)) {
      return;
    }

    if (event.recurrenceEndType === 'count' && event.recurrenceCount !== null && generatedCount >= event.recurrenceCount) {
      return;
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

    generatedCount += 1;
  };

  if (!event.recurrenceEnabled) {
    pushOccurrence(eventStart);
    return result;
  }

  if (event.recurrenceFrequency === 'daily') {
    for (let candidate = startOfDay(eventStart); candidate.getTime() <= normalizedRangeEnd.getTime() && candidate.getTime() <= effectiveEndDate.getTime(); candidate = addDays(candidate, recurrenceInterval)) {
      pushOccurrence(new Date(candidate.getFullYear(), candidate.getMonth(), candidate.getDate(), eventStart.getHours(), eventStart.getMinutes(), eventStart.getSeconds(), 0));
    }

    return result;
  }

  if (event.recurrenceFrequency === 'weekly') {
    const weekdays = (event.recurrenceWeekdays && event.recurrenceWeekdays.length > 0) ? event.recurrenceWeekdays : getDefaultWeeklyDays(event);

    for (let candidate = startOfDay(eventStart); candidate.getTime() <= normalizedRangeEnd.getTime() && candidate.getTime() <= effectiveEndDate.getTime(); candidate = addDays(candidate, 1)) {
      if (matchesWeeklyPattern(candidate, eventStart, recurrenceInterval, weekdays)) {
        pushOccurrence(new Date(candidate.getFullYear(), candidate.getMonth(), candidate.getDate(), eventStart.getHours(), eventStart.getMinutes(), eventStart.getSeconds(), 0));
      }
    }

    return result;
  }

  if (event.recurrenceFrequency === 'monthly') {
    const monthDay = event.recurrenceMonthDay ?? eventStart.getDate();

    for (let candidate = startOfDay(eventStart); candidate.getTime() <= normalizedRangeEnd.getTime() && candidate.getTime() <= effectiveEndDate.getTime(); candidate = addDays(candidate, 1)) {
      if (matchesMonthlyPattern(candidate, eventStart, recurrenceInterval, monthDay)) {
        pushOccurrence(new Date(candidate.getFullYear(), candidate.getMonth(), candidate.getDate(), eventStart.getHours(), eventStart.getMinutes(), eventStart.getSeconds(), 0));
      }
    }

    return result;
  }

  return result;
}