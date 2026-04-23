import React, { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Accent, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from '@/components/themed-text';

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
};

export function PageHeader({ eyebrow, title, subtitle, rightSlot }: PageHeaderProps) {
  const theme = useTheme();

  return (
    <View style={[styles.header, { borderBottomColor: theme.backgroundSelected, borderBottomWidth: 1 }]}>
      <View style={styles.left}>
        {eyebrow ? (
          <ThemedText type="label" style={[styles.eyebrow, { color: Accent.primary }]}>
            {eyebrow}
          </ThemedText>
        ) : null}
        <ThemedText type="headline">{title}</ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {rightSlot ? <View style={styles.right}>{rightSlot}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingBottom: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: Spacing.three,
  },
  left: {
    flex: 1,
    gap: Spacing.one,
  },
  eyebrow: {
    letterSpacing: 0.5,
  },
  subtitle: {
    marginTop: Spacing.one,
  },
  right: {
    flexShrink: 0,
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
});
