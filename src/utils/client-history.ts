import { Client, Revision } from '@/types/domain';
import {
    buildCompositionMetrics,
    calculateBmi,
    calculateBodyFatFromPerimeters,
    calculateBodyFatFromSkinfolds,
} from '@/utils/calculations';
import {
    buildRevisionBodyFatAverageSignature,
    findPreviousComparableRevisionByAverageSignature,
    findPreviousComparableRevisionByPerimeterFormula,
    findPreviousComparableRevisionBySkinfoldFormula,
} from '@/utils/revision-comparisons';
import { formatRevisionPhase } from '@/utils/revisions';

export type HistoricalRevisionMetrics = {
  id: string;
  reviewedAt: string;
  phaseLabel: string;
  weightKg: number | null;
  bodyFatAveragePct: number | null;
  bodyFatPerimetersPct: number | null;
  bodyFatSkinfoldsPct: number | null;
  bodyFatVisualPct: number | null;
  fatMassKg: number | null;
  leanMassKg: number | null;
  muscleMassKg: number | null;
  bmi: number | null;
  waistCm: number | null;
  bellyCm: number | null;
  gluteCm: number | null;
  thighCm: number | null;
  sumSkinfoldsMm: number | null;
  notes: string | null;
  revision: Revision;
};

export type AvailableBodyFatAverageResult = {
  bodyFatPct: number;
  roundedBodyFatPct: number;
  sources: number;
};

export type HistoricalComparisonMode = 'visible' | 'history-start' | 'average-homogeneous' | 'perimeter-formula' | 'skinfold-formula';

export type HistoricalMetricComparison = {
  currentValue: number | null;
  previousValue: number | null;
  delta: number | null;
  referenceRevision: HistoricalRevisionMetrics | null;
  missingReferenceLabel: 'Sin referencia' | 'Sin homogénea';
};

function roundTo(value: number, decimals = 2) {
  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}

function hasNumericValue(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function roundDelta(currentValue: number | null, previousValue: number | null) {
  if (!hasNumericValue(currentValue) || !hasNumericValue(previousValue)) {
    return null;
  }

  return roundTo(currentValue - previousValue, 1);
}

function findPreviousVisibleRevisionWithMetric(
  history: HistoricalRevisionMetrics[],
  currentRevisionId: string,
  accessor: (revision: HistoricalRevisionMetrics | null) => number | null
) {
  const currentIndex = history.findIndex((revision) => revision.id === currentRevisionId);

  if (currentIndex === -1) {
    return null;
  }

  return history.slice(currentIndex + 1).find((revision) => hasNumericValue(accessor(revision))) ?? null;
}

function findFirstHistoricalRevisionWithMetric(
  history: HistoricalRevisionMetrics[],
  accessor: (revision: HistoricalRevisionMetrics | null) => number | null
) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const revision = history[index];

    if (hasNumericValue(accessor(revision))) {
      return revision;
    }
  }

  return null;
}

export function calculateAvailableBodyFatAverage(values: {
  visualBodyFatPct: number | null | undefined;
  skinfoldBodyFatPct: number | null | undefined;
  perimeterBodyFatPct: number | null | undefined;
}): AvailableBodyFatAverageResult | null {
  const validValues = [values.visualBodyFatPct, values.skinfoldBodyFatPct, values.perimeterBodyFatPct].filter(hasNumericValue);

  if (validValues.length === 0) {
    return null;
  }

  const bodyFatPct = validValues.reduce((total, value) => total + value, 0) / validValues.length;

  return {
    bodyFatPct: roundTo(bodyFatPct, 4),
    roundedBodyFatPct: Math.round(bodyFatPct),
    sources: validValues.length,
  };
}

export function buildHistoricalRevisionMetrics(client: Client, revisions: Revision[]): HistoricalRevisionMetrics[] {
  return revisions.map((revision) => {
    const perimeterBodyFat = calculateBodyFatFromPerimeters(client.sex, {
      neckCm: revision.neckCm,
      bellyCm: revision.bellyCm,
      gluteCm: revision.gluteCm,
      heightCm: client.heightCm,
    });
    const skinfoldBodyFat = calculateBodyFatFromSkinfolds(client.sex, client.age, {
      bicepFoldMm: revision.bicepFoldMm,
      tricepFoldMm: revision.tricepFoldMm,
      subscapularFoldMm: revision.subscapularFoldMm,
      suprailiacFoldMm: revision.suprailiacFoldMm,
      abdominalFoldMm: revision.abdominalFoldMm,
      frontThighFoldMm: revision.frontThighFoldMm,
      calfFoldMm: revision.calfFoldMm,
    });
    const averageBodyFat = calculateAvailableBodyFatAverage({
      visualBodyFatPct: revision.bodyFatVisualPct,
      skinfoldBodyFatPct: skinfoldBodyFat?.bodyFatPct ?? null,
      perimeterBodyFatPct: perimeterBodyFat?.bodyFatPct ?? null,
    });
    const compositionMetrics = buildCompositionMetrics({
      weightKg: revision.weightKg,
      bodyFatPct: averageBodyFat?.bodyFatPct ?? null,
      fatMassKg: revision.fatMassKg,
      leanMassKg: revision.leanMassKg,
      heightCm: client.heightCm,
      sex: client.sex,
      age: client.age,
    });
    const bmi = revision.bmi ?? calculateBmi(revision.weightKg, client.heightCm);

    return {
      id: revision.id,
      reviewedAt: revision.reviewedAt,
      phaseLabel: formatRevisionPhase(revision.phase),
      weightKg: revision.weightKg,
      bodyFatAveragePct: averageBodyFat?.bodyFatPct ?? null,
      bodyFatPerimetersPct: perimeterBodyFat?.bodyFatPct ?? null,
      bodyFatSkinfoldsPct: skinfoldBodyFat?.bodyFatPct ?? null,
      bodyFatVisualPct: revision.bodyFatVisualPct,
      fatMassKg: compositionMetrics?.fatMassKg ?? null,
      leanMassKg: compositionMetrics?.leanMassKg ?? null,
      muscleMassKg: revision.muscleMassKg ?? compositionMetrics?.muscleMassKg ?? null,
      bmi,
      waistCm: revision.waistCm,
      bellyCm: revision.bellyCm,
      gluteCm: revision.gluteCm,
      thighCm: revision.thighCm,
      sumSkinfoldsMm: skinfoldBodyFat?.sumMm ?? null,
      notes: revision.notes,
      revision,
    };
  });
}

export function resolveHistoricalMetricComparison({
  client,
  history,
  currentRevision,
  mode,
  accessor,
}: {
  client: Client | null;
  history: HistoricalRevisionMetrics[];
  currentRevision: HistoricalRevisionMetrics | null;
  mode: HistoricalComparisonMode;
  accessor: (revision: HistoricalRevisionMetrics | null) => number | null;
}): HistoricalMetricComparison {
  const currentValue = accessor(currentRevision);

  if (!currentRevision) {
    return {
      currentValue: null,
      previousValue: null,
      delta: null,
      referenceRevision: null,
      missingReferenceLabel: mode === 'average-homogeneous' ? 'Sin homogénea' : 'Sin referencia',
    };
  }

  const revisionById = new Map(history.map((revision) => [revision.id, revision]));
  const revisionEntries = history.map((revision) => revision.revision);
  let referenceRevision: HistoricalRevisionMetrics | null = null;

  if (mode === 'visible') {
    referenceRevision = findPreviousVisibleRevisionWithMetric(history, currentRevision.id, accessor);
  }

  if (mode === 'history-start') {
    referenceRevision = findFirstHistoricalRevisionWithMetric(history, accessor);
  }

  if (mode === 'average-homogeneous' && client) {
    const currentSignature = buildRevisionBodyFatAverageSignature(client, currentRevision.revision);
    const comparableRevision = findPreviousComparableRevisionByAverageSignature(
      revisionEntries,
      currentRevision.id,
      currentSignature,
      (candidateRevision) => buildRevisionBodyFatAverageSignature(client, candidateRevision)
    );

    referenceRevision = comparableRevision ? revisionById.get(comparableRevision.id) ?? null : null;
  }

  if (mode === 'perimeter-formula') {
    const comparableRevision = findPreviousComparableRevisionByPerimeterFormula(
      revisionEntries,
      currentRevision.id,
      currentRevision.revision.perimeterFormulaId
    );

    referenceRevision = comparableRevision ? revisionById.get(comparableRevision.id) ?? null : null;
  }

  if (mode === 'skinfold-formula') {
    const comparableRevision = findPreviousComparableRevisionBySkinfoldFormula(
      revisionEntries,
      currentRevision.id,
      currentRevision.revision.skinfoldFormulaId
    );

    referenceRevision = comparableRevision ? revisionById.get(comparableRevision.id) ?? null : null;
  }

  const previousValue = accessor(referenceRevision);

  return {
    currentValue,
    previousValue,
    delta: roundDelta(currentValue, previousValue),
    referenceRevision: hasNumericValue(previousValue) ? referenceRevision : null,
    missingReferenceLabel: mode === 'average-homogeneous' || mode === 'perimeter-formula' || mode === 'skinfold-formula'
      ? 'Sin homogénea'
      : 'Sin referencia',
  };
}