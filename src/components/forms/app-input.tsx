import React, { useState } from 'react';
import { StyleProp, StyleSheet, TextInput, TextInputProps, TextStyle, View, ViewStyle } from 'react-native';

import { Accent, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from '@/components/themed-text';

type AppInputProps = TextInputProps & {
  label: string;
  hint?: string;
  unit?: string;
  prefix?: string;
  containerStyle?: StyleProp<ViewStyle>;
  affixTextStyle?: StyleProp<TextStyle>;
  variant?: 'default' | 'auth';
};

export function AppInput({
  label,
  hint,
  unit,
  prefix,
  containerStyle,
  affixTextStyle,
  style,
  variant = 'default',
  ...props
}: AppInputProps) {
  const theme = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const isAuth = variant === 'auth';
  const isDisabled = Boolean(props.editable === false);
  const resolvedBorderColor = isFocused ? Accent.primary : isAuth ? '#C6D8F4' : theme.backgroundSelected;
  const resolvedBackgroundColor = isAuth ? '#F9FBFF' : '#FFFFFF';

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <ThemedText type="small" themeColor="textSecondary" style={isAuth && styles.authLabel}>
          {label}
        </ThemedText>
        {hint ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            {hint}
          </ThemedText>
        ) : null}
      </View>

      <View
        style={[
          styles.inputShell,
          isAuth && styles.authInputShell,
          {
            backgroundColor: resolvedBackgroundColor,
            borderColor: resolvedBorderColor,
            opacity: isDisabled ? 0.65 : 1,
          },
          containerStyle,
          props.multiline && styles.textAreaShell,
        ]}>
        {prefix ? (
          <View style={styles.affix}>
            <ThemedText type="small" themeColor="textSecondary" style={affixTextStyle}>
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
            styles.inputBackground,
            isAuth && styles.authInput,
            isAuth && styles.authInputColor,
            { color: theme.text },
            props.multiline && styles.textArea,
            style,
          ]}
          {...props}
        />
        {unit ? (
          <View style={styles.affix}>
            <ThemedText type="small" themeColor="textSecondary" style={affixTextStyle}>
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
  authInputShell: {
    minHeight: 60,
    borderRadius: Radius.medium,
    borderWidth: 1.5,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    minHeight: 44,
    fontSize: 15,
    lineHeight: 22,
    paddingVertical: Spacing.one,
  },
  authInput: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 500,
  },
  authInputColor: {
    color: '#0E274F',
  },
  inputBackground: {
    backgroundColor: 'transparent',
    borderRadius: Radius.small,
  },
  authLabel: {
    letterSpacing: 0.2,
    color: '#334A70',
    fontWeight: 600,
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