import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Accent, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from '@/components/themed-text';

type AppDateTimeInputProps = {
  label: string;
  value: Date | null;
  mode?: 'date' | 'time' | 'datetime';
  helper?: string;
  onChange: (value: Date) => void;
};

export function AppDateTimeInput({ label, value, mode = 'datetime', helper, onChange }: AppDateTimeInputProps) {
  const theme = useTheme();
  const [showPicker, setShowPicker] = useState(false);
  const [internalMode, setInternalMode] = useState<'date' | 'time'>('date');

  const displayValue = useMemo(() => {
    if (!value) {
      return '-';
    }

    if (mode === 'date') {
      return value.toLocaleDateString('es-ES');
    }

    if (mode === 'time') {
      return value.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    }

    return `${value.toLocaleDateString('es-ES')} · ${value.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
  }, [mode, value]);

  function handlePress() {
    if (mode === 'date') {
      setInternalMode('date');
      setShowPicker(true);
      return;
    }

    if (mode === 'time') {
      setInternalMode('time');
      setShowPicker(true);
      return;
    }

    setInternalMode('date');
    setShowPicker(true);
  }

  function handlePickerChange(event: DateTimePickerEvent, selected?: Date) {
    if (event.type === 'dismissed') {
      setShowPicker(false);
      return;
    }

    const nextDate = selected ?? value ?? new Date();

    if (mode === 'datetime' && internalMode === 'date') {
      const merged = new Date(nextDate);
      const base = value ?? new Date();
      merged.setHours(base.getHours(), base.getMinutes(), 0, 0);
      onChange(merged);
      setInternalMode('time');
      return;
    }

    onChange(nextDate);
    setShowPicker(false);
  }

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
      <Pressable
        onPress={handlePress}
        style={[
          styles.shell,
          {
            borderColor: theme.backgroundSelected,
            backgroundColor: theme.background,
          },
        ]}>
        <ThemedText type="smallBold" style={styles.value}>
          {displayValue}
        </ThemedText>
        <View style={[styles.dot, { backgroundColor: Accent.primary }]} />
      </Pressable>
      {showPicker ? (
        <DateTimePicker
          value={value ?? new Date()}
          mode={internalMode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handlePickerChange}
        />
      ) : null}
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
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  value: {
    lineHeight: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
