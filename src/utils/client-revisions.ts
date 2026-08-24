import { Client, Revision } from '@/types/domain';
import { addMonths, startOfDay, toLocalDate } from '@/utils/date-only';

export const INACTIVE_REVISION_FREQUENCY_VALUE = 9999;

export function isRevisionFrequencyActive(
  value: number | null | undefined,
  unit: 'week' | 'month' | null | undefined
) {
  const normalizedValue = value ?? 0;

  return normalizedValue > 0 && normalizedValue < INACTIVE_REVISION_FREQUENCY_VALUE && Boolean(unit);
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

// La revisión de referencia es la de reviewedAt más reciente, sin confiar en el orden del array.
function findLatestRevision(revisions: Revision[] | null | undefined) {
  let latestRevision: Revision | null = null;
  let latestTime = Number.NEGATIVE_INFINITY;

  for (const revision of revisions ?? []) {
    const revisionTime = toLocalDate(revision.reviewedAt)?.getTime() ?? Number.NEGATIVE_INFINITY;

    if (revisionTime > latestTime) {
      latestTime = revisionTime;
      latestRevision = revision;
    }
  }

  return latestRevision;
}

export function calculateClientRevisionStatus(
  client: Pick<Client, 'createdAt' | 'revisionFrequencyValue' | 'revisionFrequencyUnit'> | null | undefined,
  revisions: Revision[] | null | undefined,
  referenceDate = new Date()
): ClientRevisionStatus {
  const normalizedReference = startOfDay(referenceDate);
  const latestRevision = findLatestRevision(revisions);
  const latestRevisionDate = toLocalDate(latestRevision?.reviewedAt ?? null);
  const fallbackStartDate = toLocalDate(client?.createdAt ?? null) ?? normalizedReference;
  const isConfigured = Boolean(isRevisionFrequencyActive(client?.revisionFrequencyValue, client?.revisionFrequencyUnit));
  const nextRevisionDate = isConfigured
    ? calculateNextRevisionDate(latestRevisionDate ?? fallbackStartDate, client!.revisionFrequencyValue!, client!.revisionFrequencyUnit!)
    : null;
  const isPending = isConfigured && nextRevisionDate !== null ? normalizedReference >= nextRevisionDate : false;

  return {
    isConfigured,
    isPending,
    lastRevisionDate: latestRevisionDate,
    nextRevisionDate,
    referenceDate: normalizedReference,
  };
}
