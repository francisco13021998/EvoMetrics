import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/forms/app-button';
import { ThemedText } from '@/components/themed-text';
import { Accent, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type AthletePinModalProps = {
  visible: boolean;
  pin: string;
  /** ISO string of expiry (1 hour from generation) */
  expiresAt: string;
  /** 'existing_client' shows "vinculación" copy; 'new_client' shows "nuevo atleta" copy */
  pinType: 'existing_client' | 'new_client';
  onClose: () => void;
};

function useCountdown(expiresAt: string) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  );

  useEffect(() => {
    const newSecondsLeft = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
    setSecondsLeft(newSecondsLeft);

    if (newSecondsLeft <= 0) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        const next = s - 1;
        if (next <= 0) clearInterval(id);
        return Math.max(0, next);
      });
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const label = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const isExpired = secondsLeft <= 0;

  return { label, isExpired, secondsLeft };
}

export function AthletePinModal({ visible, pin, expiresAt, pinType, onClose }: AthletePinModalProps) {
  const theme = useTheme();
  const { label: countdownLabel, isExpired } = useCountdown(expiresAt);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await Clipboard.setStringAsync(pin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const title = pinType === 'existing_client' ? 'PIN de vinculación' : 'PIN para nuevo atleta';
  const description =
    pinType === 'existing_client'
      ? 'El atleta debe introducir este código en la app para vincular su cuenta al perfil que ya has creado.'
      : 'El atleta debe introducir este código al registrarse. Se creará su perfil de cliente automáticamente.';

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.panel, { borderColor: theme.backgroundSelected }]} onPress={() => null}>
          {/* Top accent */}
          <View style={styles.topAccent} />

          <View style={styles.content}>
            <View style={styles.header}>
              <ThemedText type="label" style={styles.eyebrow}>Código de acceso</ThemedText>
              <ThemedText type="headline" style={styles.title}>{title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.description}>
                {description}
              </ThemedText>
            </View>

            {/* PIN display */}
            <Pressable
              style={[
                styles.pinBox,
                { borderColor: isExpired ? '#FF3B30' : Accent.primary, backgroundColor: isExpired ? '#FFF2F1' : '#F0F5FF' },
              ]}
              onPress={handleCopy}
              accessibilityLabel="Copiar PIN"
            >
              <ThemedText style={[styles.pinText, { color: isExpired ? '#FF3B30' : Accent.primary }]}>
                {pin}
              </ThemedText>
              <ThemedText type="small" style={[styles.pinHint, { color: isExpired ? '#FF3B30' : Accent.primary }]}>
                {copied ? '¡Copiado!' : 'Toca para copiar'}
              </ThemedText>
            </Pressable>

            {/* Countdown */}
            <View style={[styles.timerRow, { backgroundColor: isExpired ? '#FFF2F1' : '#F4F7FC', borderColor: isExpired ? '#FFCDD0' : theme.backgroundSelected }]}>
              <View style={[styles.timerDot, { backgroundColor: isExpired ? '#FF3B30' : '#22C55E' }]} />
              <ThemedText type="small" style={{ color: isExpired ? '#FF3B30' : theme.textSecondary }}>
                {isExpired ? 'PIN expirado — genera uno nuevo' : `Válido durante: ${countdownLabel}`}
              </ThemedText>
            </View>

            <View style={styles.instructions}>
              <ThemedText type="smallBold">¿Cómo funciona?</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.step}>
                1. Comparte este código con el atleta.
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.step}>
                2. El atleta abre la app → Unirme → Unirme como atleta.
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.step}>
                3. Introduce el PIN y completa el registro.
              </ThemedText>
            </View>

            <AppButton label="Cerrar" variant="secondary" onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(12,30,64,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.three,
  },
  panel: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderRadius: Radius.large,
    overflow: 'hidden',
    shadowColor: '#12336E',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  topAccent: {
    height: 4,
    backgroundColor: Accent.primary,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  header: {
    gap: 4,
  },
  eyebrow: {
    color: Accent.primary,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 22,
  },
  description: {
    lineHeight: 20,
  },
  pinBox: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.base,
    borderWidth: 2,
    gap: 4,
  },
  pinText: {
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: 10,
  },
  pinHint: {
    fontSize: 12,
    opacity: 0.8,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.base,
    borderWidth: 1,
  },
  timerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  instructions: {
    gap: 4,
    padding: Spacing.two,
    backgroundColor: '#F8FBFF',
    borderRadius: Radius.base,
  },
  step: {
    lineHeight: 20,
  },
});
