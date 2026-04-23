import { Picker } from '@react-native-picker/picker';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from '@/components/themed-text';

type AppSelectOption = {
  label: string;
  value: string;
};

type AppSelectProps = {
  label: string;
  value: string | null;
  options: AppSelectOption[];
  placeholder?: string;
  onChange: (value: string) => void;
  helper?: string;
};

export function AppSelect({ label, value, options, placeholder, onChange, helper }: AppSelectProps) {
  const theme = useTheme();

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
        {helper ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.helper}>
            {helper}
          </ThemedText>
        ) : null}
      </View>
      <View style={[styles.shell, { borderColor: theme.backgroundSelected, backgroundColor: theme.background }]}> 
        <Picker
          selectedValue={value ?? ''}
          onValueChange={(nextValue) => onChange(String(nextValue))}
          style={[styles.picker, { color: theme.text }]}
          dropdownIconColor={theme.textSecondary}
          mode="dropdown">
          {placeholder ? <Picker.Item label={placeholder} value="" /> : null}
          {options.map((option) => (
            <Picker.Item key={option.value} label={option.label} value={option.value} />
          ))}
        </Picker>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.one,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  helper: {
    opacity: 0.7,
    fontStyle: 'italic',
    flex: 1,
    textAlign: 'right',
  },
  shell: {
    minHeight: 52,
    borderRadius: Radius.small,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: Platform.OS === 'android' ? 0 : Spacing.two,
  },
  picker: {
    minHeight: 52,
  },
});
