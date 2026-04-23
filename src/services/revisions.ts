import { supabase } from '@/lib/supabase';
import { CLIENTS_TABLE } from '@/services/clients';
import { Revision } from '@/types/domain';
import {
    calculateBmi,
    calculateFatMassDiffKg,
    calculateFatMassKg,
    calculateLeanMassDiffKg,
    calculateLeanMassKg,
    calculateWeightDiffKg,
} from '@/utils/calculations';

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
  tricep_fold_mm: number | null;
  subscapular_fold_mm: number | null;
  abdominal_fold_mm: number | null;
  suprailiac_fold_mm: number | null;
  front_thigh_fold_mm: number | null;
  calf_fold_mm: number | null;
  body_fat_visual_pct: number | null;
  fat_mass_kg: number | null;
  fat_mass_diff_kg: number | null;
  lean_mass_kg: number | null;
  lean_mass_diff_kg: number | null;
  maintenance_kcal: number | null;
  target_kcal: number | null;
  notes: string | null;
  reviewed_at: string;
  created_at: string;
};

type ClientMetricsRow = {
  height_cm: number | null;
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
  tricepFoldMm?: number | null;
  subscapularFoldMm?: number | null;
  abdominalFoldMm?: number | null;
  suprailiacFoldMm?: number | null;
  frontThighFoldMm?: number | null;
  calfFoldMm?: number | null;
  bodyFatVisualPct?: number | null;
  maintenanceKcal?: number | null;
  targetKcal?: number | null;
  notes?: string | null;
};

export type UpdateRevisionInput = Partial<Omit<CreateRevisionInput, 'clientId'>>;

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
    tricepFoldMm: row.tricep_fold_mm,
    subscapularFoldMm: row.subscapular_fold_mm,
    abdominalFoldMm: row.abdominal_fold_mm,
    suprailiacFoldMm: row.suprailiac_fold_mm,
    frontThighFoldMm: row.front_thigh_fold_mm,
    calfFoldMm: row.calf_fold_mm,
    bodyFatVisualPct: row.body_fat_visual_pct,
    fatMassKg: row.fat_mass_kg,
    fatMassDiffKg: row.fat_mass_diff_kg,
    leanMassKg: row.lean_mass_kg,
    leanMassDiffKg: row.lean_mass_diff_kg,
    maintenanceKcal: row.maintenance_kcal,
    targetKcal: row.target_kcal,
    notes: row.notes,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

type RevisionComputedMetrics = {
  bmi: number | null;
  weightDiffKg: number | null;
  fatMassKg: number | null;
  fatMassDiffKg: number | null;
  leanMassKg: number | null;
  leanMassDiffKg: number | null;
};

async function getClientHeightCm(clientId: string) {
  const { data, error } = await supabase
    .from(CLIENTS_TABLE)
    .select('height_cm')
    .eq('id', clientId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as ClientMetricsRow | null)?.height_cm ?? null;
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
  const [heightCm, previousRevision] = await Promise.all([
    getClientHeightCm(payload.clientId),
    getPreviousRevisionSnapshot(payload.clientId, excludeRevisionId),
  ]);

  const bmi = calculateBmi(payload.weightKg ?? null, heightCm);
  const weightDiffKg = calculateWeightDiffKg(payload.weightKg ?? null, previousRevision);
  const fatMassKg = calculateFatMassKg(payload.weightKg ?? null, payload.bodyFatVisualPct ?? null);
  const leanMassKg = calculateLeanMassKg(payload.weightKg ?? null, fatMassKg);
  const fatMassDiffKg = calculateFatMassDiffKg(fatMassKg, previousRevision);
  const leanMassDiffKg = calculateLeanMassDiffKg(leanMassKg, previousRevision);

  return {
    bmi,
    weightDiffKg,
    fatMassKg,
    fatMassDiffKg,
    leanMassKg,
    leanMassDiffKg,
  };
}

function mapCreatePayload(payload: CreateRevisionInput, metrics: RevisionComputedMetrics) {
  return {
    owner_id: payload.ownerId,
    client_id: payload.clientId,
    phase: payload.phase ?? null,
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
    tricep_fold_mm: payload.tricepFoldMm ?? null,
    subscapular_fold_mm: payload.subscapularFoldMm ?? null,
    abdominal_fold_mm: payload.abdominalFoldMm ?? null,
    suprailiac_fold_mm: payload.suprailiacFoldMm ?? null,
    front_thigh_fold_mm: payload.frontThighFoldMm ?? null,
    calf_fold_mm: payload.calfFoldMm ?? null,
    body_fat_visual_pct: payload.bodyFatVisualPct ?? null,
    fat_mass_kg: metrics.fatMassKg,
    fat_mass_diff_kg: metrics.fatMassDiffKg,
    lean_mass_kg: metrics.leanMassKg,
    lean_mass_diff_kg: metrics.leanMassDiffKg,
    maintenance_kcal: payload.maintenanceKcal ?? null,
    target_kcal: payload.targetKcal ?? null,
    notes: payload.notes ?? null,
    reviewed_at: payload.reviewedAt ?? new Date().toISOString(),
  };
}

function mapUpdatePayload(payload: CreateRevisionInput, metrics: RevisionComputedMetrics) {
  return {
    ...(payload.ownerId ? { owner_id: payload.ownerId } : {}),
    ...(payload.phase !== undefined ? { phase: payload.phase } : {}),
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
    ...(payload.tricepFoldMm !== undefined ? { tricep_fold_mm: payload.tricepFoldMm } : {}),
    ...(payload.subscapularFoldMm !== undefined ? { subscapular_fold_mm: payload.subscapularFoldMm } : {}),
    ...(payload.abdominalFoldMm !== undefined ? { abdominal_fold_mm: payload.abdominalFoldMm } : {}),
    ...(payload.suprailiacFoldMm !== undefined ? { suprailiac_fold_mm: payload.suprailiacFoldMm } : {}),
    ...(payload.frontThighFoldMm !== undefined ? { front_thigh_fold_mm: payload.frontThighFoldMm } : {}),
    ...(payload.calfFoldMm !== undefined ? { calf_fold_mm: payload.calfFoldMm } : {}),
    ...(payload.bodyFatVisualPct !== undefined ? { body_fat_visual_pct: payload.bodyFatVisualPct } : {}),
    fat_mass_kg: metrics.fatMassKg,
    fat_mass_diff_kg: metrics.fatMassDiffKg,
    lean_mass_kg: metrics.leanMassKg,
    lean_mass_diff_kg: metrics.leanMassDiffKg,
    ...(payload.maintenanceKcal !== undefined ? { maintenance_kcal: payload.maintenanceKcal } : {}),
    ...(payload.targetKcal !== undefined ? { target_kcal: payload.targetKcal } : {}),
    ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
    ...(payload.reviewedAt !== undefined ? { reviewed_at: payload.reviewedAt } : {}),
  };
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
    const computedMetrics = await buildComputedMetrics(payload);
    const { data, error } = await supabase
      .from(REVISIONS_TABLE)
      .insert(mapCreatePayload(payload, computedMetrics))
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
      ownerId: payload.ownerId ?? (currentRevision as unknown as { ownerId?: string }).ownerId ?? '',
      clientId: currentRevision.clientId,
      phase: payload.phase ?? currentRevision.phase,
      weightKg: payload.weightKg ?? currentRevision.weightKg,
      neckCm: payload.neckCm ?? currentRevision.neckCm,
      armCm: payload.armCm ?? currentRevision.armCm,
      waistCm: payload.waistCm ?? currentRevision.waistCm,
      bellyCm: payload.bellyCm ?? currentRevision.bellyCm,
      pelvisCm: payload.pelvisCm ?? currentRevision.pelvisCm,
      gluteCm: payload.gluteCm ?? currentRevision.gluteCm,
      thighCm: payload.thighCm ?? currentRevision.thighCm,
      tricepFoldMm: payload.tricepFoldMm ?? currentRevision.tricepFoldMm,
      subscapularFoldMm: payload.subscapularFoldMm ?? currentRevision.subscapularFoldMm,
      abdominalFoldMm: payload.abdominalFoldMm ?? currentRevision.abdominalFoldMm,
      suprailiacFoldMm: payload.suprailiacFoldMm ?? currentRevision.suprailiacFoldMm,
      frontThighFoldMm: payload.frontThighFoldMm ?? currentRevision.frontThighFoldMm,
      calfFoldMm: payload.calfFoldMm ?? currentRevision.calfFoldMm,
      bodyFatVisualPct: payload.bodyFatVisualPct ?? currentRevision.bodyFatVisualPct,
      maintenanceKcal: payload.maintenanceKcal ?? currentRevision.maintenanceKcal,
      targetKcal: payload.targetKcal ?? currentRevision.targetKcal,
      notes: payload.notes ?? currentRevision.notes,
    };

    const computedMetrics = await buildComputedMetrics(mergedPayload, revisionId);
    const { data, error } = await supabase
      .from(REVISIONS_TABLE)
      .update(mapUpdatePayload(mergedPayload, computedMetrics))
      .eq('id', revisionId)
      .eq('owner_id', mergedPayload.ownerId)
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