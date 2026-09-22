import { Ionicons } from '@expo/vector-icons';

import { Accent } from '@/constants/theme';
import { normalizeRevisionPhase } from '@/utils/revisions';

export type PhasePresentation = {
  label: string;
  color: string;
  soft: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
};

// Presentación visual compartida de las fases de revisión: la usan tanto el selector de fase del
// formulario como el selector de preparaciones del análisis, para que un mismo color/icono
// signifique siempre lo mismo en toda la app.
export const PHASE_PRESENTATION: Record<string, PhasePresentation> = {
  inicio: { label: 'Inicio', color: '#6D7E98', soft: '#EEF1F6', icon: 'flag-outline' },
  definicion: { label: 'Definición', color: Accent.primary, soft: '#E8F0FF', icon: 'trending-down-outline' },
  recomposicion: { label: 'Recomposición', color: '#7C3AED', soft: '#F1EBFE', icon: 'sync-outline' },
  volumen: { label: 'Volumen', color: Accent.success, soft: '#E7F8F0', icon: 'trending-up-outline' },
};

export const FALLBACK_PHASE_PRESENTATION: PhasePresentation = {
  label: 'Sin fase',
  color: '#9AA5B5',
  soft: '#F1F3F7',
  icon: 'ellipse-outline',
};

export function getPhasePresentation(phase: string | null | undefined): PhasePresentation {
  const normalized = normalizeRevisionPhase(phase);

  if (!normalized) {
    return FALLBACK_PHASE_PRESENTATION;
  }

  return PHASE_PRESENTATION[normalized] ?? FALLBACK_PHASE_PRESENTATION;
}
