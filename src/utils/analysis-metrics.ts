import { HistoricalRevisionMetrics } from '@/utils/client-history';

export type AnalysisMetricUnit = 'kg' | 'pct' | 'cm' | 'mm' | 'bmi';
export type AnalysisTrendDirection = 'decrease-better' | 'increase-better' | 'neutral';

export type AnalysisMetricDefinition = {
  key: string;
  label: string;
  unit: AnalysisMetricUnit;
  direction: AnalysisTrendDirection;
  accessor: (revision: HistoricalRevisionMetrics) => number | null;
};

export type SecondaryMetricGroupDefinition = {
  id: 'body-fat-measurements' | 'skinfolds' | 'perimeters';
  title: string;
  metricKeys: string[];
};

export const SECONDARY_ANALYSIS_METRICS: AnalysisMetricDefinition[] = [
  { key: 'bmi', label: 'IMC', unit: 'bmi', direction: 'neutral', accessor: (revision) => revision.bmi },
  { key: 'weightKg', label: 'Peso', unit: 'kg', direction: 'neutral', accessor: (revision) => revision.weightKg },
  { key: 'fatMassKg', label: 'Masa grasa', unit: 'kg', direction: 'decrease-better', accessor: (revision) => revision.fatMassKg },
  { key: 'leanMassKg', label: 'Masa libre de grasa', unit: 'kg', direction: 'increase-better', accessor: (revision) => revision.leanMassKg },
  {
    key: 'bodyFatAveragePct',
    label: '% graso medio',
    unit: 'pct',
    direction: 'decrease-better',
    accessor: (revision) => revision.bodyFatAveragePct,
  },
  {
    key: 'bodyFatVisualPct',
    label: '% graso visual',
    unit: 'pct',
    direction: 'decrease-better',
    accessor: (revision) => revision.bodyFatVisualPct,
  },
  {
    key: 'bodyFatSkinfoldsPct',
    label: '% graso pliegues',
    unit: 'pct',
    direction: 'decrease-better',
    accessor: (revision) => revision.bodyFatSkinfoldsPct,
  },
  {
    key: 'bodyFatPerimetersPct',
    label: '% graso perímetros',
    unit: 'pct',
    direction: 'decrease-better',
    accessor: (revision) => revision.bodyFatPerimetersPct,
  },
  {
    key: 'sumSkinfoldsMm',
    label: 'Suma de pliegues',
    unit: 'mm',
    direction: 'decrease-better',
    accessor: (revision) => revision.sumSkinfoldsMm,
  },
  { key: 'neckCm', label: 'Perímetro cuello', unit: 'cm', direction: 'neutral', accessor: (revision) => revision.revision.neckCm },
  { key: 'armCm', label: 'Perímetro brazo', unit: 'cm', direction: 'neutral', accessor: (revision) => revision.revision.armCm },
  {
    key: 'waistCm',
    label: 'Perímetro cintura',
    unit: 'cm',
    direction: 'decrease-better',
    accessor: (revision) => revision.revision.waistCm,
  },
  {
    key: 'bellyCm',
    label: 'Perímetro abdomen',
    unit: 'cm',
    direction: 'decrease-better',
    accessor: (revision) => revision.bellyCm,
  },
  { key: 'pelvisCm', label: 'Perímetro pelvis', unit: 'cm', direction: 'neutral', accessor: (revision) => revision.revision.pelvisCm },
  { key: 'gluteCm', label: 'Perímetro glúteo', unit: 'cm', direction: 'neutral', accessor: (revision) => revision.gluteCm },
  { key: 'thighCm', label: 'Perímetro muslo', unit: 'cm', direction: 'neutral', accessor: (revision) => revision.thighCm },
  { key: 'bicepFoldMm', label: 'Pliegue bíceps', unit: 'mm', direction: 'decrease-better', accessor: (revision) => revision.revision.bicepFoldMm },
  {
    key: 'tricepFoldMm',
    label: 'Pliegue tricipital',
    unit: 'mm',
    direction: 'decrease-better',
    accessor: (revision) => revision.revision.tricepFoldMm,
  },
  {
    key: 'subscapularFoldMm',
    label: 'Pliegue subescapular',
    unit: 'mm',
    direction: 'decrease-better',
    accessor: (revision) => revision.revision.subscapularFoldMm,
  },
  {
    key: 'abdominalFoldMm',
    label: 'Pliegue abdominal',
    unit: 'mm',
    direction: 'decrease-better',
    accessor: (revision) => revision.revision.abdominalFoldMm,
  },
  {
    key: 'suprailiacFoldMm',
    label: 'Pliegue suprailiaco',
    unit: 'mm',
    direction: 'decrease-better',
    accessor: (revision) => revision.revision.suprailiacFoldMm,
  },
  {
    key: 'frontThighFoldMm',
    label: 'Pliegue muslo frontal',
    unit: 'mm',
    direction: 'decrease-better',
    accessor: (revision) => revision.revision.frontThighFoldMm,
  },
  {
    key: 'calfFoldMm',
    label: 'Pliegue pantorrilla',
    unit: 'mm',
    direction: 'decrease-better',
    accessor: (revision) => revision.revision.calfFoldMm,
  },
];

export const SECONDARY_PRIMARY_METRIC_KEYS = [
  'bmi',
  'weightKg',
  'fatMassKg',
  'leanMassKg',
  'bodyFatAveragePct',
] as const;

export const SECONDARY_METRIC_GROUPS: SecondaryMetricGroupDefinition[] = [
  {
    id: 'body-fat-measurements',
    title: 'Mediciones % graso',
    metricKeys: ['bodyFatVisualPct', 'bodyFatPerimetersPct', 'bodyFatSkinfoldsPct'],
  },
  {
    id: 'skinfolds',
    title: 'Pliegues',
    metricKeys: [
      'sumSkinfoldsMm',
      'bicepFoldMm',
      'tricepFoldMm',
      'subscapularFoldMm',
      'abdominalFoldMm',
      'suprailiacFoldMm',
      'frontThighFoldMm',
      'calfFoldMm',
    ],
  },
  {
    id: 'perimeters',
    title: 'Perímetros',
    metricKeys: ['neckCm', 'armCm', 'waistCm', 'bellyCm', 'pelvisCm', 'gluteCm', 'thighCm'],
  },
];

export function getSecondaryAnalysisMetricByKey(metricKey: string) {
  return SECONDARY_ANALYSIS_METRICS.find((metric) => metric.key === metricKey) ?? null;
}
