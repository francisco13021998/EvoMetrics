import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Accent, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from '@/components/themed-text';

type ClientRowProps = {
  name: string;
  meta: string;
  onPress: () => void;
  last?: boolean;
};

export function ClientRow({ name, meta, onPress, last = false }: ClientRowProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !last && { borderBottomColor: theme.backgroundSelected, borderBottomWidth: 1 },
        { opacity: pressed ? 0.7 : 1 },
      ]}>
      <View style={[styles.avatar, { backgroundColor: Accent.primaryMuted }]}>
        <ThemedText type="smallBold" style={{ color: Accent.primary }}>
          {name.charAt(0).toUpperCase()}
        </ThemedText>
      </View>
      <View style={styles.info}>
        <ThemedText type="smallBold">{name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {meta}
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
    paddingVertical: Spacing.three,
    gap: Spacing.three,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
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
