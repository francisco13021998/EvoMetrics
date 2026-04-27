import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0F1B33',
    background: '#F0F3FA',
    backgroundElement: '#F0F3FA',
    backgroundSelected: '#E3EBF6',
    textSecondary: '#5C6B86',
  },
  dark: {
    text: '#F8FAFC',
    background: '#0F172A',
    backgroundElement: '#182235',
    backgroundSelected: '#22314C',
    textSecondary: '#9DB0D1',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Accent = {
  primary: '#1F57D6',
  primaryMuted: '#DCE7FF',
  success: '#1FA971',
  warning: '#F59E0B',
  danger: '#DC5B5B',
  border: '#DDE6F3',
  borderDark: '#2C3D5E',
  ink: '#0F1B33',
} as const;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 48,
  seven: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const Radius = {
  small: 12,
  medium: 18,
  large: 28,
  pill: 999,
} as const;

export const Shadows = {
  card: {
    shadowColor: '#183153',
    shadowOpacity: 0.08,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
    elevation: 5,
  },
  soft: {
    shadowColor: '#183153',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
} as const;

export const MaxContentWidth = 1120;
