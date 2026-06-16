type RevisionComparisonSnapshot = {
  weightKg: number | null;
  bodyFatVisualPct: number | null;
  fatMassKg?: number | null;
  leanMassKg?: number | null;
};

type SupportedSkinfoldSex = 'female' | 'male';
type SupportedPerimeterSex = 'female' | 'male';
type SupportedMaintenanceSex = 'female' | 'male';

export type BodyFatPerimeterInput = {
  neckCm: number | null | undefined;
  bellyCm: number | null | undefined;
  gluteCm: number | null | undefined;
  heightCm: number | null | undefined;
};

export type BodyFatAverageInput = {
  visualBodyFatPct: number | null | undefined;
  skinfoldBodyFatPct: number | null | undefined;
  perimeterBodyFatPct: number | null | undefined;
};

export type MaintenanceCaloriesInput = {
  sex: SupportedMaintenanceSex | null | undefined;
  weightKg: number | null | undefined;
  heightCm: number | null | undefined;
  age: number | null | undefined;
  activityFactor: number | null | undefined;
};

export type ResolvedMaintenanceInput = {
  estimatedMaintenanceKcal: number | null | undefined;
  manualMaintenanceKcal: number | null | undefined;
  useManualMaintenance: boolean;
};

export type ResolvedMaintenanceResult = {
  maintenanceKcal: number;
  source: 'estimated' | 'manual';
};

export type CaloricBalanceResult = {
  percentage: number;
  roundedPercentage: number;
  state: 'deficit' | 'surplus' | 'maintenance';
  label: string;
};

export type CompositionMetricsInput = {
  weightKg: number | null | undefined;
  bodyFatPct: number | null | undefined;
  fatMassKg?: number | null | undefined;
  leanMassKg?: number | null | undefined;
};

export type CompositionMetricsResult = {
  fatMassKg: number;
  leanMassKg: number;
};

export const FEMALE_BODY_FAT_SKINFOLD_KEYS = [
  'bicepFoldMm',
  'tricepFoldMm',
  'subscapularFoldMm',
  'abdominalFoldMm',
  'suprailiacFoldMm',
  'frontThighFoldMm',
  'calfFoldMm',
] as const;

export const ACTIVE_BODY_FAT_SKINFOLD_KEYS = [
  'bicepFoldMm',
  'tricepFoldMm',
  'subscapularFoldMm',
  'suprailiacFoldMm',
] as const;

export const FEMALE_PERIMETER_BODY_FAT_COEFFICIENTS = {
  densityBase: 1.29579,
  baseLogFactor: 0.35004,
  heightLogFactor: 0.221,
} as const;

export const MALE_PERIMETER_BODY_FAT_COEFFICIENTS = {
  densityBase: 1.0324,
  baseLogFactor: 0.19077,
  heightLogFactor: 0.15456,
} as const;

export type FemaleBodyFatSkinfoldKey = (typeof FEMALE_BODY_FAT_SKINFOLD_KEYS)[number];

export type FemaleBodyFatSkinfoldInput = Record<FemaleBodyFatSkinfoldKey, number | null | undefined>;

export type FemaleBodyFatSkinfoldResult = {
  sumMm: number;
  bodyDensity: number;
  bodyFatPct: number;
  roundedBodyFatPct: number;
};

export type BodyFatPerimetersResult = {
  baseCm: number;
  bodyFatPct: number;
  roundedBodyFatPct: number;
};

export type BodyFatAverageResult = {
  bodyFatPct: number;
  roundedBodyFatPct: number;
};

export type DurninWomersleyAgeBracket = '17-19' | '20-29' | '30-39' | '40-49' | '50+';

export type DurninWomersleyConstants = {
  ageBracket: DurninWomersleyAgeBracket;
  c: number;
  m: number;
};

const DURNIN_WOMERSLEY_CONSTANTS: Record<SupportedSkinfoldSex, Record<DurninWomersleyAgeBracket, DurninWomersleyConstants>> = {
  male: {
    '17-19': { ageBracket: '17-19', c: 1.162, m: 0.063 },
    '20-29': { ageBracket: '20-29', c: 1.1631, m: 0.0632 },
    '30-39': { ageBracket: '30-39', c: 1.1422, m: 0.0544 },
    '40-49': { ageBracket: '40-49', c: 1.162, m: 0.07 },
    '50+': { ageBracket: '50+', c: 1.1715, m: 0.0779 },
  },
  female: {
    '17-19': { ageBracket: '17-19', c: 1.1549, m: 0.0678 },
    '20-29': { ageBracket: '20-29', c: 1.1599, m: 0.0717 },
    '30-39': { ageBracket: '30-39', c: 1.1423, m: 0.0632 },
    '40-49': { ageBracket: '40-49', c: 1.1333, m: 0.0612 },
    '50+': { ageBracket: '50+', c: 1.1339, m: 0.0645 },
  },
};

function resolveDurninWomersleyAgeBracket(age: number) {
  if (age <= 19) {
    return '17-19' as const;
  }

  if (age <= 29) {
    return '20-29' as const;
  }

  if (age <= 39) {
    return '30-39' as const;
  }

  if (age <= 49) {
    return '40-49' as const;
  }

  return '50+' as const;
}

export function getDurninWomersleyConstants(
  sex: SupportedSkinfoldSex | null | undefined,
  age: number | null | undefined
) {
  const resolvedAge = getValidNumericValue(age);

  if (!sex || resolvedAge === null || resolvedAge <= 0) {
    return null;
  }

  return DURNIN_WOMERSLEY_CONSTANTS[sex][resolveDurninWomersleyAgeBracket(resolvedAge)] ?? null;
}

export type DurninWomersleyInput = {
  bicepFoldMm: number | null | undefined;
  tricepFoldMm: number | null | undefined;
  subscapularFoldMm: number | null | undefined;
  suprailiacFoldMm: number | null | undefined;
};

export function calculateDurninWomersleyBodyFat(
  sex: SupportedSkinfoldSex | null | undefined,
  age: number | null | undefined,
  values: DurninWomersleyInput
): FemaleBodyFatSkinfoldResult | null {
  const constants = getDurninWomersleyConstants(sex, age);

  if (!constants) {
    return null;
  }

  const measurements = ACTIVE_BODY_FAT_SKINFOLD_KEYS.map((key) => getValidNumericValue(values[key]));

  if (measurements.some((value) => value === null)) {
    return null;
  }

  const numericMeasurements = measurements as number[];
  const sumMm = numericMeasurements.reduce((total, value) => total + value, 0);

  if (sumMm <= 0) {
    return null;
  }

  const bodyDensity = constants.c - constants.m * Math.log10(sumMm);

  if (!Number.isFinite(bodyDensity) || bodyDensity <= 0) {
    return null;
  }

  const bodyFatPct = 495 / bodyDensity - 450;

  if (!Number.isFinite(bodyFatPct)) {
    return null;
  }

  return {
    sumMm: roundTo(sumMm, 2),
    bodyDensity: roundTo(bodyDensity, 4),
    bodyFatPct: roundTo(bodyFatPct, 4),
    roundedBodyFatPct: Math.round(bodyFatPct),
  };
}

function roundTo(value: number, decimals = 2) {
  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}

function hasValidNumericValue(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function getValidNumericValue(value: number | null | undefined): number | null {
  return hasValidNumericValue(value) ? value : null;
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

export function buildCompositionMetrics(values: CompositionMetricsInput): CompositionMetricsResult | null {
  const fatMassKg = getValidNumericValue(values.fatMassKg) ?? calculateFatMassKg(values.weightKg ?? null, values.bodyFatPct ?? null);
  const leanMassKg = getValidNumericValue(values.leanMassKg) ?? calculateLeanMassKg(values.weightKg ?? null, fatMassKg);

  if (!hasValidNumericValue(fatMassKg) || !hasValidNumericValue(leanMassKg)) {
    return null;
  }

  return {
    fatMassKg,
    leanMassKg,
  };
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

export function calculateFemaleBodyFatFromPerimeters(
  values: BodyFatPerimeterInput
): BodyFatPerimetersResult | null {
  const neckCm = getValidNumericValue(values.neckCm);
  const bellyCm = getValidNumericValue(values.bellyCm);
  const gluteCm = getValidNumericValue(values.gluteCm);
  const heightCm = getValidNumericValue(values.heightCm);

  if (neckCm === null || bellyCm === null || gluteCm === null || heightCm === null) {
    return null;
  }

  const baseCm = bellyCm + gluteCm - neckCm;

  if (baseCm <= 0 || heightCm <= 0) {
    return null;
  }

  const denominator =
    FEMALE_PERIMETER_BODY_FAT_COEFFICIENTS.densityBase -
    FEMALE_PERIMETER_BODY_FAT_COEFFICIENTS.baseLogFactor * Math.log10(baseCm) +
    FEMALE_PERIMETER_BODY_FAT_COEFFICIENTS.heightLogFactor * Math.log10(heightCm);

  if (!Number.isFinite(denominator) || denominator === 0) {
    return null;
  }

  const bodyFatPct = 495 / denominator - 450;

  if (!Number.isFinite(bodyFatPct)) {
    return null;
  }

  return {
    baseCm: roundTo(baseCm, 2),
    bodyFatPct: roundTo(bodyFatPct, 4),
    roundedBodyFatPct: Math.round(bodyFatPct),
  };
}

export function calculateMaleBodyFatFromPerimeters(
  values: BodyFatPerimeterInput
): BodyFatPerimetersResult | null {
  const neckCm = getValidNumericValue(values.neckCm);
  const bellyCm = getValidNumericValue(values.bellyCm);
  const heightCm = getValidNumericValue(values.heightCm);

  if (neckCm === null || bellyCm === null || heightCm === null) {
    return null;
  }

  const baseCm = bellyCm - neckCm;

  if (baseCm <= 0 || heightCm <= 0) {
    return null;
  }

  const denominator =
    MALE_PERIMETER_BODY_FAT_COEFFICIENTS.densityBase -
    MALE_PERIMETER_BODY_FAT_COEFFICIENTS.baseLogFactor * Math.log10(baseCm) +
    MALE_PERIMETER_BODY_FAT_COEFFICIENTS.heightLogFactor * Math.log10(heightCm);

  if (!Number.isFinite(denominator) || denominator === 0) {
    return null;
  }

  const bodyFatPct = 495 / denominator - 450;

  if (!Number.isFinite(bodyFatPct)) {
    return null;
  }

  return {
    baseCm: roundTo(baseCm, 2),
    bodyFatPct: roundTo(bodyFatPct, 4),
    roundedBodyFatPct: Math.round(bodyFatPct),
  };
}

export function calculateBodyFatFromPerimeters(
  sex: SupportedPerimeterSex | null | undefined,
  values: BodyFatPerimeterInput
) {
  if (!sex) {
    return null;
  }

  if (sex === 'female') {
    return calculateFemaleBodyFatFromPerimeters(values);
  }

  return calculateMaleBodyFatFromPerimeters(values);
}

export function calculateBodyFatAverage(values: BodyFatAverageInput): BodyFatAverageResult | null {
  const { visualBodyFatPct, skinfoldBodyFatPct, perimeterBodyFatPct } = values;

  const measurements = [visualBodyFatPct, skinfoldBodyFatPct, perimeterBodyFatPct].filter(
    (value): value is number => hasValidNumericValue(value)
  );

  if (measurements.length === 0) {
    return null;
  }

  const bodyFatPct = measurements.reduce((total, value) => total + value, 0) / measurements.length;

  if (!Number.isFinite(bodyFatPct)) {
    return null;
  }

  return {
    bodyFatPct: roundTo(bodyFatPct, 4),
    roundedBodyFatPct: Math.round(bodyFatPct),
  };
}

export function calculateBodyFatFromSkinfolds(
  sex: SupportedSkinfoldSex | null | undefined,
  age: number | null | undefined,
  values: FemaleBodyFatSkinfoldInput
): FemaleBodyFatSkinfoldResult | null {
  return calculateDurninWomersleyBodyFat(sex, age, values);
}

export function calculateFemaleBodyFatFromSkinfolds(
  age: number | null | undefined,
  values: FemaleBodyFatSkinfoldInput
): FemaleBodyFatSkinfoldResult | null {
  return calculateBodyFatFromSkinfolds('female', age, values);
}

export function calculateMaleBodyFatFromSkinfolds(
  age: number | null | undefined,
  values: FemaleBodyFatSkinfoldInput
): FemaleBodyFatSkinfoldResult | null {
  return calculateBodyFatFromSkinfolds('male', age, values);
}

export function bodyFatSkinfoldsPct(
  sex: SupportedSkinfoldSex | null | undefined,
  age: number | null | undefined,
  values: FemaleBodyFatSkinfoldInput
) {
  return calculateBodyFatFromSkinfolds(sex, age, values)?.bodyFatPct ?? null;
}

export function bodyFatPerimetersPct(
  sex: SupportedPerimeterSex | null | undefined,
  values: BodyFatPerimeterInput
) {
  return calculateBodyFatFromPerimeters(sex, values)?.bodyFatPct ?? null;
}

export const body_fat_perimeters_pct = bodyFatPerimetersPct;
export const body_fat_skinfolds_pct = bodyFatSkinfoldsPct;

export function calculateMaintenanceCalories(values: MaintenanceCaloriesInput) {
  const { sex } = values;
  const weightKg = getValidNumericValue(values.weightKg);
  const heightCm = getValidNumericValue(values.heightCm);
  const age = getValidNumericValue(values.age);
  const activityFactor = getValidNumericValue(values.activityFactor);

  if (
    !sex ||
    weightKg === null ||
    heightCm === null ||
    age === null ||
    activityFactor === null
  ) {
    return null;
  }

  if (weightKg <= 0 || heightCm <= 0 || age <= 0 || activityFactor <= 0) {
    return null;
  }

  const ree = sex === 'male'
    ? (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5
    : (10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161;

  if (!Number.isFinite(ree)) {
    return null;
  }

  const maintenanceCalories = ree * activityFactor;

  if (!Number.isFinite(maintenanceCalories)) {
    return null;
  }

  return roundTo(maintenanceCalories, 2);
}

export function resolveUsedMaintenance(values: ResolvedMaintenanceInput): ResolvedMaintenanceResult | null {
  const { useManualMaintenance } = values;
  const estimatedMaintenanceKcal = getValidNumericValue(values.estimatedMaintenanceKcal);
  const manualMaintenanceKcal = getValidNumericValue(values.manualMaintenanceKcal);

  if (useManualMaintenance) {
    if (manualMaintenanceKcal === null || manualMaintenanceKcal <= 0) {
      return null;
    }

    return {
      maintenanceKcal: roundTo(manualMaintenanceKcal, 2),
      source: 'manual',
    };
  }

  if (estimatedMaintenanceKcal === null || estimatedMaintenanceKcal <= 0) {
    return null;
  }

  return {
    maintenanceKcal: roundTo(estimatedMaintenanceKcal, 2),
    source: 'estimated',
  };
}

export function calculateCaloricBalance(
  currentIntakeKcal: number | null | undefined,
  maintenanceKcal: number | null | undefined
): CaloricBalanceResult | null {
  const resolvedCurrentIntakeKcal = getValidNumericValue(currentIntakeKcal);
  const resolvedMaintenanceKcal = getValidNumericValue(maintenanceKcal);

  if (resolvedCurrentIntakeKcal === null || resolvedMaintenanceKcal === null || resolvedMaintenanceKcal <= 0) {
    return null;
  }

  const percentage = ((resolvedCurrentIntakeKcal - resolvedMaintenanceKcal) / resolvedMaintenanceKcal) * 100;

  if (!Number.isFinite(percentage)) {
    return null;
  }

  if (Math.abs(percentage) < 1) {
    return {
      percentage: roundTo(percentage, 4),
      roundedPercentage: 0,
      state: 'maintenance',
      label: '0% mantenimiento',
    };
  }

  const roundedPercentage = Math.round(percentage);

  return {
    percentage: roundTo(percentage, 4),
    roundedPercentage,
    state: roundedPercentage > 0 ? 'surplus' : 'deficit',
    label: roundedPercentage > 0 ? `+${roundedPercentage}% superavit` : `${roundedPercentage}% deficit`,
  };
}

export function calculateFemalePerimeterBodyFat(values: BodyFatPerimeterInput) {
  return calculateFemaleBodyFatFromPerimeters(values);
}

export function calculateMalePerimeterBodyFat(values: BodyFatPerimeterInput) {
  return calculateMaleBodyFatFromPerimeters(values);
}