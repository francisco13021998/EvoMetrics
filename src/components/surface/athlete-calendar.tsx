import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { StatusBanner } from '@/components/feedback/status-banner';
import { ThemedText } from '@/components/themed-text';
import { Accent, Radius, Spacing } from '@/constants/theme';

export type AthleteCalendarKind = 'revision-done' | 'revision-next' | 'payment' | 'event';

export type AthleteCalendarItem = {
  id: string;
  kind: AthleteCalendarKind;
  date: Date;
  title: string;
  subtitle?: string;
};

const KIND_PRESENTATION: Record<
  AthleteCalendarKind,
  { label: string; color: string; soft: string; icon: React.ComponentProps<typeof Ionicons>['name'] }
> = {
  'revision-done': { label: 'Revisión realizada', color: '#1FA971', soft: '#E9F8F1', icon: 'checkmark-circle' },
  'revision-next': { label: 'Próxima revisión', color: '#D97706', soft: '#FFF4E5', icon: 'clipboard' },
  payment: { label: 'Pago', color: '#7C3AED', soft: '#F1EBFE', icon: 'card' },
  event: { label: 'Evento', color: Accent.primary, soft: '#EAF1FF', icon: 'calendar' },
};

const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function getDateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function capitalize(value: string) {
  return value.replace(/^(.)/, (match) => match.toUpperCase());
}

type AthleteCalendarProps = {
  items: AthleteCalendarItem[];
};

export function AthleteCalendar({ items }: AthleteCalendarProps) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const monthLabel = useMemo(
    () => capitalize(new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(month)),
    [month]
  );

  const itemsByDay = useMemo(() => {
    const map = new Map<string, AthleteCalendarItem[]>();

    items.forEach((item) => {
      const key = getDateKey(item.date);
      map.set(key, [...(map.get(key) ?? []), item]);
    });

    return map;
  }, [items]);

  const cells = useMemo(() => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const offset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const result: (number | null)[] = Array.from({ length: offset }, () => null);

    for (let day = 1; day <= daysInMonth; day += 1) {
      result.push(day);
    }

    while (result.length % 7 !== 0) {
      result.push(null);
    }

    return result;
  }, [month]);

  const monthItemCount = useMemo(
    () => items.filter((item) => item.date.getFullYear() === month.getFullYear() && item.date.getMonth() === month.getMonth()).length,
    [items, month]
  );

  const selectedItems = selectedKey ? itemsByDay.get(selectedKey) ?? [] : [];
  const selectedDate = selectedKey
    ? (() => {
        const [year, monthPart, day] = selectedKey.split('-').map(Number);
        return new Date(year, monthPart - 1, day);
      })()
    : null;
  const todayKey = getDateKey(new Date());

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <ThemedText style={styles.title}>Mi calendario</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {monthItemCount === 0 ? 'Sin citas este mes' : `${monthItemCount} ${monthItemCount === 1 ? 'cita' : 'citas'} este mes`}
          </ThemedText>
        </View>
        <View style={styles.monthControls}>
          <Pressable
            onPress={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
            accessibilityRole="button"
            accessibilityLabel="Mes anterior"
            style={styles.navButton}>
            <Ionicons name="chevron-back" size={16} color={Accent.primary} />
          </Pressable>
          <Pressable
            onPress={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
            accessibilityRole="button"
            accessibilityLabel="Mes siguiente"
            style={styles.navButton}>
            <Ionicons name="chevron-forward" size={16} color={Accent.primary} />
          </Pressable>
        </View>
      </View>

      <ThemedText type="smallBold" style={styles.monthLabel}>{monthLabel}</ThemedText>

      <View style={styles.weekRow}>
        {WEEKDAY_LABELS.map((label) => (
          <ThemedText key={label} type="small" themeColor="textSecondary" style={styles.weekLabel}>{label}</ThemedText>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((day, index) => {
          if (day === null) {
            return <View key={`empty-${index}`} style={styles.cellSpacer} />;
          }

          const date = new Date(month.getFullYear(), month.getMonth(), day);
          const key = getDateKey(date);
          const dayItems = itemsByDay.get(key) ?? [];
          const kinds = Array.from(new Set(dayItems.map((item) => item.kind))).slice(0, 3);
          const isToday = key === todayKey;

          return (
            <Pressable
              key={key}
              onPress={() => setSelectedKey(key)}
              accessibilityRole="button"
              accessibilityLabel={`${day}, ${dayItems.length === 0 ? 'sin citas' : `${dayItems.length} citas`}`}
              style={[styles.cell, isToday && styles.cellToday, dayItems.length > 0 && styles.cellBusy]}>
              <ThemedText type="smallBold" style={[styles.dayLabel, isToday && styles.dayLabelToday, dayItems.length === 0 && styles.dayLabelMuted]}>
                {day}
              </ThemedText>
              <View style={styles.dots}>
                {kinds.map((kind) => (
                  <View key={kind} style={[styles.dot, { backgroundColor: KIND_PRESENTATION[kind].color }]} />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.legend}>
        {(Object.keys(KIND_PRESENTATION) as AthleteCalendarKind[]).map((kind) => (
          <View key={kind} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: KIND_PRESENTATION[kind].color }]} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.legendText}>{KIND_PRESENTATION[kind].label}</ThemedText>
          </View>
        ))}
      </View>

      <Modal transparent visible={selectedKey !== null} animationType="fade" onRequestClose={() => setSelectedKey(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSelectedKey(null)}>
          <Pressable style={styles.panel} onPress={() => null}>
            <View style={styles.panelHeader}>
              <View style={styles.headerCopy}>
                <ThemedText type="label" style={styles.panelEyebrow}>Detalle del día</ThemedText>
                <ThemedText style={styles.panelTitle}>
                  {selectedDate
                    ? capitalize(new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(selectedDate))
                    : ''}
                </ThemedText>
              </View>
              <Pressable onPress={() => setSelectedKey(null)} accessibilityRole="button" accessibilityLabel="Cerrar detalle" style={styles.closeButton}>
                <Ionicons name="close" size={20} color={Accent.primary} />
              </Pressable>
            </View>

            {selectedItems.length === 0 ? (
              <StatusBanner tone="info" message="No hay citas este día." />
            ) : (
              selectedItems.map((item) => {
                const presentation = KIND_PRESENTATION[item.kind];

                return (
                  <View key={item.id} style={styles.detailItem}>
                    <View style={[styles.detailIcon, { backgroundColor: presentation.soft }]}>
                      <Ionicons name={presentation.icon} size={16} color={presentation.color} />
                    </View>
                    <View style={styles.headerCopy}>
                      <ThemedText type="smallBold" style={styles.detailTitle}>{item.title}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">{item.subtitle ?? presentation.label}</ThemedText>
                    </View>
                  </View>
                );
              })
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#DFE7F2',
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 12,
    shadowColor: '#10203B',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    color: '#10203B',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
  },
  monthControls: {
    flexDirection: 'row',
    gap: 8,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: '#D4E3FA',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    color: '#1D2E4A',
    textAlign: 'center',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekLabel: {
    width: '13.2%',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 6,
  },
  cellSpacer: {
    width: '13.2%',
    aspectRatio: 1,
  },
  cell: {
    width: '13.2%',
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: '#E5ECF7',
    borderRadius: 12,
    backgroundColor: '#F8FAFD',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  cellBusy: {
    backgroundColor: '#FFFFFF',
    borderColor: '#C9D9F2',
  },
  cellToday: {
    borderColor: Accent.primary,
    backgroundColor: '#EAF1FF',
  },
  dayLabel: {
    color: '#112746',
    lineHeight: 15,
  },
  dayLabelToday: {
    color: Accent.primary,
  },
  dayLabelMuted: {
    color: '#9DB0D1',
  },
  dots: {
    flexDirection: 'row',
    gap: 2,
    height: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendText: {
    fontSize: 12,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 24, 45, 0.42)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  panel: {
    borderRadius: Radius.large,
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 12,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  panelEyebrow: {
    color: Accent.primary,
  },
  panelTitle: {
    color: '#10203B',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F7FD',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E3EBF7',
    borderRadius: Radius.medium,
    padding: 10,
    backgroundColor: '#FBFDFF',
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTitle: {
    color: '#112746',
  },
});
