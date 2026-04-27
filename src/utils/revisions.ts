export const REVISION_PHASE_OPTIONS = [
  { label: 'Inicio', value: 'inicio' },
  { label: 'Definicion', value: 'definicion' },
  { label: 'Recomposicion', value: 'recomposicion' },
  { label: 'Volumen', value: 'volumen' },
] as const;

export type RevisionPhase = (typeof REVISION_PHASE_OPTIONS)[number]['value'];

export function isRevisionPhase(value: string): value is RevisionPhase {
  return REVISION_PHASE_OPTIONS.some((option) => option.value === value);
}

export function normalizeRevisionPhase(value: string | null | undefined) {
  const normalizedValue = value?.trim().toLowerCase() ?? '';

  if (normalizedValue === 'inicio') {
    return 'inicio' as const;
  }

  if (normalizedValue === 'definicion') {
    return 'definicion' as const;
  }

  if (normalizedValue === 'recomposicion') {
    return 'recomposicion' as const;
  }

  if (normalizedValue === 'volumen') {
    return 'volumen' as const;
  }

  return '';
}

export function formatRevisionPhase(value: string | null | undefined) {
  const normalizedValue = normalizeRevisionPhase(value);

  if (normalizedValue === 'inicio') {
    return 'Inicio';
  }

  if (normalizedValue === 'definicion') {
    return 'Definicion';
  }

  if (normalizedValue === 'recomposicion') {
    return 'Recomposicion';
  }

  if (normalizedValue === 'volumen') {
    return 'Volumen';
  }

  return value?.trim() || '-';
}

export function serializeRevisionPhase(value: string | null | undefined) {
  const normalizedValue = normalizeRevisionPhase(value);

  if (normalizedValue === 'inicio') {
    return 'Inicio';
  }

  if (normalizedValue === 'definicion') {
    return 'Definicion';
  }

  if (normalizedValue === 'recomposicion') {
    return 'Recomposicion';
  }

  if (normalizedValue === 'volumen') {
    return 'Volumen';
  }

  return null;
}