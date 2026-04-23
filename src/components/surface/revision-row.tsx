import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Accent, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatRevisionPhase } from '@/utils/revisions';

import { ThemedText } from '@/components/themed-text';

type RevisionRowProps = {
  phase: string;
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
        !last && { borderBottomColor: theme.backgroundSelected, borderBottomWidth: 1 },
        { opacity: pressed ? 0.7 : 1 },
      ]}>
      <View style={[styles.dot, { backgroundColor: Accent.primary }]} />
      <View style={styles.info}>
        <ThemedText type="smallBold">{formatRevisionPhase(phase)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {date}
        </ThemedText>
      </View>
      <ThemedText type="smallBold" style={{ color: Accent.primary }}>
        {weight}
      </ThemedText>
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
    paddingVertical: Spacing.three,
    gap: Spacing.three,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  arrow: {
    flexShrink: 0,
  },
});
