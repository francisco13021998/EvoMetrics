import React, { useState } from 'react';
import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';

import { Accent, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from '@/components/themed-text';

type AppInputProps = TextInputProps & {
  label: string;
  hint?: string;
  unit?: string;
  prefix?: string;
};

export function AppInput({ label, hint, unit, prefix, style, ...props }: AppInputProps) {
  const theme = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
        {hint ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            {hint}
          </ThemedText>
        ) : null}
      </View>

      <View
        style={[
          styles.inputShell,
          {
            backgroundColor: isFocused ? theme.backgroundElement : theme.background,
            borderColor: isFocused ? Accent.primary : theme.backgroundSelected,
          },
          props.multiline && styles.textAreaShell,
        ]}>
        {prefix ? (
          <View style={styles.affix}>
            <ThemedText type="small" themeColor="textSecondary">
              {prefix}
            </ThemedText>
          </View>
        ) : null}
        <TextInput
          placeholderTextColor={theme.textSecondary}
          onFocus={(event) => {
            setIsFocused(true);
            props.onFocus?.(event);
          }}
          onBlur={(event) => {
            setIsFocused(false);
            props.onBlur?.(event);
          }}
          style={[
            styles.input,
            { color: theme.text },
            props.multiline && styles.textArea,
            style,
          ]}
          {...props}
        />
        {unit ? (
          <View style={styles.affix}>
            <ThemedText type="small" themeColor="textSecondary">
              {unit}
            </ThemedText>
          </View>
        ) : null}
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
  hint: {
    opacity: 0.7,
    fontStyle: 'italic',
    textAlign: 'right',
    flex: 1,
  },
  inputShell: {
    minHeight: 52,
    borderRadius: Radius.small,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    minHeight: 44,
    fontSize: 15,
    lineHeight: 22,
    paddingVertical: Spacing.one,
  },
  affix: {
    paddingHorizontal: Spacing.one,
  },
  textArea: {
    minHeight: 128,
    textAlignVertical: 'top',
  },
  textAreaShell: {
    alignItems: 'flex-start',
  },
});