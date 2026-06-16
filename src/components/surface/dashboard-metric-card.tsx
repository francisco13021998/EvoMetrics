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
};

export function DashboardMetricCard({
  label,
  value,
  helper,
  tone = 'neutral',
  variant = 'metric',
}: DashboardMetricCardProps) {
  const theme = useTheme();
  const isPlaceholder = variant === 'placeholder';
  const isPrimary = tone === 'primary';

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
    minHeight: 136,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: Radius.medium,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    gap: 8,
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
    minHeight: 26,
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
    lineHeight: 17,
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
    gap: 9,
  },
  value: {
    color: '#10203B',
    fontSize: 29,
    lineHeight: 34,
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
    lineHeight: 17,
    fontSize: 13,
    color: '#5C6B86',
  },
  helperPlaceholder: {
    color: '#5A7094',
  },
});