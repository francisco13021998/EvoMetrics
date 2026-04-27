import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from '@/components/themed-text';

type MetricRowProps = {
  label: string;
  value: string;
  last?: boolean;
  card?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function MetricRow({ label, value, last = false, card = false, style }: MetricRowProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.row,
        card && [styles.card, { backgroundColor: '#F7FAFF', borderColor: theme.backgroundSelected }],
        !card && !last && { borderBottomColor: theme.backgroundSelected, borderBottomWidth: 1 },
        style,
      ]}>
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
  card: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
  },
  label: {
    flex: 1,
  },
  value: {
    textAlign: 'right',
    flexShrink: 0,
  },
});
