import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React, { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleProp, StyleSheet, TextStyle, View, ViewStyle } from 'react-native';

import { Accent, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from '@/components/themed-text';

type AppDateTimeInputProps = {
  label: string;
  value: Date | null;
  mode?: 'date' | 'time' | 'datetime';
  allowYearSelection?: boolean;
  minYear?: number;
  helper?: string;
  onChange: (value: Date) => void;
  shellStyle?: StyleProp<ViewStyle>;
  valueStyle?: StyleProp<TextStyle>;
};

export function AppDateTimeInput({
  label,
  value,
  mode = 'datetime',
  allowYearSelection = false,
  minYear = 1900,
  helper,
  onChange,
  shellStyle,
  valueStyle,
}: AppDateTimeInputProps) {
  const theme = useTheme();
  const [showPicker, setShowPicker] = useState(false);
  const [internalMode, setInternalMode] = useState<'date' | 'time'>('date');
  const [calendarView, setCalendarView] = useState<'calendar' | 'years'>(allowYearSelection ? 'calendar' : 'calendar');
  const [draftDate, setDraftDate] = useState<Date>(value ?? new Date());

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const firstYear = Math.min(minYear, currentYear);

    return Array.from({ length: currentYear - firstYear + 1 }, (_, index) => currentYear - index);
  }, [minYear]);

  const calendarMonthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('es-ES', {
        month: 'long',
        year: 'numeric',
      })
        .format(draftDate)
        .replace(/^(.)/, (match) => match.toUpperCase()),
    [draftDate]
  );

  const weekdayLabels = useMemo(
    () => ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
    []
  );

  const calendarGrid = useMemo(() => {
    const year = draftDate.getFullYear();
    const month = draftDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const offset = firstDay.getDay();
    const cells: (number | null)[] = Array.from({ length: offset }, () => null);

    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(day);
    }

    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    return cells;
  }, [draftDate]);

  const isAndroidCalendarVisible = Platform.OS === 'android' && showPicker && internalMode === 'date';
  const canSelectYear = allowYearSelection && mode === 'date';

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
      setCalendarView('calendar');
      setDraftDate(value ?? new Date());
      setShowPicker(true);
      return;
    }

    if (mode === 'time') {
      setInternalMode('time');
      setCalendarView('calendar');
      setShowPicker(true);
      return;
    }

    setInternalMode('date');
    setCalendarView('calendar');
    setDraftDate(value ?? new Date());
    setShowPicker(true);
  }

  function closePicker() {
    setShowPicker(false);
    setInternalMode('date');
    setCalendarView('calendar');
  }

  function shiftCalendarMonth(offset: number) {
    setDraftDate((currentDate) => {
      const nextMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
      const maxDay = new Date(nextMonthDate.getFullYear(), nextMonthDate.getMonth() + 1, 0).getDate();
      const nextDay = Math.min(currentDate.getDate(), maxDay);

      return new Date(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), nextDay);
    });
  }

  function selectYear(nextYear: number) {
    setDraftDate((currentDate) => {
      const maxDay = new Date(nextYear, currentDate.getMonth() + 1, 0).getDate();
      const nextDay = Math.min(currentDate.getDate(), maxDay);

      return new Date(nextYear, currentDate.getMonth(), nextDay);
    });
    setCalendarView('calendar');
  }

  function applyCalendarDate() {
    if (mode === 'datetime') {
      const merged = new Date(draftDate);
      const base = value ?? new Date();
      merged.setHours(base.getHours(), base.getMinutes(), 0, 0);
      onChange(merged);
      setInternalMode('time');
      return;
    }

    onChange(draftDate);
    closePicker();
  }

  function renderCalendarDay(day: number | null, index: number) {
    const isSelected = day !== null && draftDate.getDate() === day;

    if (day === null) {
      return <View key={`empty-${index}`} style={styles.calendarDaySpacer} />;
    }

    return (
      <Pressable
        key={`day-${day}`}
        onPress={() => setDraftDate(new Date(draftDate.getFullYear(), draftDate.getMonth(), day))}
        style={({ pressed }) => [
          styles.calendarDay,
          {
            backgroundColor: isSelected ? Accent.primary : '#FFFFFF',
            borderColor: isSelected ? Accent.primary : theme.backgroundSelected,
            opacity: pressed ? 0.88 : 1,
          },
        ]}>
        <ThemedText
          type="smallBold"
          style={{
            color: isSelected ? '#FFFFFF' : theme.text,
            lineHeight: 16,
          }}>
          {day}
        </ThemedText>
      </Pressable>
    );
  }

  function handlePickerChange(event: DateTimePickerEvent, selected?: Date) {
    if (event.type === 'dismissed') {
      closePicker();
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
    closePicker();
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
            backgroundColor: '#FFFFFF',
          },
          shellStyle,
        ]}>
        <ThemedText type="smallBold" style={[styles.value, valueStyle]}>
          {displayValue}
        </ThemedText>
        <View style={[styles.dot, { backgroundColor: Accent.primary }]} />
      </Pressable>
      {isAndroidCalendarVisible ? (
        <Modal transparent visible animationType="fade" onRequestClose={closePicker}>
          <Pressable style={styles.androidBackdrop} onPress={closePicker}>
            <Pressable style={[styles.androidPanel, { borderColor: theme.backgroundSelected }]} onPress={() => null}>
              {calendarView === 'calendar' ? (
                <>
                  <View style={styles.androidHeader}>
                    <Pressable onPress={() => shiftCalendarMonth(-1)} style={styles.androidNavButton} accessibilityLabel="Mes anterior">
                      <ThemedText type="headline" style={styles.androidNavIcon}>‹</ThemedText>
                    </Pressable>
                    {canSelectYear ? (
                      <Pressable onPress={() => setCalendarView('years')} style={styles.androidTitleButton} accessibilityLabel="Seleccionar año">
                        <ThemedText type="smallBold" style={styles.androidMonthLabel}>{calendarMonthLabel}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary" style={styles.androidYearHint}>
                          Toca para elegir el año
                        </ThemedText>
                      </Pressable>
                    ) : (
                      <ThemedText type="smallBold" style={styles.androidMonthLabel}>{calendarMonthLabel}</ThemedText>
                    )}
                    <Pressable onPress={() => shiftCalendarMonth(1)} style={styles.androidNavButton} accessibilityLabel="Mes siguiente">
                      <ThemedText type="headline" style={styles.androidNavIcon}>›</ThemedText>
                    </Pressable>
                  </View>

                  <View style={styles.calendarWeekRow}>
                    {weekdayLabels.map((label) => (
                      <ThemedText key={label} type="small" themeColor="textSecondary" style={styles.calendarWeekLabel}>
                        {label}
                      </ThemedText>
                    ))}
                  </View>

                  <View style={styles.calendarGrid}>
                    {calendarGrid.map((day, index) => renderCalendarDay(day, index))}
                  </View>
                </>
              ) : canSelectYear ? (
                <>
                  <View style={styles.androidHeader}>
                    <Pressable onPress={() => setCalendarView('calendar')} style={styles.androidNavButton} accessibilityLabel="Volver al calendario">
                      <ThemedText type="headline" style={styles.androidNavIcon}>‹</ThemedText>
                    </Pressable>
                    <View style={styles.androidTitleCopy}>
                      <ThemedText type="smallBold" style={styles.androidMonthLabel}>Selecciona un año</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.androidYearHint}>
                        El año se aplica al mes y día actuales.
                      </ThemedText>
                    </View>
                    <View style={styles.androidNavButtonSpacer} />
                  </View>

                  <ScrollView contentContainerStyle={styles.androidYearGrid} showsVerticalScrollIndicator={false}>
                    {yearOptions.map((year) => {
                      const isSelected = draftDate.getFullYear() === year;

                      return (
                        <Pressable
                          key={year}
                          onPress={() => selectYear(year)}
                          style={({ pressed }) => [
                            styles.androidYearOption,
                            {
                              backgroundColor: isSelected ? Accent.primary : '#F8FBFF',
                              borderColor: isSelected ? Accent.primary : theme.backgroundSelected,
                              opacity: pressed ? 0.9 : 1,
                            },
                          ]}>
                          <ThemedText type="smallBold" style={[styles.androidYearOptionText, { color: isSelected ? '#FFFFFF' : Accent.ink }]}>
                            {year}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </>
              ) : (
                <>
                  <View style={styles.androidHeader}>
                    <Pressable onPress={() => shiftCalendarMonth(-1)} style={styles.androidNavButton} accessibilityLabel="Mes anterior">
                      <ThemedText type="headline" style={styles.androidNavIcon}>‹</ThemedText>
                    </Pressable>
                    <ThemedText type="smallBold" style={styles.androidMonthLabel}>{calendarMonthLabel}</ThemedText>
                    <Pressable onPress={() => shiftCalendarMonth(1)} style={styles.androidNavButton} accessibilityLabel="Mes siguiente">
                      <ThemedText type="headline" style={styles.androidNavIcon}>›</ThemedText>
                    </Pressable>
                  </View>

                  <View style={styles.calendarWeekRow}>
                    {weekdayLabels.map((label) => (
                      <ThemedText key={label} type="small" themeColor="textSecondary" style={styles.calendarWeekLabel}>
                        {label}
                      </ThemedText>
                    ))}
                  </View>

                  <View style={styles.calendarGrid}>
                    {calendarGrid.map((day, index) => renderCalendarDay(day, index))}
                  </View>
                </>
              )}

              <View style={styles.androidActions}>
                <Pressable onPress={closePicker} style={styles.androidActionButton}>
                  <ThemedText type="smallBold" style={styles.androidActionText}>Cancelar</ThemedText>
                </Pressable>
                <Pressable onPress={applyCalendarDate} style={[styles.androidActionButton, styles.androidPrimaryAction]}>
                  <ThemedText type="smallBold" style={[styles.androidActionText, styles.androidPrimaryActionText]}>Aceptar</ThemedText>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
      {showPicker ? (
        Platform.OS === 'android' && internalMode === 'time' ? (
          <DateTimePicker
            value={value ?? new Date()}
            mode="time"
            display="default"
            onChange={handlePickerChange}
          />
        ) : Platform.OS === 'ios' ? (
          <DateTimePicker
            value={value ?? new Date()}
            mode={internalMode}
            display="spinner"
            locale="es-ES"
            onChange={handlePickerChange}
          />
        ) : null
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
  androidBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 32, 59, 0.24)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  androidPanel: {
    borderWidth: 1,
    borderRadius: Radius.large,
    backgroundColor: '#FFFFFF',
    padding: Spacing.three,
    gap: Spacing.three,
    maxWidth: 360,
    width: '100%',
    alignSelf: 'center',
  },
  androidHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  androidTitleButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 2,
  },
  androidTitleCopy: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  androidNavButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FBFF',
  },
  androidNavButtonSpacer: {
    width: 36,
    height: 36,
  },
  androidNavIcon: {
    color: Accent.primary,
    lineHeight: 24,
  },
  androidMonthLabel: {
    color: Accent.ink,
    textTransform: 'capitalize',
    textAlign: 'center',
  },
  androidYearHint: {
    textAlign: 'center',
    lineHeight: 16,
  },
  calendarWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  calendarWeekLabel: {
    width: 36,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-start',
  },
  calendarDaySpacer: {
    width: 36,
    height: 36,
  },
  calendarDay: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  androidYearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 2,
    justifyContent: 'space-between',
  },
  androidYearOption: {
    width: '31%',
    minHeight: 42,
    borderRadius: Radius.small,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  androidYearOptionText: {
    lineHeight: 18,
  },
  androidActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
  androidActionButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FBFF',
  },
  androidPrimaryAction: {
    backgroundColor: Accent.primary,
  },
  androidActionText: {
    color: Accent.primary,
  },
  androidPrimaryActionText: {
    color: '#FFFFFF',
  },
});
