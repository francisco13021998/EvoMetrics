import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthShell } from '@/components/auth/auth-shell';
import { StatusBanner } from '@/components/feedback/status-banner';
import { AppButton } from '@/components/forms/app-button';

export function AthleteRegisterScreen() {
  return (
    <AuthShell
      brandSubtitle="Registro de atleta"
      eyebrow="Crear mi perfil"
      title="Soon"
      description="El alta de atletas mediante PIN está temporalmente desactivada."
      highlights={['Soon', 'Mantenimiento temporal', 'Acceso bloqueado']}
      footerPrefix="¿Quieres volver?"
      footerAction="Unirme"
      footerSuffix=""
      onFooterPress={() => router.replace('/join')}>
      <View style={styles.actionsBlock}>
        <StatusBanner tone="warning" title="Soon" message="Esta pantalla de registro está bloqueada mientras el flujo por PIN permanece en mantenimiento." />
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
