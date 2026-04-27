import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Accent, Radius, Spacing } from '@/constants/theme';
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
        { backgroundColor: '#FFFFFF', borderColor: theme.backgroundSelected },
        !last && styles.rowSpacing,
        { opacity: pressed ? 0.84 : 1, transform: [{ scale: pressed ? 0.995 : 1 }] },
      ]}>
      <View style={[styles.avatar, { backgroundColor: Accent.primaryMuted }]}>
        <ThemedText type="smallBold" style={{ color: Accent.primary }}>
          {name.charAt(0).toUpperCase()}
        </ThemedText>
      </View>
      <View style={styles.info}>
        <ThemedText type="smallBold" style={styles.nameText}>{name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
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
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingVertical: 10,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  rowSpacing: {
    marginBottom: Spacing.two,
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
    gap: 1,
    minWidth: 0,
  },
  nameText: {
    flex: 1,
  },
  arrow: {
    flexShrink: 0,
    color: Accent.primary,
  },
});
