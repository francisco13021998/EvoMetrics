type RevisionComparisonSnapshot = {
  weightKg: number | null;
  bodyFatVisualPct: number | null;
  fatMassKg?: number | null;
  leanMassKg?: number | null;
};

function roundTo(value: number, decimals = 2) {
  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}

export function calculateBmi(weightKg: number | null, heightCm: number | null) {
  if (!weightKg || !heightCm) {
    return null;
  }

  const heightM = heightCm / 100;

  if (heightM <= 0) {
    return null;
  }

  return roundTo(weightKg / (heightM * heightM));
}

export function calculateWeightDiffKg(
  currentWeightKg: number | null,
  previousRevision: Pick<RevisionComparisonSnapshot, 'weightKg'> | null
) {
  if (currentWeightKg === null || previousRevision?.weightKg === null || previousRevision?.weightKg === undefined) {
    return null;
  }

  return roundTo(currentWeightKg - previousRevision.weightKg);
}

export function calculateFatMassKg(weightKg: number | null, bodyFatVisualPct: number | null) {
  if (weightKg === null || bodyFatVisualPct === null) {
    return null;
  }

  return roundTo(weightKg * (bodyFatVisualPct / 100));
}

export function calculateLeanMassKg(weightKg: number | null, fatMassKg: number | null) {
  if (weightKg === null || fatMassKg === null) {
    return null;
  }

  return roundTo(weightKg - fatMassKg);
}

export function calculateFatMassDiffKg(
  currentFatMassKg: number | null,
  previousRevision: RevisionComparisonSnapshot | null
) {
  const previousFatMassKg =
    previousRevision?.fatMassKg ??
    calculateFatMassKg(previousRevision?.weightKg ?? null, previousRevision?.bodyFatVisualPct ?? null);

  if (currentFatMassKg === null || previousFatMassKg === null) {
    return null;
  }

  return roundTo(currentFatMassKg - previousFatMassKg);
}

export function calculateLeanMassDiffKg(
  currentLeanMassKg: number | null,
  previousRevision: RevisionComparisonSnapshot | null
) {
  const previousFatMassKg =
    previousRevision?.fatMassKg ??
    calculateFatMassKg(previousRevision?.weightKg ?? null, previousRevision?.bodyFatVisualPct ?? null);
  const previousLeanMassKg =
    previousRevision?.leanMassKg ??
    calculateLeanMassKg(previousRevision?.weightKg ?? null, previousFatMassKg);

  if (currentLeanMassKg === null || previousLeanMassKg === null) {
    return null;
  }

  return roundTo(currentLeanMassKg - previousLeanMassKg);
}

export function bodyFatPerimetersPct() {
  return null;
}

export function bodyFatSkinfoldsPct() {
  return null;
}

export const body_fat_perimeters_pct = bodyFatPerimetersPct;
export const body_fat_skinfolds_pct = bodyFatSkinfoldsPct;