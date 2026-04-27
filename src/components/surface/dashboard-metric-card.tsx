import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Accent, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type DashboardMetricCardProps = {
  label: string;
  value: string;
  helper?: string;
  tone?: 'primary' | 'neutral';
};

export function DashboardMetricCard({
  label,
  value,
  helper,
  tone = 'neutral',
}: DashboardMetricCardProps) {
  const theme = useTheme();

  return (
    <View style={[styles.card, { borderColor: theme.backgroundSelected }]}>
      <View style={[styles.accent, tone === 'primary' ? styles.accentPrimary : styles.accentNeutral]} />
      <ThemedText type="label" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText style={[styles.value, tone === 'primary' && styles.valuePrimary]}>{value}</ThemedText>
      {helper ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.helper}>
          {helper}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 100,
    padding: Spacing.two,
    borderRadius: Radius.medium,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    gap: 2,
  },
  accent: {
    width: 24,
    height: 4,
    borderRadius: Radius.pill,
    marginBottom: 2,
  },
  accentPrimary: {
    backgroundColor: Accent.primary,
  },
  accentNeutral: {
    backgroundColor: '#D7E4FF',
  },
  value: {
    color: '#10203B',
    fontSize: 26,
    lineHeight: 30,
    fontWeight: 700,
  },
  valuePrimary: {
    color: Accent.primary,
  },
  helper: {
    marginTop: 'auto',
    lineHeight: 17,
  },
});