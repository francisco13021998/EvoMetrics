import React, { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { ScreenContainer } from '@/components/layout/screen-container';
import { ThemedText } from '@/components/themed-text';
import { Accent, Radius, Spacing } from '@/constants/theme';

type AuthShellProps = {
  brandSubtitle: string;
  eyebrow: string;
  title: string;
  description: string;
  highlights?: string[];
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
  highlights,
  children,
  footerPrefix,
  footerAction,
  footerSuffix,
  onFooterPress,
  footerDisabled = false,
}: AuthShellProps) {
  const resolvedHighlights = (highlights?.length ? highlights : ['Proceso guiado', 'Datos fiables', 'Uso inmediato']).slice(0, 3);

  return (
    <ScreenContainer scrollable contentStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.heroGlowPrimary} />
        <View style={styles.heroGlowSecondary} />
        <View style={styles.heroGlowTertiary} />

        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <Image
              source={require('../../../assets/branding/logo-evometrics.png')}
              style={styles.brandLogo}
              resizeMode="contain"
              accessibilityLabel="Logo de EvoMetrics"
            />
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

        <View style={styles.highlightsRow}>
          {resolvedHighlights.map((item) => (
            <View key={item} style={styles.highlightChip}>
              <View style={styles.highlightDot} />
              <ThemedText type="small" style={styles.highlightText}>
                {item}
              </ThemedText>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.formBlock}>
        <View style={styles.formCard}>
          <View style={styles.formCardAccent} />
          <View style={styles.formInner}>{children}</View>
        </View>

        <Pressable
          onPress={onFooterPress}
          disabled={footerDisabled}
          style={({ pressed }) => [styles.footerLink, { opacity: footerDisabled ? 0.45 : pressed ? 0.76 : 1 }]}>
          <ThemedText type="default" style={styles.footerText}>
            {footerPrefix} <ThemedText type="linkPrimary">{footerAction}</ThemedText> {footerSuffix}
          </ThemedText>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    maxWidth: 560,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
  hero: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.one,
    paddingTop: Spacing.two,
    paddingBottom: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  heroGlowPrimary: {
    position: 'absolute',
    top: -44,
    right: -2,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#DCE9FF',
    opacity: 0.8,
  },
  heroGlowSecondary: {
    position: 'absolute',
    bottom: -64,
    left: -12,
    width: 164,
    height: 164,
    borderRadius: 82,
    backgroundColor: '#EAF2FF',
    opacity: 0.75,
  },
  heroGlowTertiary: {
    position: 'absolute',
    top: 32,
    left: 148,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F4F8FF',
    opacity: 0.95,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: '#DCE7F8',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  brandMark: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE7F8',
  },
  brandLogo: {
    width: 42,
    height: 42,
  },
  brandCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  brandName: {
    color: '#143A8F',
    letterSpacing: 1.2,
  },
  brandSubtitle: {
    flexShrink: 1,
    maxWidth: '100%',
    lineHeight: 18,
  },
  copyBlock: {
    gap: 6,
    maxWidth: 430,
  },
  eyebrow: {
    color: Accent.primary,
  },
  title: {
    color: '#10203B',
    fontSize: 34,
    lineHeight: 40,
    fontWeight: 700,
  },
  description: {
    lineHeight: 22,
    maxWidth: 420,
  },
  highlightsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  highlightChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: '#D6E3F9',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  highlightDot: {
    width: 7,
    height: 7,
    borderRadius: Radius.pill,
    backgroundColor: Accent.primary,
  },
  highlightText: {
    color: '#25477B',
    lineHeight: 18,
  },
  formBlock: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
    paddingTop: Spacing.one,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.large,
    borderWidth: 1,
    borderColor: '#D8E4F7',
    overflow: 'hidden',
    shadowColor: '#0E2C65',
    shadowOpacity: 0.08,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  formCardAccent: {
    height: 5,
    backgroundColor: '#2D66E0',
  },
  formInner: {
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  footerLink: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.one,
    paddingTop: Spacing.one,
  },
  footerText: {
    textAlign: 'center',
    color: '#435777',
    lineHeight: 22,
  },
});