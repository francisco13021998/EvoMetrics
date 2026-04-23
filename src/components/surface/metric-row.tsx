import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from '@/components/themed-text';

type MetricRowProps = {
  label: string;
  value: string;
  last?: boolean;
};

export function MetricRow({ label, value, last = false }: MetricRowProps) {
  const theme = useTheme();

  return (
    <View style={[styles.row, !last && { borderBottomColor: theme.backgroundSelected, borderBottomWidth: 1 }]}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
        {label}
      </ThemedText>
      <ThemedText type="smallBold" style={styles.value}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    gap: Spacing.three,
  },
  label: {
    flex: 1,
  },
  value: {
    textAlign: 'right',
    flexShrink: 0,
  },
});
