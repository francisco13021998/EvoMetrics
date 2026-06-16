import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Accent, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatRevisionPhase } from '@/utils/revisions';

import { ThemedText } from '@/components/themed-text';

type RevisionRowProps = {
  phase: string | null | undefined;
  date: string;
  weight: string;
  onPress: () => void;
  last?: boolean;
};

export function RevisionRow({ phase, date, weight, onPress, last = false }: RevisionRowProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !last && { marginBottom: Spacing.one },
        { borderColor: theme.backgroundSelected, opacity: pressed ? 0.92 : 1 },
      ]}>
      <View style={styles.info}>
        <ThemedText type="smallBold">{formatRevisionPhase(phase)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.dateText}>
          {date}
        </ThemedText>
      </View>
      <View style={[styles.weightPill, { borderColor: theme.backgroundSelected, backgroundColor: '#F7FAFF' }]}>
        <ThemedText type="smallBold" style={styles.weightText}>
          {weight}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.arrow}>
        →
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: Spacing.two,
  },
  info: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  dateText: {
    lineHeight: 18,
  },
  weightPill: {
    minWidth: 68,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  weightText: {
    color: Accent.primary,
  },
  arrow: {
    flexShrink: 0,
    color: Accent.primary,
    opacity: 0.7,
  },
});
