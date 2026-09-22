import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Accent, Radius, Spacing } from '@/constants/theme';
import { Preparation } from '@/types/domain';

import { getPhasePresentation, PhasePresentation } from './phase-presentation';

export const ALL_PREPARATIONS_ID = 'all';

const ALL_PRESENTATION: PhasePresentation = { label: 'Historial completo', color: '#10203B', soft: '#EEF1F6', icon: 'layers-outline' };

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' });
}

export function formatPreparationRange(preparation: Pick<Preparation, 'startDate' | 'endDate'>) {
  const start = formatShortDate(preparation.startDate);

  if (!preparation.endDate) {
    return `Desde ${start}`;
  }

  return `${start} - ${formatShortDate(preparation.endDate)}`;
}

export function formatPreparationLabel(preparation: Pick<Preparation, 'phase' | 'name'>) {
  if (preparation.name?.trim()) {
    return preparation.name.trim();
  }

  return getPhasePresentation(preparation.phase).label;
}

function formatRevisionCount(count: number) {
  return `${count} ${count === 1 ? 'revisión' : 'revisiones'}`;
}

type PreparationSelectorProps = {
  preparations: Preparation[];
  totalRevisions: number;
  revisionCountByPreparationId?: Record<string, number>;
  selectedId: string;
  onSelect: (preparationId: string) => void;
};

export function PreparationSelector({
  preparations,
  totalRevisions,
  revisionCountByPreparationId,
  selectedId,
  onSelect,
}: PreparationSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const isAllSelected = selectedId === ALL_PREPARATIONS_ID;
  const selectedPreparation = preparations.find((preparation) => preparation.id === selectedId) ?? null;
  const selectedPresentation = isAllSelected || !selectedPreparation ? ALL_PRESENTATION : getPhasePresentation(selectedPreparation.phase);
  const selectedTitle = isAllSelected || !selectedPreparation ? 'Todo el historial' : formatPreparationLabel(selectedPreparation);
  const selectedMeta = isAllSelected || !selectedPreparation
    ? formatRevisionCount(totalRevisions)
    : `${formatPreparationRange(selectedPreparation)} · ${formatRevisionCount(revisionCountByPreparationId?.[selectedPreparation.id] ?? 0)}`;
  const selectedIsCurrent = Boolean(selectedPreparation && !selectedPreparation.endDate);

  function handleSelect(id: string) {
    onSelect(id);
    setIsOpen(false);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Ionicons name="layers-outline" size={15} color={Accent.primary} />
        <ThemedText type="smallBold" style={styles.headerLabel}>Preparación</ThemedText>
      </View>

      <Pressable
        onPress={() => setIsOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Preparación seleccionada: ${selectedTitle}. Toca para cambiarla.`}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}>
        <View style={[styles.triggerIcon, { backgroundColor: selectedPresentation.soft }]}>
          <Ionicons name={selectedPresentation.icon} size={18} color={selectedPresentation.color} />
        </View>
        <View style={styles.triggerCopy}>
          <View style={styles.triggerTitleRow}>
            <ThemedText type="smallBold" style={styles.triggerTitle} numberOfLines={1}>{selectedTitle}</ThemedText>
            {selectedIsCurrent ? (
              <View style={styles.currentBadge}>
                <ThemedText type="small" style={styles.currentBadgeText}>Actual</ThemedText>
              </View>
            ) : null}
          </View>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{selectedMeta}</ThemedText>
        </View>
        <Ionicons name="chevron-down" size={18} color="#9AA5B5" />
      </Pressable>

      <Modal transparent visible={isOpen} animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)}>
          <Pressable style={styles.panel} onPress={() => null}>
            <View style={styles.panelHeader}>
              <View style={styles.panelHeaderCopy}>
                <ThemedText type="label" style={styles.panelEyebrow}>Filtrar análisis</ThemedText>
                <ThemedText style={styles.panelTitle}>Elige una preparación</ThemedText>
              </View>
              <Pressable onPress={() => setIsOpen(false)} accessibilityRole="button" accessibilityLabel="Cerrar" style={styles.closeButton}>
                <Ionicons name="close" size={20} color={Accent.primary} />
              </Pressable>
            </View>

            <ScrollView style={styles.optionsScroll} contentContainerStyle={styles.optionsList} showsVerticalScrollIndicator={false}>
              <Pressable
                onPress={() => handleSelect(ALL_PREPARATIONS_ID)}
                accessibilityRole="button"
                accessibilityState={{ selected: isAllSelected }}
                style={({ pressed }) => [styles.option, isAllSelected && styles.optionSelected, pressed && styles.pressed]}>
                <View style={[styles.optionIcon, { backgroundColor: ALL_PRESENTATION.soft }]}>
                  <Ionicons name={ALL_PRESENTATION.icon} size={17} color={ALL_PRESENTATION.color} />
                </View>
                <View style={styles.optionCopy}>
                  <ThemedText type="smallBold" style={styles.optionTitle}>Todo el historial</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{formatRevisionCount(totalRevisions)}</ThemedText>
                </View>
                {isAllSelected ? <Ionicons name="checkmark-circle" size={20} color={Accent.primary} /> : null}
              </Pressable>

              {preparations.map((preparation) => {
                const presentation = getPhasePresentation(preparation.phase);
                const isSelected = preparation.id === selectedId;
                const isCurrent = !preparation.endDate;
                const revisionCount = revisionCountByPreparationId?.[preparation.id] ?? 0;

                return (
                  <Pressable
                    key={preparation.id}
                    onPress={() => handleSelect(preparation.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    style={({ pressed }) => [styles.option, isSelected && styles.optionSelected, pressed && styles.pressed]}>
                    <View style={[styles.optionIcon, { backgroundColor: presentation.soft }]}>
                      <Ionicons name={presentation.icon} size={17} color={presentation.color} />
                    </View>
                    <View style={styles.optionCopy}>
                      <View style={styles.optionTitleRow}>
                        <ThemedText type="smallBold" style={styles.optionTitle} numberOfLines={1}>{formatPreparationLabel(preparation)}</ThemedText>
                        {isCurrent ? (
                          <View style={styles.currentBadge}>
                            <ThemedText type="small" style={styles.currentBadgeText}>Actual</ThemedText>
                          </View>
                        ) : null}
                      </View>
                      <ThemedText type="small" themeColor="textSecondary">
                        {formatPreparationRange(preparation)} · {formatRevisionCount(revisionCount)}
                      </ThemedText>
                    </View>
                    {isSelected ? <Ionicons name="checkmark-circle" size={20} color={Accent.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
    borderWidth: 1,
    borderColor: '#DFE7F2',
    borderRadius: Radius.large,
    backgroundColor: '#FFFFFF',
    padding: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerLabel: {
    color: '#10203B',
  },
  pressed: {
    opacity: 0.85,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 58,
    borderWidth: 1,
    borderColor: '#E1E9F5',
    borderRadius: Radius.medium,
    backgroundColor: '#FAFCFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  triggerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  triggerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  triggerTitle: {
    color: '#10203B',
    flexShrink: 1,
  },
  currentBadge: {
    borderRadius: Radius.pill,
    backgroundColor: '#E7F8F0',
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  currentBadgeText: {
    color: Accent.success,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
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
    maxHeight: '78%',
    alignSelf: 'center',
    shadowColor: '#10203B',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  panelHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  panelEyebrow: {
    color: Accent.primary,
  },
  panelTitle: {
    color: '#10203B',
    fontSize: 18,
    lineHeight: 22,
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
  optionsScroll: {
    flexGrow: 0,
  },
  optionsList: {
    gap: 8,
    paddingBottom: 2,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E5ECF7',
    borderRadius: Radius.medium,
    backgroundColor: '#FAFCFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionSelected: {
    borderColor: Accent.primary,
    backgroundColor: '#EEF4FF',
  },
  optionIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  optionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  optionTitle: {
    color: '#10203B',
    flexShrink: 1,
  },
});
