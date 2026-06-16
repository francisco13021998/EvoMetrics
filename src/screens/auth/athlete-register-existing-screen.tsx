import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthShell } from '@/components/auth/auth-shell';
import { StatusBanner } from '@/components/feedback/status-banner';
import { AppButton } from '@/components/forms/app-button';

export function AthleteRegisterExistingScreen() {
  return (
    <AuthShell
      brandSubtitle="Acceso para atletas"
      eyebrow="Crear cuenta de atleta"
      title="Soon"
      description="La creación de cuentas de atleta vinculadas por PIN está en mantenimiento temporal."
      highlights={['Soon', 'Mantenimiento temporal', 'Acceso bloqueado']}
      footerPrefix="¿Quieres volver?"
      footerAction="Unirme"
      footerSuffix=""
      onFooterPress={() => router.replace('/join')}>
      <View style={styles.actionsBlock}>
        <StatusBanner tone="warning" title="Soon" message="Esta ruta está bloqueada mientras el alta por PIN permanece desactivada." />
        <AppButton label="Volver a unirme" variant="secondary" onPress={() => router.replace('/join')} />
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  actionsBlock: {
    gap: 12,
    marginTop: 8,
  },
});
