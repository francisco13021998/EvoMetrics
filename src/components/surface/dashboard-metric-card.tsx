import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Accent, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type DashboardMetricCardProps = {
  label: string;
  value: string;
  helper?: string;
  tone?: 'primary' | 'neutral';
  variant?: 'metric' | 'placeholder';
  icon?: React.ReactNode;
};

export function DashboardMetricCard({
  label,
  value,
  helper,
  tone = 'neutral',
  variant = 'metric',
  icon,
}: DashboardMetricCardProps) {
  const theme = useTheme();
  const isPlaceholder = variant === 'placeholder';
  const isPrimary = tone === 'primary';

  if (icon !== undefined) {
    return (
      <View
        accessible
        accessibilityLabel={`${label}: ${value}`}
        style={[styles.cardIconBase, isPrimary && styles.cardIconPrimary, { borderColor: theme.backgroundSelected }]}>
        <View style={[styles.iconCircle, isPrimary && styles.iconCirclePrimary]}>{icon}</View>
        <ThemedText adjustsFontSizeToFit numberOfLines={2} minimumFontScale={0.5} style={styles.iconLabel}>
          {label}
        </ThemedText>
        <ThemedText adjustsFontSizeToFit numberOfLines={1} minimumFontScale={0.5} style={styles.iconValue}>
          {value}
        </ThemedText>
        <View style={styles.iconDivider} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.card,
        isPlaceholder ? styles.cardPlaceholder : isPrimary ? styles.cardPrimary : styles.cardNeutral,
        { borderColor: theme.backgroundSelected },
      ]}>
      <View style={styles.headRow}>
        <View
          style={[
            styles.accent,
            isPlaceholder ? styles.accentPlaceholder : isPrimary ? styles.accentPrimary : styles.accentNeutral,
          ]}
        />
        <ThemedText
          type="label"
          themeColor="textSecondary"
          style={[styles.label, isPlaceholder && styles.labelPlaceholder, isPrimary && styles.labelPrimary]}>
          {label}
        </ThemedText>
      </View>

      <View style={styles.body}>
        <ThemedText
          numberOfLines={2}
          style={[
            styles.value,
            isPrimary && styles.valuePrimary,
            isPlaceholder && styles.valuePlaceholder,
          ]}>
          {value}
        </ThemedText>
        <View
          style={[
            styles.metricDivider,
            isPrimary && styles.metricDividerPrimary,
            isPlaceholder && styles.metricDividerPlaceholder,
          ]}
        />
      </View>

      {helper ? (
        <ThemedText
          numberOfLines={2}
          type="small"
          themeColor="textSecondary"
          style={[styles.helper, isPlaceholder && styles.helperPlaceholder]}>
          {helper}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 140,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: Radius.medium,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  cardIconBase: {
    flex: 1,
    minHeight: 132,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: Radius.medium,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    gap: 8,
    overflow: 'hidden',
  },
  cardIconPrimary: {
    backgroundColor: '#F3F7FF',
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: Accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCirclePrimary: {
    backgroundColor: '#1647B5',
  },
  iconLabel: {
    fontSize: 11,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    color: '#4A5E81',
    lineHeight: 13,
  },
  iconValue: {
    color: '#10203B',
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  iconDivider: {
    width: 20,
    height: 3,
    borderRadius: Radius.pill,
    backgroundColor: Accent.primary,
    marginTop: 'auto',
  },
  cardPrimary: {
    backgroundColor: '#F5FAFF',
  },
  cardNeutral: {
    backgroundColor: '#FFFFFF',
  },
  cardPlaceholder: {
    backgroundColor: '#F7FAFF',
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 24,
  },
  accent: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
  },
  accentPrimary: {
    backgroundColor: Accent.primary,
  },
  accentNeutral: {
    backgroundColor: '#7E9BDA',
  },
  accentPlaceholder: {
    backgroundColor: '#9CB7E6',
  },
  label: {
    letterSpacing: 0.3,
    color: '#4A5E81',
    lineHeight: 16,
    fontSize: 12,
  },
  labelPrimary: {
    color: '#2A4E95',
  },
  labelPlaceholder: {
    color: '#526A92',
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: 8,
  },
  value: {
    color: '#10203B',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  valuePrimary: {
    color: Accent.primary,
  },
  valuePlaceholder: {
    color: '#1F3E70',
    fontSize: 26,
    lineHeight: 31,
    letterSpacing: -0.2,
  },
  metricDivider: {
    width: 34,
    height: 3,
    borderRadius: Radius.pill,
    backgroundColor: '#D6E2F4',
  },
  metricDividerPrimary: {
    backgroundColor: '#89ACEF',
  },
  metricDividerPlaceholder: {
    backgroundColor: '#A7C0E9',
  },
  helper: {
    marginTop: 'auto',
    lineHeight: 16,
    fontSize: 13,
    color: '#5C6B86',
  },
  helperPlaceholder: {
    color: '#5A7094',
  },
});
