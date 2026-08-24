import { Revision } from '@/types/domain';
import {
  calculateClientRevisionStatus,
  calculateNextRevisionDate,
  isRevisionFrequencyActive,
} from '@/utils/client-revisions';
import { formatDateOnly } from '@/utils/date-only';

function makeRevision(overrides: Partial<Revision>): Revision {
  return {
    id: 'revision-1',
    clientId: 'cliente-1',
    phase: null,
    bmi: null,
    weightKg: null,
    weightDiffKg: null,
    neckCm: null,
    armCm: null,
    waistCm: null,
    bellyCm: null,
    pelvisCm: null,
    gluteCm: null,
    thighCm: null,
    bicepFoldMm: null,
    tricepFoldMm: null,
    subscapularFoldMm: null,
    abdominalFoldMm: null,
    suprailiacFoldMm: null,
    frontThighFoldMm: null,
    calfFoldMm: null,
    bodyFatVisualPct: null,
    bodyFatSkinfoldsPct: null,
    bodyFatPct: null,
    activityFactor: null,
    fatMassKg: null,
    fatMassDiffKg: null,
    leanMassKg: null,
    leanMassDiffKg: null,
    maintenanceKcal: null,
    maintenanceKcalEstimated: null,
    targetKcal: null,
    perimeterFormulaId: null,
    skinfoldFormulaId: null,
    notes: null,
    reviewedAt: '2026-08-01',
    createdAt: '2026-08-01T10:00:00Z',
    ...overrides,
  };
}

describe('isRevisionFrequencyActive', () => {
  it('null, 0 y el centinela 9999 significan "sin frecuencia"', () => {
    expect(isRevisionFrequencyActive(null, 'week')).toBe(false);
    expect(isRevisionFrequencyActive(0, 'week')).toBe(false);
    expect(isRevisionFrequencyActive(9999, 'week')).toBe(false);
    expect(isRevisionFrequencyActive(2, null)).toBe(false);
  });

  it('valor positivo + unidad = activa', () => {
    expect(isRevisionFrequencyActive(2, 'week')).toBe(true);
    expect(isRevisionFrequencyActive(1, 'month')).toBe(true);
  });
});

describe('próxima fecha de revisión', () => {
  it('semanal multiplica por 7 días', () => {
    expect(formatDateOnly(calculateNextRevisionDate(new Date(2026, 7, 1), 2, 'week'))).toBe('2026-08-15');
  });

  it('mensual recorta a fin de mes', () => {
    expect(formatDateOnly(calculateNextRevisionDate(new Date(2026, 0, 31), 1, 'month'))).toBe('2026-02-28');
  });
});

describe('estado de revisión del cliente', () => {
  const client = {
    createdAt: '2026-01-01T00:00:00Z',
    revisionFrequencyValue: 1,
    revisionFrequencyUnit: 'week' as const,
  };

  it('usa la revisión con reviewedAt más reciente sin confiar en el orden del array', () => {
    const revisions = [
      makeRevision({ id: 'antigua', reviewedAt: '2026-07-01' }),
      makeRevision({ id: 'reciente', reviewedAt: '2026-08-18' }),
    ];

    const status = calculateClientRevisionStatus(client, revisions, new Date(2026, 7, 20));

    expect(formatDateOnly(status.lastRevisionDate!)).toBe('2026-08-18');
    expect(formatDateOnly(status.nextRevisionDate!)).toBe('2026-08-25');
    expect(status.isPending).toBe(false);
  });

  it('pendiente cuando la frecuencia venció', () => {
    const revisions = [makeRevision({ reviewedAt: '2026-08-01' })];
    const status = calculateClientRevisionStatus(client, revisions, new Date(2026, 7, 20));

    expect(status.isPending).toBe(true);
  });

  it('sin frecuencia configurada nunca está pendiente', () => {
    const status = calculateClientRevisionStatus(
      { ...client, revisionFrequencyValue: 9999 },
      [makeRevision({ reviewedAt: '2026-01-01' })],
      new Date(2026, 7, 20)
    );

    expect(status.isConfigured).toBe(false);
    expect(status.isPending).toBe(false);
    expect(status.nextRevisionDate).toBeNull();
  });
});
