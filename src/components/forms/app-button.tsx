import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Accent, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from '@/components/themed-text';

type AppButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  size?: 'default' | 'compact';
};

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  fullWidth = true,
  disabled = false,
  loading = false,
  size = 'default',
}: AppButtonProps) {
  const theme = useTheme();

  const buttonStyles = {
    primary: {
      backgroundColor: Accent.primary,
      borderColor: Accent.primary,
      textColor: '#FFFFFF',
    },
    secondary: {
      backgroundColor: theme.backgroundElement,
      borderColor: Accent.border,
      textColor: theme.text,
    },
    ghost: {
      backgroundColor: 'transparent',
      borderColor: Accent.border,
      textColor: theme.text,
    },
    danger: {
      backgroundColor: '#FFF3F3',
      borderColor: '#F0CFCF',
      textColor: Accent.danger,
    },
  }[variant];

  const isCompact = size === 'compact';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        isCompact && styles.buttonCompact,
        fullWidth && styles.fullWidth,
        {
          backgroundColor: buttonStyles.backgroundColor,
          borderColor: buttonStyles.borderColor,
          opacity: disabled || loading ? 0.45 : pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.995 : 1 }],
        },
      ]}>
      <View style={styles.inner}>
        {loading ? (
          <ActivityIndicator color={buttonStyles.textColor} size="small" style={styles.loader} />
        ) : null}
        <ThemedText style={[styles.label, isCompact && styles.labelCompact, { color: buttonStyles.textColor }]}>{label}</ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: Radius.small,
    borderWidth: 1.5,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  buttonCompact: {
    minHeight: 40,
    paddingHorizontal: Spacing.three,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  inner: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
  },
  loader: {
    marginRight: 0,
  },
  label: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 600,
    letterSpacing: 0.1,
  },
  labelCompact: {
    fontSize: 14,
  },
});