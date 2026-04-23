export const REVISION_PHASE_OPTIONS = [
  { label: 'Definicion', value: 'definicion' },
  { label: 'Volumen', value: 'volumen' },
] as const;

export type RevisionPhase = (typeof REVISION_PHASE_OPTIONS)[number]['value'];

export function isRevisionPhase(value: string): value is RevisionPhase {
  return REVISION_PHASE_OPTIONS.some((option) => option.value === value);
}

export function normalizeRevisionPhase(value: string | null | undefined) {
  const normalizedValue = value?.trim().toLowerCase() ?? '';

  if (normalizedValue === 'definicion' || normalizedValue === 'inicio') {
    return 'definicion' as const;
  }

  if (normalizedValue === 'volumen') {
    return 'volumen' as const;
  }

  return '';
}

export function formatRevisionPhase(value: string | null | undefined) {
  const normalizedValue = normalizeRevisionPhase(value);

  if (normalizedValue === 'definicion') {
    return 'Definicion';
  }

  if (normalizedValue === 'volumen') {
    return 'Volumen';
  }

  return value?.trim() || '-';
}