import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Accent, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from '@/components/themed-text';

type AppCheckboxProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  helper?: string;
  disabled?: boolean;
};

export function AppCheckbox({ label, checked, onChange, helper, disabled = false }: AppCheckboxProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      onPress={() => onChange(!checked)}
      disabled={disabled}
      style={({ pressed }) => [
        styles.row,
        { opacity: disabled ? 0.55 : pressed ? 0.92 : 1 },
      ]}>
      <View
        style={[
          styles.box,
          {
            borderColor: checked ? Accent.primary : theme.backgroundSelected,
            backgroundColor: checked ? Accent.primary : '#FFFFFF',
          },
        ]}>
        {checked ? <View style={styles.mark} /> : null}
      </View>
      <View style={styles.copy}>
        <ThemedText type="smallBold" style={styles.label}>{label}</ThemedText>
        {helper ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.helper}>{helper}</ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  box: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  mark: {
    width: 10,
    height: 10,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  label: {
    color: Accent.ink,
  },
  helper: {
    lineHeight: 18,
  },
});