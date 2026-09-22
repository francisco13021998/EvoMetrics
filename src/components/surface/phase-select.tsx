import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { FormulaInfoButton } from '@/components/ui/formula-info-button';
import { Radius, Spacing } from '@/constants/theme';
import { REVISION_PHASE_OPTIONS, normalizeRevisionPhase } from '@/utils/revisions';

import { getPhasePresentation } from './phase-presentation';

type PhaseSelectProps = {
  value: string;
  onChange: (value: string) => void;
  referenceLabel?: string;
  showPreparationInfo?: boolean;
};

export function PhaseSelect({ value, onChange, referenceLabel, showPreparationInfo = false }: PhaseSelectProps) {
  const normalizedValue = normalizeRevisionPhase(value);

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <ThemedText type="small" themeColor="textSecondary">Fase</ThemedText>
        {showPreparationInfo ? (
          <FormulaInfoButton
            title="Fase «Inicio» y preparaciones"
            descriptionLines={[
              'Si eliges la fase «Inicio», esta revisión cierra la preparación actual del cliente y abre una nueva a partir de hoy.',
              'Con cualquier otra fase, la revisión se suma a la preparación que ya estuviera en curso.',
            ]}
            accessibilityLabel="Información sobre cómo la fase afecta a las preparaciones"
          />
        ) : null}
      </View>

      <View style={styles.chipsGrid}>
        {REVISION_PHASE_OPTIONS.map((option) => {
          const presentation = getPhasePresentation(option.value);
          const selected = normalizedValue === option.value;

          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={presentation.label}
              style={({ pressed }) => [
                styles.chip,
                { borderColor: selected ? presentation.color : '#E1E9F5', backgroundColor: selected ? presentation.soft : '#FAFCFF' },
                pressed && styles.pressed,
              ]}>
              <View style={[styles.chipIcon, { backgroundColor: selected ? presentation.color : '#EEF1F6' }]}>
                <Ionicons name={presentation.icon} size={14} color={selected ? '#FFFFFF' : '#8B96A8'} />
              </View>
              <ThemedText type="small" style={[styles.chipLabel, selected && { color: presentation.color, fontWeight: '700' }]}>
                {presentation.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {referenceLabel ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.referenceLabel}>{referenceLabel}</ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.85,
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  chipIcon: {
    width: 22,
    height: 22,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabel: {
    color: '#4C5A73',
    flexShrink: 1,
  },
  referenceLabel: {
    lineHeight: 16,
  },
});
