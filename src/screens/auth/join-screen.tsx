import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthShell } from '@/components/auth/auth-shell';
import { StatusBanner } from '@/components/feedback/status-banner';
import { AppButton } from '@/components/forms/app-button';

export function JoinScreen() {
  return (
    <AuthShell
      brandSubtitle="Tu plataforma de evolución física"
      eyebrow="Unirme a EvoMetrics"
      title="¿Cómo quieres unirte?"
      description="El acceso por PIN para atletas está en mantenimiento temporal. La opción de entrenador sigue disponible."
      highlights={['Soon', 'Mantenimiento temporal', 'Rol adecuado']}
      footerPrefix="¿Ya tienes cuenta?"
      footerAction="Iniciar sesión"
      footerSuffix=""
      onFooterPress={() => router.back()}>
      <View style={styles.actionsBlock}>
        <StatusBanner
          tone="warning"
          title="Soon"
          message="La invitación a atletas mediante PIN está bloqueada por mantenimiento."
        />
        <AppButton
          label="Soon"
          disabled
        />
        <AppButton
          label="Unirme como entrenador"
          variant="ghost"
          onPress={() => router.push('/trainer-request')}
        />
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
