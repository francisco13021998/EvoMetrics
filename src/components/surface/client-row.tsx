import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Accent, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from '@/components/themed-text';

type ClientRowProps = {
  name: string;
  meta?: string;
  onPress: () => void;
  last?: boolean;
  compact?: boolean;
};

export function ClientRow({ name, meta, onPress, last = false, compact = false }: ClientRowProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        compact && styles.rowCompact,
        { backgroundColor: '#FFFFFF', borderColor: theme.backgroundSelected },
        !last && styles.rowSpacing,
        { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.997 : 1 }] },
      ]}>
      <View style={[styles.avatar, compact && styles.avatarCompact, { backgroundColor: Accent.primaryMuted }]}>
        <ThemedText type="smallBold" style={{ color: Accent.primary }}>
          {name.charAt(0).toUpperCase()}
        </ThemedText>
      </View>
      <View style={[styles.info, !meta && styles.infoCentered]}>
        <ThemedText type="smallBold" style={styles.nameText}>{name}</ThemedText>
        {meta ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {meta}
          </ThemedText>
        ) : null}
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.arrow}>
        Ver
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
    paddingVertical: 11,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  rowCompact: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    gap: 8,
  },
  rowSpacing: {
    marginBottom: 6,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderWidth: 1,
    borderColor: '#CFE0FA',
  },
  avatarCompact: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  info: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  infoCentered: {
    justifyContent: 'center',
  },
  nameText: {
    color: '#112746',
    lineHeight: 19,
  },
  arrow: {
    flexShrink: 0,
    color: Accent.primary,
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
  },
});
