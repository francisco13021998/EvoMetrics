import React, { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ScreenContainer } from '@/components/layout/screen-container';
import { ThemedText } from '@/components/themed-text';
import { Accent, Spacing } from '@/constants/theme';

type AuthShellProps = {
  brandSubtitle: string;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footerPrefix: string;
  footerAction: string;
  footerSuffix: string;
  onFooterPress: () => void;
  footerDisabled?: boolean;
};

export function AuthShell({
  brandSubtitle,
  eyebrow,
  title,
  description,
  children,
  footerPrefix,
  footerAction,
  footerSuffix,
  onFooterPress,
  footerDisabled = false,
}: AuthShellProps) {
  return (
    <ScreenContainer scrollable contentStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.heroGlowPrimary} />
        <View style={styles.heroGlowSecondary} />

        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <ThemedText type="label" style={styles.brandMarkText}>
              EM
            </ThemedText>
          </View>
          <View style={styles.brandCopy}>
            <ThemedText type="label" style={styles.brandName}>
              EvoMetrics
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.brandSubtitle}>
              {brandSubtitle}
            </ThemedText>
          </View>
        </View>

        <View style={styles.copyBlock}>
          <ThemedText type="label" style={styles.eyebrow}>
            {eyebrow}
          </ThemedText>
          <ThemedText style={styles.title}>{title}</ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={styles.description}>
            {description}
          </ThemedText>
        </View>
      </View>

      <View style={styles.formBlock}>{children}</View>

      <Pressable
        onPress={onFooterPress}
        disabled={footerDisabled}
        style={({ pressed }) => [styles.footerLink, { opacity: footerDisabled ? 0.45 : pressed ? 0.76 : 1 }]}>
        <ThemedText type="default" style={styles.footerText}>
          {footerPrefix} <ThemedText type="linkPrimary">{footerAction}</ThemedText> {footerSuffix}
        </ThemedText>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    maxWidth: 520,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    gap: Spacing.one,
  },
  hero: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
    paddingTop: Spacing.two,
    paddingBottom: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  heroGlowPrimary: {
    position: 'absolute',
    top: -36,
    right: 10,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#EAF1FF',
    opacity: 0.85,
  },
  heroGlowSecondary: {
    position: 'absolute',
    bottom: -56,
    left: 18,
    width: 98,
    height: 98,
    borderRadius: 49,
    backgroundColor: '#F6F9FF',
    opacity: 0.9,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  brandMark: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Accent.primary,
  },
  brandMarkText: {
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  brandCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  brandName: {
    color: Accent.primary,
    letterSpacing: 1.2,
  },
  brandSubtitle: {
    flexShrink: 1,
    maxWidth: '100%',
    lineHeight: 18,
  },
  copyBlock: {
    gap: 4,
    maxWidth: 384,
  },
  eyebrow: {
    color: Accent.primary,
  },
  title: {
    color: '#10203B',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: 700,
  },
  description: {
    lineHeight: 22,
    maxWidth: 360,
  },
  formBlock: {
    gap: Spacing.one,
    paddingHorizontal: Spacing.one,
    paddingTop: Spacing.two,
  },
  footerLink: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.one,
    paddingTop: 0,
  },
  footerText: {
    textAlign: 'center',
    color: '#51627C',
    lineHeight: 22,
  },
});