import { getPerimeterFormulaCodeForSex, getSkinfoldFormulaCodeForAthleteLevel } from '@/constants/body-fat-formulas';
import { Client, Revision } from '@/types/domain';
import { calculateBodyFatFromPerimeters, calculateBodyFatFromSkinfolds } from '@/utils/calculations';
import { calculateAgeFromBirthDate } from '@/utils/client-age';

type AverageSignatureInput = {
  visualBodyFatPct: number | null | undefined;
  perimeterBodyFatPct: number | null | undefined;
  perimeterFormulaId: string | null | undefined;
  skinfoldBodyFatPct: number | null | undefined;
  skinfoldFormulaId: string | null | undefined;
};

type AverageSignatureClientContext = Pick<Client, 'sex' | 'heightCm' | 'birthDate' | 'athleteLevel'>;

function resolvePerimeterComparisonKey(
  clientContext: Pick<Client, 'sex'>,
  revision: Pick<Revision, 'perimeterFormulaId'>,
  perimeterBodyFatPct: number | null
) {
  if (!hasFiniteValue(perimeterBodyFatPct)) {
    return null;
  }

  return revision.perimeterFormulaId ?? getPerimeterFormulaCodeForSex(clientContext.sex);
}

function resolveSkinfoldComparisonKey(
  clientContext: Pick<Client, 'athleteLevel'>,
  revision: Pick<Revision, 'skinfoldFormulaId'>,
  skinfoldBodyFatPct: number | null
) {
  if (!hasFiniteValue(skinfoldBodyFatPct)) {
    return null;
  }

  return revision.skinfoldFormulaId ?? getSkinfoldFormulaCodeForAthleteLevel(clientContext.athleteLevel);
}

function hasFiniteValue(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function getSearchCandidates(revisions: Revision[], currentRevisionId?: string | null) {
  const sortedRevisions = [...revisions].sort(
    (leftRevision, rightRevision) =>
      new Date(rightRevision.reviewedAt).getTime() - new Date(leftRevision.reviewedAt).getTime()
  );

  if (!currentRevisionId) {
    return sortedRevisions;
  }

  const currentRevisionIndex = sortedRevisions.findIndex((revision) => revision.id === currentRevisionId);

  if (currentRevisionIndex === -1) {
    return sortedRevisions;
  }

  return sortedRevisions.slice(currentRevisionIndex + 1);
}

function findPreviousMatchingRevision(
  revisions: Revision[],
  currentRevisionId: string | null | undefined,
  matcher: (revision: Revision) => boolean
) {
  return getSearchCandidates(revisions, currentRevisionId).find(matcher) ?? null;
}

export function findPreviousComparableRevisionByPerimeterFormula(
  revisions: Revision[],
  currentRevisionId: string | null | undefined,
  perimeterFormulaId: string | null | undefined
) {
  if (!perimeterFormulaId) {
    return null;
  }

  return findPreviousMatchingRevision(
    revisions,
    currentRevisionId,
    (revision) => revision.perimeterFormulaId !== null && revision.perimeterFormulaId === perimeterFormulaId
  );
}

export function findPreviousComparableRevisionBySkinfoldFormula(
  revisions: Revision[],
  currentRevisionId: string | null | undefined,
  skinfoldFormulaId: string | null | undefined
) {
  if (!skinfoldFormulaId) {
    return null;
  }

  return findPreviousMatchingRevision(
    revisions,
    currentRevisionId,
    (revision) => revision.skinfoldFormulaId !== null && revision.skinfoldFormulaId === skinfoldFormulaId
  );
}

export function buildBodyFatAverageSignature({
  visualBodyFatPct,
  perimeterBodyFatPct,
  perimeterFormulaId,
  skinfoldBodyFatPct,
  skinfoldFormulaId,
}: AverageSignatureInput) {
  const signatureParts: string[] = [];

  if (hasFiniteValue(visualBodyFatPct)) {
    signatureParts.push('visual');
  }

  if (hasFiniteValue(perimeterBodyFatPct)) {
    if (!perimeterFormulaId) {
      return null;
    }

    signatureParts.push(`perimeters:${perimeterFormulaId}`);
  }

  if (hasFiniteValue(skinfoldBodyFatPct)) {
    if (!skinfoldFormulaId) {
      return null;
    }

    signatureParts.push(`skinfolds:${skinfoldFormulaId}`);
  }

  return signatureParts.length > 0 ? signatureParts.join('+') : null;
}

export function buildRevisionBodyFatAverageSignature(
  clientContext: AverageSignatureClientContext,
  revision: Revision
) {
  const resolvedAge = calculateAgeFromBirthDate(clientContext.birthDate, new Date(revision.reviewedAt));
  const perimeterBodyFatPct = calculateBodyFatFromPerimeters(clientContext.sex, {
    neckCm: revision.neckCm,
    bellyCm: revision.bellyCm,
    gluteCm: revision.gluteCm,
    heightCm: clientContext.heightCm,
  })?.bodyFatPct ?? null;
  const skinfoldBodyFatPct = revision.bodyFatSkinfoldsPct ?? calculateBodyFatFromSkinfolds(clientContext.sex, resolvedAge, {
    bicepFoldMm: revision.bicepFoldMm,
    tricepFoldMm: revision.tricepFoldMm,
    subscapularFoldMm: revision.subscapularFoldMm,
    suprailiacFoldMm: revision.suprailiacFoldMm,
    abdominalFoldMm: revision.abdominalFoldMm,
    frontThighFoldMm: revision.frontThighFoldMm,
    calfFoldMm: revision.calfFoldMm,
  })?.bodyFatPct ?? null;

  return buildBodyFatAverageSignature({
    visualBodyFatPct: revision.bodyFatVisualPct,
    perimeterBodyFatPct,
    perimeterFormulaId: resolvePerimeterComparisonKey(clientContext, revision, perimeterBodyFatPct),
    skinfoldBodyFatPct,
    skinfoldFormulaId: resolveSkinfoldComparisonKey(clientContext, revision, skinfoldBodyFatPct),
  });
}

export function findPreviousComparableRevisionByAverageSignature(
  revisions: Revision[],
  currentRevisionId: string | null | undefined,
  currentSignature: string | null,
  getRevisionSignature: (revision: Revision) => string | null
) {
  if (!currentSignature) {
    return null;
  }

  return findPreviousMatchingRevision(
    revisions,
    currentRevisionId,
    (revision) => getRevisionSignature(revision) === currentSignature
  );
}