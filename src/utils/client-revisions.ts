import { Client, Revision } from '@/types/domain';

export const INACTIVE_REVISION_FREQUENCY_VALUE = 9999;

export function isRevisionFrequencyActive(
  value: number | null | undefined,
  unit: 'week' | 'month' | null | undefined
) {
  const normalizedValue = value ?? 0;

  return normalizedValue > 0 && normalizedValue < INACTIVE_REVISION_FREQUENCY_VALUE && Boolean(unit);
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
}

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  const targetDay = result.getDate();

  result.setDate(1);
  result.setMonth(result.getMonth() + months);

  const maxDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(targetDay, maxDay));

  return startOfDay(result);
}

function toLocalDate(value: string | Date | null | undefined) {
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

export type ClientRevisionStatus = {
  isConfigured: boolean;
  isPending: boolean;
  lastRevisionDate: Date | null;
  nextRevisionDate: Date | null;
  referenceDate: Date;
};

export function calculateNextRevisionDate(referenceDate: Date, value: number, unit: 'week' | 'month') {
  const baseDate = startOfDay(referenceDate);

  if (unit === 'week') {
    return new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + value * 7, 0, 0, 0, 0);
  }

  return addMonths(baseDate, value);
}

export function calculateClientRevisionStatus(
  client: Pick<Client, 'createdAt' | 'revisionFrequencyValue' | 'revisionFrequencyUnit'> | null | undefined,
  revisions: Revision[] | null | undefined,
  referenceDate = new Date()
): ClientRevisionStatus {
  const normalizedReference = startOfDay(referenceDate);
  const latestRevision = revisions?.[0] ?? null;
  const latestRevisionDate = toLocalDate(latestRevision?.reviewedAt ?? null);
  const isConfigured = Boolean(isRevisionFrequencyActive(client?.revisionFrequencyValue, client?.revisionFrequencyUnit) && latestRevisionDate);
  const nextRevisionDate = isConfigured
    ? calculateNextRevisionDate(latestRevisionDate!, client!.revisionFrequencyValue!, client!.revisionFrequencyUnit!)
    : null;
  const isPending = isConfigured && nextRevisionDate !== null ? normalizedReference > nextRevisionDate : false;

  return {
    isConfigured,
    isPending,
    lastRevisionDate: latestRevisionDate,
    nextRevisionDate,
    referenceDate: normalizedReference,
  };
}