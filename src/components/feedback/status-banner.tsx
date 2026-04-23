import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Accent, Radius, Spacing } from '@/constants/theme';

import { ThemedText } from '@/components/themed-text';

type StatusBannerProps = {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  message: string;
  loading?: boolean;
};

export function StatusBanner({ tone = 'info', title, message, loading = false }: StatusBannerProps) {
  const palette = {
    info: {
      backgroundColor: '#EEF4FF',
      borderColor: '#D6E3FF',
      accentColor: Accent.primary,
    },
    success: {
      backgroundColor: '#ECF9F3',
      borderColor: '#D2F0E3',
      accentColor: Accent.success,
    },
    warning: {
      backgroundColor: '#FFF7E8',
      borderColor: '#F7E3B3',
      accentColor: Accent.warning,
    },
    danger: {
      backgroundColor: '#FFF2F2',
      borderColor: '#F3D4D4',
      accentColor: Accent.danger,
    },
  }[tone];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
        },
      ]}>
      <View style={[styles.accent, { backgroundColor: palette.accentColor }]} />
      <View style={styles.content}>
        <View style={styles.header}>
          {loading ? <ActivityIndicator size="small" color={palette.accentColor} /> : null}
          <View style={[styles.dot, { backgroundColor: palette.accentColor }]} />
          {title ? <ThemedText type="smallBold">{title}</ThemedText> : null}
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={styles.message}>
          {message}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: Radius.small,
    overflow: 'hidden',
    minHeight: 60,
  },
  accent: {
    width: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.one,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
  },
  message: {
    lineHeight: 22,
  },
});