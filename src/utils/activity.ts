export type ActivityFactorOption = {
  value: number;
  label: string;
  description: string;
};

export const ACTIVITY_FACTOR_OPTIONS: ActivityFactorOption[] = [
  {
    value: 1.3,
    label: 'Trabajo sentado y casi sin ejercicio',
    description: 'Trabajo sentado y casi sin ejercicio',
  },
  {
    value: 1.45,
    label: '1-2 entrenos por semana y vida sedentaria',
    description: '1-2 entrenos por semana y vida sedentaria',
  },
  {
    value: 1.6,
    label: '3-4 entrenos por semana o actividad normal',
    description: '3-4 entrenos por semana o actividad normal',
  },
  {
    value: 1.75,
    label: '3-5 entrenos por semana o trabajo activo',
    description: '3-5 entrenos por semana o trabajo activo',
  },
  {
    value: 1.9,
    label: '5-6 entrenos por semana o trabajo físico',
    description: '5-6 entrenos por semana o trabajo físico',
  },
  {
    value: 2.1,
    label: 'Entrena casi a diario y se mueve mucho',
    description: 'Entrena casi a diario y se mueve mucho',
  },
  {
    value: 2.25,
    label: 'Trabajo muy físico o gasto muy alto',
    description: 'Trabajo muy físico o gasto muy alto',
  },
];

export function formatActivityFactorValue(value: number) {
  return value.toFixed(2);
}

export function findActivityFactorOption(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }

  const normalizedValue = Number(value.toFixed(2));

  return ACTIVITY_FACTOR_OPTIONS.find((option) => Number(option.value.toFixed(2)) === normalizedValue) ?? null;
}

export function isSupportedActivityFactor(value: number | null | undefined) {
  return findActivityFactorOption(value) !== null;
}
