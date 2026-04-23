import React, { ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { Accent, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from '@/components/themed-text';

type SectionCardProps = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  rightSlot?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function SectionCard({
  eyebrow,
  title,
  subtitle,
  rightSlot,
  footer,
  children,
  onPress,
  style,
}: SectionCardProps) {
  const theme = useTheme();
  const Container = onPress ? Pressable : View;

  return (
    <Container
      {...(onPress
        ? {
            onPress,
            style: ({ pressed }: { pressed: boolean }) => [
              styles.card,
              {
                backgroundColor: theme.background,
                opacity: pressed ? 0.98 : 1,
                transform: [{ scale: pressed ? 0.997 : 1 }],
              },
              style,
            ],
          }
        : {
            style: [
              styles.card,
              {
                backgroundColor: theme.background,
              },
              style,
            ],
          })}>
      {(eyebrow || title || subtitle || rightSlot) && (
        <View style={styles.header}>
          <View style={styles.headerText}>
            {eyebrow ? (
              <ThemedText type="label" style={styles.eyebrow}>
                {eyebrow}
              </ThemedText>
            ) : null}
            {title ? <ThemedText type="headline">{title}</ThemedText> : null}
            {subtitle ? (
              <ThemedText type="small" themeColor="textSecondary">
                {subtitle}
              </ThemedText>
            ) : null}
          </View>
          {rightSlot}
        </View>
      )}

      <View style={styles.content}>{children}</View>

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </Container>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 0,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  headerText: {
    flex: 1,
    gap: Spacing.one,
  },
  eyebrow: {
    color: Accent.primary,
  },
  content: {
    gap: Spacing.three,
  },
  footer: {
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: Accent.border,
  },
});