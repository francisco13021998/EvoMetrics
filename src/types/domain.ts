export type Profile = {
  id: string;
  fullName: string;
  email: string;
  role: 'coach' | 'nutritionist' | 'owner';
  clinicName?: string;
  createdAt: string;
  updatedAt: string;
};

export type ClientSex = 'female' | 'male';

export type AthleteLevel = 'beginner' | 'intermediate' | 'advanced';

export type Client = {
  id: string;
  ownerId: string;
  name: string;
  sex: ClientSex | null;
  athleteLevel: AthleteLevel;
  heightCm: number | null;
  age: number | null;
  createdAt: string;
};

export type Revision = {
  id: string;
  clientId: string;
  phase: string | null;
  bmi: number | null;
  weightKg: number | null;
  weightDiffKg: number | null;
  neckCm: number | null;
  armCm: number | null;
  waistCm: number | null;
  bellyCm: number | null;
  pelvisCm: number | null;
  gluteCm: number | null;
  thighCm: number | null;
  bicepFoldMm: number | null;
  tricepFoldMm: number | null;
  subscapularFoldMm: number | null;
  abdominalFoldMm: number | null;
  suprailiacFoldMm: number | null;
  frontThighFoldMm: number | null;
  calfFoldMm: number | null;
  bodyFatVisualPct: number | null;
  activityFactor: number | null;
  fatMassKg: number | null;
  fatMassDiffKg: number | null;
  leanMassKg: number | null;
  leanMassDiffKg: number | null;
  muscleMassKg: number | null;
  nonMuscleNonFatMassKg: number | null;
  muscleFormulaCode: string | null;
  maintenanceKcal: number | null;
  maintenanceKcalEstimated: number | null;
  targetKcal: number | null;
  perimeterFormulaId: string | null;
  skinfoldFormulaId: string | null;
  notes: string | null;
  reviewedAt: string;
  createdAt: string;
};

export type ClientPhoto = {
  id: string;
  ownerId: string;
  clientId: string;
  revisionId: string | null;
  storagePath: string;
  imageUrl: string;
  type: 'front' | 'side' | 'back' | 'progress';
  capturedAt: string;
  createdAt: string;
};