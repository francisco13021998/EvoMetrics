import { Picker } from '@react-native-picker/picker';
import React from 'react';
import { Platform, StyleProp, StyleSheet, TextStyle, View, ViewStyle } from 'react-native';

import { Accent, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from '@/components/themed-text';

type AppSelectOption = {
  label: string;
  value: string;
  disabled?: boolean;
};

type AppSelectProps = {
  label: string;
  value: string | null;
  options: AppSelectOption[];
  placeholder?: string;
  onChange: (value: string) => void;
  helper?: string;
  containerStyle?: StyleProp<ViewStyle>;
  pickerTextStyle?: StyleProp<TextStyle>;
};

export function AppSelect({
  label,
  value,
  options,
  placeholder,
  onChange,
  helper,
  containerStyle,
  pickerTextStyle,
}: AppSelectProps) {
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
      <View style={[styles.shell, { borderColor: theme.backgroundSelected, backgroundColor: '#FFFFFF' }, containerStyle]}>
        <Picker
          selectedValue={value ?? ''}
          onValueChange={(nextValue) => onChange(String(nextValue))}
          style={[styles.picker, { color: theme.text, backgroundColor: '#FFFFFF' }, pickerTextStyle]}
          dropdownIconColor={Accent.primary}
          mode="dropdown">
          {placeholder ? <Picker.Item label={placeholder} value="" /> : null}
          {options.map((option) => (
            <Picker.Item key={option.value} label={option.label} value={option.value} enabled={!option.disabled} />
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
    minHeight: 56,
    borderRadius: Radius.medium,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: Platform.OS === 'android' ? Spacing.one : Spacing.two,
  },
  picker: {
    minHeight: 56,
    marginHorizontal: Platform.OS === 'android' ? -4 : 0,
  },
});
