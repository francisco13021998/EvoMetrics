import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { type BodyFatFormulaInfoContent } from '@/constants/body-fat-formulas';
import { Accent, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type FormulaInfoButtonProps = {
  title: string;
  descriptionLines?: string[];
  content?: BodyFatFormulaInfoContent | null;
  accessibilityLabel?: string;
};

export function FormulaInfoButton({ title, descriptionLines = [], content, accessibilityLabel }: FormulaInfoButtonProps) {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const sectionContent = content?.sections ?? [];
  const modalTitle = content?.scientificName ?? title;
  const eyebrow = content?.eyebrow ?? 'Formula';

  return (
    <>
      <Pressable
        accessibilityLabel={accessibilityLabel ?? `Información sobre ${title}`}
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          {
            borderColor: pressed ? '#C9D8F4' : theme.backgroundSelected,
            backgroundColor: pressed ? '#EAF1FF' : '#F8FBFF',
            opacity: pressed ? 0.92 : 1,
          },
        ]}>
        <ThemedText type="smallBold" style={styles.triggerText}>i</ThemedText>
      </Pressable>

      <Modal transparent visible={isOpen} animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)}>
          <Pressable style={[styles.panel, { borderColor: theme.backgroundSelected }]} onPress={() => null}>
            <View style={styles.panelHeader}>
              <View style={styles.panelTitleBlock}>
                <View style={styles.panelEyebrowPill}>
                  <ThemedText type="smallBold" style={styles.panelEyebrowText}>{eyebrow}</ThemedText>
                </View>
                <ThemedText type="smallBold" style={styles.panelTitle}>{modalTitle}</ThemedText>
                {content?.categoryLabel ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.panelSubtitle}>
                    {content.categoryLabel}
                  </ThemedText>
                ) : null}
              </View>
              <Pressable
                onPress={() => setIsOpen(false)}
                accessibilityLabel="Cerrar información"
                style={({ pressed }) => [styles.closeButton, { backgroundColor: pressed ? '#EEF3FB' : '#F8FBFF' }]}>
                <ThemedText type="smallBold" style={styles.closeText}>×</ThemedText>
              </Pressable>
            </View>
            <ScrollView style={styles.scrollBody} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
              {sectionContent.length > 0
                ? sectionContent.map((section) => (
                    <View key={section.title} style={styles.sectionBlock}>
                      <ThemedText type="smallBold" style={styles.sectionTitle}>{section.title}</ThemedText>
                      <View style={styles.sectionLines}>
                        {section.lines.map((line) => (
                          <ThemedText
                            key={`${section.title}-${line}`}
                            type="small"
                            themeColor={section.tone === 'equation' ? undefined : 'textSecondary'}
                            style={section.tone === 'equation' ? styles.equationText : styles.bodyText}>
                            {line}
                          </ThemedText>
                        ))}
                      </View>
                    </View>
                  ))
                : descriptionLines.map((line) => (
                    <View key={line} style={styles.bodyRow}>
                      <View style={styles.bodyBullet} />
                      <ThemedText type="small" themeColor="textSecondary" style={styles.bodyText}>
                        {line}
                      </ThemedText>
                    </View>
                  ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: 28,
    height: 28,
    borderWidth: 1,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerText: {
    color: Accent.primary,
    fontSize: 13,
    lineHeight: 16,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 32, 59, 0.18)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  panel: {
    borderWidth: 1,
    borderRadius: Radius.large,
    backgroundColor: '#FFFFFF',
    padding: Spacing.three,
    gap: Spacing.three,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  panelTitleBlock: {
    flex: 1,
    gap: Spacing.one,
  },
  panelEyebrowPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    backgroundColor: '#EEF4FF',
  },
  panelEyebrowText: {
    color: Accent.primary,
    fontSize: 11,
    lineHeight: 14,
  },
  panelTitle: {
    color: Accent.ink,
    lineHeight: 21,
  },
  panelSubtitle: {
    lineHeight: 18,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#5E6E88',
    fontSize: 18,
    lineHeight: 20,
  },
  body: {
    gap: Spacing.two,
  },
  scrollBody: {
    maxHeight: 420,
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  bodyBullet: {
    width: 6,
    height: 6,
    borderRadius: Radius.pill,
    backgroundColor: '#C8D8F7',
    marginTop: 7,
    flexShrink: 0,
  },
  bodyText: {
    lineHeight: 19,
    flex: 1,
  },
  sectionBlock: {
    gap: Spacing.one,
  },
  sectionTitle: {
    color: Accent.ink,
    lineHeight: 18,
  },
  sectionLines: {
    gap: 6,
  },
  equationText: {
    color: Accent.ink,
    lineHeight: 20,
  },
});