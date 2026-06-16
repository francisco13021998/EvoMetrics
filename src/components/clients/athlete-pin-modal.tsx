import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { StatusBanner } from '@/components/feedback/status-banner';
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

export function AthletePinModal({ visible, onClose }: AthletePinModalProps) {
  const theme = useTheme();

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.panel, { borderColor: theme.backgroundSelected }]} onPress={() => null}>
          <View style={styles.content}>
            <View style={styles.header}>
              <ThemedText type="label" style={styles.eyebrow}>Soon</ThemedText>
              <ThemedText type="headline" style={styles.title}>Mantenimiento temporal</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.description}>
                La invitación mediante PIN de atleta está bloqueada por ahora.
              </ThemedText>
            </View>

            <StatusBanner tone="warning" title="Soon" message="La generación y el uso de PIN para atletas volverán más adelante." />

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
});
