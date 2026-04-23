import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Accent, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { AppButton } from '@/components/forms/app-button';
import { ThemedText } from '@/components/themed-text';

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionVariant?: 'primary' | 'secondary' | 'ghost';
};

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  actionVariant = 'secondary',
}: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { borderColor: theme.backgroundSelected }]}>
      <View style={[styles.icon, { backgroundColor: Accent.primaryMuted }]}>
        <View style={[styles.iconInner, { backgroundColor: Accent.primary }]} />
      </View>
      <View style={styles.texts}>
        <ThemedText type="headline" style={styles.center}>
          {title}
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={styles.center}>
          {description}
        </ThemedText>
      </View>
      {actionLabel ? <AppButton label={actionLabel} onPress={onAction} variant={actionVariant} fullWidth={false} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
    alignItems: 'center',
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInner: {
    width: 22,
    height: 22,
    borderRadius: Radius.pill,
  },
  texts: {
    gap: Spacing.two,
    alignItems: 'center',
    maxWidth: 420,
  },
  center: {
    textAlign: 'center',
  },
});