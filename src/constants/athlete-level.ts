import type { BodyFatFormulaCode } from '@/constants/body-fat-formulas';
import { AthleteLevel } from '@/types/domain';

export const DEFAULT_ATHLETE_LEVEL: AthleteLevel = 'beginner';

export const ATHLETE_LEVEL_LABELS: Record<AthleteLevel, string> = {
  beginner: 'Base',
  intermediate: 'Intermedio',
  advanced: 'Avanzado',
};

export type AvailabilityState = {
  enabled: boolean;
  comingSoon: boolean;
};

export type AthleteLevelOption = {
  label: string;
  displayLabel: string;
  value: AthleteLevel;
} & AvailabilityState;

function formatComingSoonLabel(label: string, comingSoon: boolean) {
  return comingSoon ? `${label} · Próximamente` : label;
}

export const ATHLETE_LEVEL_OPTIONS: AthleteLevelOption[] = [
  {
    label: ATHLETE_LEVEL_LABELS.beginner,
    displayLabel: ATHLETE_LEVEL_LABELS.beginner,
    value: 'beginner',
    enabled: true,
    comingSoon: false,
  },
  {
    label: ATHLETE_LEVEL_LABELS.intermediate,
    displayLabel: formatComingSoonLabel(ATHLETE_LEVEL_LABELS.intermediate, true),
    value: 'intermediate',
    enabled: false,
    comingSoon: true,
  },
  {
    label: ATHLETE_LEVEL_LABELS.advanced,
    displayLabel: formatComingSoonLabel(ATHLETE_LEVEL_LABELS.advanced, true),
    value: 'advanced',
    enabled: false,
    comingSoon: true,
  },
];

export type SkinfoldProtocolFieldKey =
  | 'bicepFoldMm'
  | 'tricepFoldMm'
  | 'subscapularFoldMm'
  | 'abdominalFoldMm'
  | 'suprailiacFoldMm'
  | 'frontThighFoldMm'
  | 'calfFoldMm';

export type SkinfoldProtocolConfig = {
  id: string;
  label: string;
  points: number;
  enabled: boolean;
  comingSoon: boolean;
  formulaCode: BodyFatFormulaCode | null;
  shortLabel: string;
  descriptionLines: readonly string[];
  fields: readonly SkinfoldProtocolFieldKey[];
};

function buildProtocolDescription(points: number, comingSoon: boolean) {
  if (comingSoon) {
    return [`${points} pliegues`, 'Próximamente'];
  }

  return [`${points} pliegues`, 'Protocolo activo'];
}

const SKINFOLD_FIELD_KEYS: readonly SkinfoldProtocolFieldKey[] = [
  'bicepFoldMm',
  'tricepFoldMm',
  'subscapularFoldMm',
  'suprailiacFoldMm',
  'abdominalFoldMm',
  'frontThighFoldMm',
  'calfFoldMm',
] as const;

const SKINFOLD_PROTOCOLS_BY_LEVEL: Record<AthleteLevel, SkinfoldProtocolConfig[]> = {
  beginner: [
    {
      id: 'skinfolds_4_beginner',
      label: '4 pliegues',
      points: 4,
      enabled: true,
      comingSoon: false,
      formulaCode: 'skinfolds_durnin_womersley_4_beginner',
      shortLabel: '4 pliegues',
      descriptionLines: buildProtocolDescription(4, false),
      fields: ['bicepFoldMm', 'tricepFoldMm', 'subscapularFoldMm', 'suprailiacFoldMm'],
    },
    {
      id: 'skinfolds_7_beginner_future',
      label: '7 pliegues',
      points: 7,
      enabled: false,
      comingSoon: true,
      formulaCode: null,
      shortLabel: '7 pliegues',
      descriptionLines: buildProtocolDescription(7, true),
      fields: SKINFOLD_FIELD_KEYS,
    },
  ],
  intermediate: [
    {
      id: 'skinfolds_6_intermediate_future',
      label: '6 pliegues',
      points: 6,
      enabled: false,
      comingSoon: true,
      formulaCode: null,
      shortLabel: '6 pliegues',
      descriptionLines: buildProtocolDescription(6, true),
      fields: SKINFOLD_FIELD_KEYS.slice(0, 6),
    },
    {
      id: 'skinfolds_7_intermediate_future',
      label: '7 pliegues',
      points: 7,
      enabled: false,
      comingSoon: true,
      formulaCode: null,
      shortLabel: '7 pliegues',
      descriptionLines: buildProtocolDescription(7, true),
      fields: SKINFOLD_FIELD_KEYS,
    },
  ],
  advanced: [
    {
      id: 'skinfolds_6_advanced_future',
      label: '6 pliegues',
      points: 6,
      enabled: false,
      comingSoon: true,
      formulaCode: null,
      shortLabel: '6 pliegues',
      descriptionLines: buildProtocolDescription(6, true),
      fields: SKINFOLD_FIELD_KEYS.slice(0, 6),
    },
    {
      id: 'skinfolds_7_advanced_future',
      label: '7 pliegues',
      points: 7,
      enabled: false,
      comingSoon: true,
      formulaCode: null,
      shortLabel: '7 pliegues',
      descriptionLines: buildProtocolDescription(7, true),
      fields: SKINFOLD_FIELD_KEYS,
    },
  ],
};

export function getAvailableSkinfoldProtocolsForAthleteLevel(value: string | null | undefined) {
  return SKINFOLD_PROTOCOLS_BY_LEVEL[normalizeAthleteLevel(value)];
}

export function getActiveSkinfoldProtocolForAthleteLevel(value: string | null | undefined) {
  return getAvailableSkinfoldProtocolsForAthleteLevel(value).find((protocol) => protocol.enabled) ?? null;
}

export function getSkinfoldProtocolConfigByAthleteLevel(value: string | null | undefined) {
  return getActiveSkinfoldProtocolForAthleteLevel(value) ?? getAvailableSkinfoldProtocolsForAthleteLevel(value)[0] ?? null;
}

export function normalizeAthleteLevel(value: string | null | undefined): AthleteLevel {
  if (value === 'beginner' || value === 'intermediate' || value === 'advanced') {
    return value;
  }

  return DEFAULT_ATHLETE_LEVEL;
}

export function formatAthleteLevelLabel(value: string | null | undefined) {
  return ATHLETE_LEVEL_LABELS[normalizeAthleteLevel(value)];
}