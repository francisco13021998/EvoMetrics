import React, { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { Accent, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from '@/components/themed-text';

type PageSectionProps = {
  label?: string;
  title?: string;
  rightSlot?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  first?: boolean;
};

export function PageSection({ label, title, rightSlot, children, style, first = false }: PageSectionProps) {
  const theme = useTheme();

  return (
    <View style={[styles.section, !first && { borderTopColor: theme.backgroundSelected, borderTopWidth: 1 }, style]}>
      {(label || title || rightSlot) && (
        <View style={styles.header}>
          <View style={styles.headerText}>
            {label ? (
              <ThemedText type="label" style={[styles.label, { color: Accent.primary }]}>
                {label}
              </ThemedText>
            ) : null}
            {title ? <ThemedText type="headline">{title}</ThemedText> : null}
          </View>
          {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
        </View>
      )}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingVertical: Spacing.three,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  headerText: {
    flex: 1,
    gap: Spacing.one,
  },
  label: {
    letterSpacing: 0.5,
  },
  rightSlot: {
    flexShrink: 0,
  },
  content: {
    gap: Spacing.three,
  },
});
