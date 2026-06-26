import { normalizeAthleteLevel } from '@/constants/athlete-level';
import { getPerimeterFormulaCodeForSex, getSkinfoldFormulaCodeForAthleteLevel } from '@/constants/body-fat-formulas';
import { supabase } from '@/lib/supabase';
import { bodyFatFormulasService } from '@/services/body-fat-formulas';
import { CLIENTS_TABLE } from '@/services/clients';
import { Revision } from '@/types/domain';
import { isSupportedActivityFactor } from '@/utils/activity';
import {
    buildCompositionMetrics,
    calculateBmi,
    calculateBodyFatAverage,
    calculateBodyFatFromPerimeters,
    calculateBodyFatFromSkinfolds,
    calculateFatMassDiffKg,
    calculateLeanMassDiffKg,
    calculateMaintenanceCalories,
    calculateWeightDiffKg,
} from '@/utils/calculations';
import { calculateAgeFromBirthDate } from '@/utils/client-age';
import { serializeRevisionPhase } from '@/utils/revisions';

export const REVISIONS_TABLE = 'revisions';

type DbRevisionRow = {
  id: string;
  owner_id: string;
  client_id: string;
  phase: string | null;
  bmi: number | null;
  weight_kg: number | null;
  weight_diff_kg: number | null;
  neck_cm: number | null;
  arm_cm: number | null;
  waist_cm: number | null;
  belly_cm: number | null;
  pelvis_cm: number | null;
  glute_cm: number | null;
  thigh_cm: number | null;
  bicep_fold_mm: number | null;
  tricep_fold_mm: number | null;
  subscapular_fold_mm: number | null;
  abdominal_fold_mm: number | null;
  suprailiac_fold_mm: number | null;
  front_thigh_fold_mm: number | null;
  calf_fold_mm: number | null;
  body_fat_visual_pct: number | null;
  body_fat_skinfolds_pct: number | null;
  body_fat_pct: number | null;
  activity_factor: number | null;
  fat_mass_kg: number | null;
  fat_mass_diff_kg: number | null;
  lean_mass_kg: number | null;
  lean_mass_diff_kg: number | null;
  maintenance_kcal: number | null;
  maintenance_kcal_estimated: number | null;
  target_kcal: number | null;
  perimeter_formula_id: string | null;
  skinfold_formula_id: string | null;
  notes: string | null;
  reviewed_at: string;
  created_at: string;
};

type ClientMetricsRow = {
  height_cm: number | null;
  date_birth: string | null;
  sex: string | null;
  athlete_level: string | null;
};

export type CreateRevisionInput = {
  ownerId: string;
  clientId: string;
  phase?: string | null;
  reviewedAt?: string | null;
  weightKg?: number | null;
  neckCm?: number | null;
  armCm?: number | null;
  waistCm?: number | null;
  bellyCm?: number | null;
  pelvisCm?: number | null;
  gluteCm?: number | null;
  thighCm?: number | null;
  bicepFoldMm?: number | null;
  tricepFoldMm?: number | null;
  subscapularFoldMm?: number | null;
  abdominalFoldMm?: number | null;
  suprailiacFoldMm?: number | null;
  frontThighFoldMm?: number | null;
  calfFoldMm?: number | null;
  bodyFatVisualPct?: number | null;
  activityFactor?: number | null;
  maintenanceKcal?: number | null;
  maintenanceKcalEstimated?: number | null;
  targetKcal?: number | null;
  perimeterFormulaId?: string | null;
  skinfoldFormulaId?: string | null;
  notes?: string | null;
};

export type UpdateRevisionInput = Partial<Omit<CreateRevisionInput, 'clientId'>>;

function normalizeClientSex(value: string | null) {
  if (!value) {
    return null;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === 'female' || normalizedValue === 'mujer') {
    return 'female' as const;
  }

  if (normalizedValue === 'male' || normalizedValue === 'hombre') {
    return 'male' as const;
  }

  return null;
}

function mapDbRevision(row: DbRevisionRow): Revision {
  return {
    id: row.id,
    clientId: row.client_id,
    phase: row.phase,
    bmi: row.bmi,
    weightKg: row.weight_kg,
    weightDiffKg: row.weight_diff_kg,
    neckCm: row.neck_cm,
    armCm: row.arm_cm,
    waistCm: row.waist_cm,
    bellyCm: row.belly_cm,
    pelvisCm: row.pelvis_cm,
    gluteCm: row.glute_cm,
    thighCm: row.thigh_cm,
    bicepFoldMm: row.bicep_fold_mm,
    tricepFoldMm: row.tricep_fold_mm,
    subscapularFoldMm: row.subscapular_fold_mm,
    abdominalFoldMm: row.abdominal_fold_mm,
    suprailiacFoldMm: row.suprailiac_fold_mm,
    frontThighFoldMm: row.front_thigh_fold_mm,
    calfFoldMm: row.calf_fold_mm,
    bodyFatVisualPct: row.body_fat_visual_pct,
    bodyFatSkinfoldsPct: row.body_fat_skinfolds_pct,
    bodyFatPct: row.body_fat_pct,
    activityFactor: row.activity_factor,
    fatMassKg: row.fat_mass_kg,
    fatMassDiffKg: row.fat_mass_diff_kg,
    leanMassKg: row.lean_mass_kg,
    leanMassDiffKg: row.lean_mass_diff_kg,
    maintenanceKcal: row.maintenance_kcal,
    maintenanceKcalEstimated: row.maintenance_kcal_estimated,
    targetKcal: row.target_kcal,
    perimeterFormulaId: row.perimeter_formula_id,
    skinfoldFormulaId: row.skinfold_formula_id,
    notes: row.notes,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

type RevisionComputedMetrics = {
  bmi: number | null;
  weightDiffKg: number | null;
  bodyFatPct: number | null;
  bodyFatSkinfoldsPct: number | null;
  fatMassKg: number | null;
  fatMassDiffKg: number | null;
  leanMassKg: number | null;
  leanMassDiffKg: number | null;
  maintenanceKcalEstimated: number | null;
  perimeterFormulaId: string | null;
  skinfoldFormulaId: string | null;
};

async function getClientMetrics(clientId: string) {
  const { data, error } = await supabase
    .from(CLIENTS_TABLE)
    .select('height_cm, date_birth, sex, athlete_level')
    .eq('id', clientId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const clientMetrics = data as ClientMetricsRow | null;

  return {
    heightCm: clientMetrics?.height_cm ?? null,
    birthDate: clientMetrics?.date_birth ?? null,
    sex: normalizeClientSex(clientMetrics?.sex ?? null),
    athleteLevel: normalizeAthleteLevel(clientMetrics?.athlete_level),
  };
}

async function getPreviousRevisionSnapshot(clientId: string, excludeRevisionId?: string) {
  let query = supabase
    .from(REVISIONS_TABLE)
    .select('weight_kg, body_fat_visual_pct, fat_mass_kg, lean_mass_kg')
    .eq('client_id', clientId)
    .order('reviewed_at', { ascending: false })
    .limit(1);

  if (excludeRevisionId) {
    query = query.neq('id', excludeRevisionId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data
    ? {
        weightKg: data.weight_kg as number | null,
        bodyFatVisualPct: data.body_fat_visual_pct as number | null,
        fatMassKg: data.fat_mass_kg as number | null,
        leanMassKg: data.lean_mass_kg as number | null,
      }
    : null;
}

async function buildComputedMetrics(payload: CreateRevisionInput, excludeRevisionId?: string): Promise<RevisionComputedMetrics> {
  const [clientMetrics, previousRevision] = await Promise.all([
    getClientMetrics(payload.clientId),
    getPreviousRevisionSnapshot(payload.clientId, excludeRevisionId),
  ]);

  const [perimeterFormula, skinfoldFormula] = await Promise.all([
    payload.perimeterFormulaId === undefined
      ? bodyFatFormulasService.getByCode(getPerimeterFormulaCodeForSex(clientMetrics.sex))
      : Promise.resolve(null),
    payload.skinfoldFormulaId === undefined
      ? bodyFatFormulasService.getByCode(getSkinfoldFormulaCodeForAthleteLevel(clientMetrics.athleteLevel))
      : Promise.resolve(null),
  ]);

  const normalizedActivityFactor = isSupportedActivityFactor(payload.activityFactor ?? null)
    ? Number((payload.activityFactor ?? 0).toFixed(2))
    : null;
  const revisionAge = calculateAgeFromBirthDate(
    clientMetrics.birthDate,
    payload.reviewedAt ? new Date(payload.reviewedAt) : new Date()
  );
  const perimeterBodyFat = calculateBodyFatFromPerimeters(clientMetrics.sex, {
    neckCm: payload.neckCm ?? null,
    bellyCm: payload.bellyCm ?? null,
    gluteCm: payload.gluteCm ?? null,
    heightCm: clientMetrics.heightCm,
  });
  const skinfoldBodyFat = calculateBodyFatFromSkinfolds(clientMetrics.sex, revisionAge, {
    bicepFoldMm: payload.bicepFoldMm ?? null,
    tricepFoldMm: payload.tricepFoldMm ?? null,
    subscapularFoldMm: payload.subscapularFoldMm ?? null,
    suprailiacFoldMm: payload.suprailiacFoldMm ?? null,
    abdominalFoldMm: payload.abdominalFoldMm ?? null,
    frontThighFoldMm: payload.frontThighFoldMm ?? null,
    calfFoldMm: payload.calfFoldMm ?? null,
  });
  const computedBodyFat = calculateBodyFatAverage({
    visualBodyFatPct: payload.bodyFatVisualPct ?? null,
    skinfoldBodyFatPct: skinfoldBodyFat?.bodyFatPct ?? null,
    perimeterBodyFatPct: perimeterBodyFat?.bodyFatPct ?? null,
  });
  const compositionMetrics = buildCompositionMetrics({
    weightKg: payload.weightKg ?? null,
    bodyFatPct: computedBodyFat?.bodyFatPct ?? null,
  });
  const bmi = calculateBmi(payload.weightKg ?? null, clientMetrics.heightCm);
  const weightDiffKg = calculateWeightDiffKg(payload.weightKg ?? null, previousRevision);
  const bodyFatPct = computedBodyFat?.bodyFatPct ?? null;
  const bodyFatSkinfoldsPct = skinfoldBodyFat?.bodyFatPct ?? null;
  const fatMassKg = compositionMetrics?.fatMassKg ?? null;
  const leanMassKg = compositionMetrics?.leanMassKg ?? null;
  const fatMassDiffKg = calculateFatMassDiffKg(fatMassKg, previousRevision);
  const leanMassDiffKg = calculateLeanMassDiffKg(leanMassKg, previousRevision);
  const maintenanceKcalEstimated = calculateMaintenanceCalories({
    sex: clientMetrics.sex,
    weightKg: payload.weightKg ?? null,
    heightCm: clientMetrics.heightCm,
    age: calculateAgeFromBirthDate(
      clientMetrics.birthDate,
      payload.reviewedAt ? new Date(payload.reviewedAt) : new Date()
    ),
    activityFactor: normalizedActivityFactor,
  });

  return {
    bmi,
    weightDiffKg,
    bodyFatPct,
    bodyFatSkinfoldsPct,
    fatMassKg,
    fatMassDiffKg,
    leanMassKg,
    leanMassDiffKg,
    maintenanceKcalEstimated,
    perimeterFormulaId: payload.perimeterFormulaId === undefined ? perimeterFormula?.id ?? null : payload.perimeterFormulaId ?? null,
    skinfoldFormulaId: payload.skinfoldFormulaId === undefined ? skinfoldFormula?.id ?? null : payload.skinfoldFormulaId ?? null,
  };
}

function mapCreatePayload(payload: CreateRevisionInput, metrics: RevisionComputedMetrics) {
  const now = new Date().toISOString();
  const reviewedAt = payload.reviewedAt ? toDateOnlyIso(payload.reviewedAt) : toDateOnlyIso(new Date().toISOString());

  return {
    owner_id: payload.ownerId,
    client_id: payload.clientId,
    phase: serializeRevisionPhase(payload.phase),
    bmi: metrics.bmi,
    weight_kg: payload.weightKg ?? null,
    weight_diff_kg: metrics.weightDiffKg,
    neck_cm: payload.neckCm ?? null,
    arm_cm: payload.armCm ?? null,
    waist_cm: payload.waistCm ?? null,
    belly_cm: payload.bellyCm ?? null,
    pelvis_cm: payload.pelvisCm ?? null,
    glute_cm: payload.gluteCm ?? null,
    thigh_cm: payload.thighCm ?? null,
    bicep_fold_mm: payload.bicepFoldMm ?? null,
    tricep_fold_mm: payload.tricepFoldMm ?? null,
    subscapular_fold_mm: payload.subscapularFoldMm ?? null,
    abdominal_fold_mm: payload.abdominalFoldMm ?? null,
    suprailiac_fold_mm: payload.suprailiacFoldMm ?? null,
    front_thigh_fold_mm: payload.frontThighFoldMm ?? null,
    calf_fold_mm: payload.calfFoldMm ?? null,
    body_fat_visual_pct: payload.bodyFatVisualPct ?? null,
    body_fat_skinfolds_pct: metrics.bodyFatSkinfoldsPct,
    body_fat_pct: metrics.bodyFatPct,
    activity_factor: isSupportedActivityFactor(payload.activityFactor ?? null)
      ? Number((payload.activityFactor ?? 0).toFixed(2))
      : null,
    fat_mass_kg: metrics.fatMassKg,
    fat_mass_diff_kg: metrics.fatMassDiffKg,
    lean_mass_kg: metrics.leanMassKg,
    lean_mass_diff_kg: metrics.leanMassDiffKg,
    maintenance_kcal: payload.maintenanceKcal ?? null,
    maintenance_kcal_estimated: metrics.maintenanceKcalEstimated,
    target_kcal: payload.targetKcal ?? null,
    perimeter_formula_id: metrics.perimeterFormulaId,
    skinfold_formula_id: metrics.skinfoldFormulaId,
    notes: payload.notes ?? null,
    reviewed_at: reviewedAt,
    created_at: now,
  };
}

function mapUpdatePayload(payload: CreateRevisionInput, metrics: RevisionComputedMetrics) {
  return {
    ...(payload.ownerId ? { owner_id: payload.ownerId } : {}),
    ...(payload.phase !== undefined ? { phase: serializeRevisionPhase(payload.phase) } : {}),
    bmi: metrics.bmi,
    ...(payload.weightKg !== undefined ? { weight_kg: payload.weightKg } : {}),
    weight_diff_kg: metrics.weightDiffKg,
    ...(payload.neckCm !== undefined ? { neck_cm: payload.neckCm } : {}),
    ...(payload.armCm !== undefined ? { arm_cm: payload.armCm } : {}),
    ...(payload.waistCm !== undefined ? { waist_cm: payload.waistCm } : {}),
    ...(payload.bellyCm !== undefined ? { belly_cm: payload.bellyCm } : {}),
    ...(payload.pelvisCm !== undefined ? { pelvis_cm: payload.pelvisCm } : {}),
    ...(payload.gluteCm !== undefined ? { glute_cm: payload.gluteCm } : {}),
    ...(payload.thighCm !== undefined ? { thigh_cm: payload.thighCm } : {}),
    ...(payload.bicepFoldMm !== undefined ? { bicep_fold_mm: payload.bicepFoldMm } : {}),
    ...(payload.tricepFoldMm !== undefined ? { tricep_fold_mm: payload.tricepFoldMm } : {}),
    ...(payload.subscapularFoldMm !== undefined ? { subscapular_fold_mm: payload.subscapularFoldMm } : {}),
    ...(payload.abdominalFoldMm !== undefined ? { abdominal_fold_mm: payload.abdominalFoldMm } : {}),
    ...(payload.suprailiacFoldMm !== undefined ? { suprailiac_fold_mm: payload.suprailiacFoldMm } : {}),
    ...(payload.frontThighFoldMm !== undefined ? { front_thigh_fold_mm: payload.frontThighFoldMm } : {}),
    ...(payload.calfFoldMm !== undefined ? { calf_fold_mm: payload.calfFoldMm } : {}),
    ...(payload.bodyFatVisualPct !== undefined ? { body_fat_visual_pct: payload.bodyFatVisualPct } : {}),
    body_fat_skinfolds_pct: metrics.bodyFatSkinfoldsPct,
    body_fat_pct: metrics.bodyFatPct,
    ...(payload.activityFactor !== undefined
      ? {
          activity_factor:
            typeof payload.activityFactor === 'number' && isSupportedActivityFactor(payload.activityFactor)
              ? Number(payload.activityFactor.toFixed(2))
              : null,
        }
      : {}),
    fat_mass_kg: metrics.fatMassKg,
    fat_mass_diff_kg: metrics.fatMassDiffKg,
    lean_mass_kg: metrics.leanMassKg,
    lean_mass_diff_kg: metrics.leanMassDiffKg,
    ...(payload.maintenanceKcal !== undefined ? { maintenance_kcal: payload.maintenanceKcal } : {}),
    maintenance_kcal_estimated: metrics.maintenanceKcalEstimated,
    ...(payload.targetKcal !== undefined ? { target_kcal: payload.targetKcal } : {}),
    perimeter_formula_id: metrics.perimeterFormulaId,
    skinfold_formula_id: metrics.skinfoldFormulaId,
    ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
    ...(payload.reviewedAt !== undefined ? { reviewed_at: payload.reviewedAt ? toDateOnlyIso(payload.reviewedAt) : null } : {}),
  };
}

function toDateOnlyIso(value: string) {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)).toISOString();
  }

  return new Date(Date.UTC(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), 0, 0, 0, 0)).toISOString();
}

export const revisionsService = {
  async listByClient(clientId: string) {
    const { data, error } = await supabase
      .from(REVISIONS_TABLE)
      .select('*')
      .eq('client_id', clientId)
      .order('reviewed_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data as DbRevisionRow[] | null)?.map(mapDbRevision) ?? [];
  },

  async getById(revisionId: string) {
    const { data, error } = await supabase
      .from(REVISIONS_TABLE)
      .select('*')
      .eq('id', revisionId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data ? mapDbRevision(data as DbRevisionRow) : null;
  },

  async create(payload: CreateRevisionInput) {
    if (payload.weightKg === null || payload.weightKg === undefined) {
      throw new Error('Indica un peso para crear la revision.');
    }

    const computedMetrics = await buildComputedMetrics(payload);
    const { data, error } = await supabase
      .from(REVISIONS_TABLE)
      .insert({
        ...mapCreatePayload(payload, computedMetrics),
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapDbRevision(data as DbRevisionRow);
  },

  async update(revisionId: string, payload: UpdateRevisionInput) {
    const currentRevision = await this.getById(revisionId);

    if (!currentRevision) {
      throw new Error('La revision que intentas actualizar no existe.');
    }

    const mergedPayload: CreateRevisionInput = {
      ownerId: payload.ownerId ?? '',
      clientId: currentRevision.clientId,
      phase: payload.phase ?? currentRevision.phase,
      reviewedAt: payload.reviewedAt ?? currentRevision.reviewedAt,
      weightKg: payload.weightKg ?? currentRevision.weightKg,
      neckCm: payload.neckCm ?? currentRevision.neckCm,
      armCm: payload.armCm ?? currentRevision.armCm,
      waistCm: payload.waistCm ?? currentRevision.waistCm,
      bellyCm: payload.bellyCm ?? currentRevision.bellyCm,
      pelvisCm: payload.pelvisCm ?? currentRevision.pelvisCm,
      gluteCm: payload.gluteCm ?? currentRevision.gluteCm,
      thighCm: payload.thighCm ?? currentRevision.thighCm,
      bicepFoldMm: payload.bicepFoldMm ?? currentRevision.bicepFoldMm,
      tricepFoldMm: payload.tricepFoldMm ?? currentRevision.tricepFoldMm,
      subscapularFoldMm: payload.subscapularFoldMm ?? currentRevision.subscapularFoldMm,
      abdominalFoldMm: payload.abdominalFoldMm ?? currentRevision.abdominalFoldMm,
      suprailiacFoldMm: payload.suprailiacFoldMm ?? currentRevision.suprailiacFoldMm,
      frontThighFoldMm: payload.frontThighFoldMm ?? currentRevision.frontThighFoldMm,
      calfFoldMm: payload.calfFoldMm ?? currentRevision.calfFoldMm,
      bodyFatVisualPct: payload.bodyFatVisualPct ?? currentRevision.bodyFatVisualPct,
      activityFactor: payload.activityFactor ?? currentRevision.activityFactor,
      maintenanceKcal: payload.maintenanceKcal ?? currentRevision.maintenanceKcal,
      maintenanceKcalEstimated: payload.maintenanceKcalEstimated ?? currentRevision.maintenanceKcalEstimated,
      targetKcal: payload.targetKcal ?? currentRevision.targetKcal,
      notes: payload.notes ?? currentRevision.notes,
    };

    const computedMetrics = await buildComputedMetrics(mergedPayload, revisionId);
    const { data, error } = await supabase
      .from(REVISIONS_TABLE)
      .update({
        ...mapUpdatePayload(mergedPayload, computedMetrics),
      })
      .eq('id', revisionId)
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapDbRevision(data as DbRevisionRow);
  },

  async remove(revisionId: string) {
    const { error } = await supabase.from(REVISIONS_TABLE).delete().eq('id', revisionId);

    if (error) {
      throw new Error(error.message);
    }
  },
};