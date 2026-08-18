export type UserRole = 'trainer' | 'athlete' | 'coach' | 'nutritionist' | 'owner';

export type Profile = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  clinicName?: string;
  createdAt: string;
  updatedAt: string;
};

export function isTrainer(role: UserRole): boolean {
  return role === 'trainer' || role === 'coach' || role === 'nutritionist' || role === 'owner';
}

export function isAthlete(role: UserRole): boolean {
  return role === 'athlete';
}

export type ClientSex = 'female' | 'male';

export type AthleteLevel = 'beginner' | 'intermediate' | 'advanced';

export type BillingFrequency = 'one_time' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

export type RevisionFrequencyUnit = 'week' | 'month';

export type Client = {
  id: string;
  ownerId: string;
  athleteUserId: string | null;
  name: string;
  sex: ClientSex | null;
  athleteLevel: AthleteLevel;
  heightCm: number | null;
  birthDate: string | null;
  coachingPrice: number;
  billingFrequency: BillingFrequency;
  forcePaymentPending: boolean;
  estado: 'activo' | 'baja';
  revisionFrequencyValue: number | null;
  revisionFrequencyUnit: RevisionFrequencyUnit | null;
  createdAt: string;
};

export type ClientPayment = {
  id: string;
  clientId: string;
  amount: number;
  paymentDate: string;
  dueDate: string;
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
  bodyFatSkinfoldsPct: number | null;
  bodyFatPct: number | null;
  activityFactor: number | null;
  fatMassKg: number | null;
  fatMassDiffKg: number | null;
  leanMassKg: number | null;
  leanMassDiffKg: number | null;
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
  type: string;
  capturedAt: string;
  createdAt: string;
};

export type EventKind = 'call' | 'meeting' | 'visit' | 'training' | 'other';

export type EventRecurrenceFrequency = 'daily' | 'weekly' | 'monthly';

export type EventRecurrenceEndType = 'never' | 'until' | 'count';

export type EventOccurrenceStatus = 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';

export type Event = {
  id: string;
  ownerId: string;
  clientId: string | null;
  title: string;
  description: string | null;
  location: string | null;
  kind: EventKind;
  startDate: string;
  startTime: string;
  durationMinutes: number;
  timezone: string;
  allDay: boolean;
  recurrenceEnabled: boolean;
  recurrenceFrequency: EventRecurrenceFrequency | null;
  recurrenceInterval: number | null;
  recurrenceWeekdays: number[] | null;
  recurrenceMonthDay: number | null;
  recurrenceEndType: EventRecurrenceEndType | null;
  recurrenceEndDate: string | null;
  recurrenceCount: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EventOccurrence = {
  id: string;
  eventId: string;
  ownerId: string;
  clientId: string | null;
  plannedStartAt: string;
  plannedEndAt: string;
  status: EventOccurrenceStatus;
  completedAt: string | null;
  cancelledAt: string | null;
  rescheduledFromOccurrenceId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};