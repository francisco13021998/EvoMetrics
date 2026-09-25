import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthShell } from '@/components/auth/auth-shell';
import { AppButton } from '@/components/forms/app-button';

export function JoinScreen() {
  return (
    <AuthShell
      brandSubtitle="Tu plataforma de evolución física"
      title="¿Cómo quieres unirte?"
      footerPrefix="¿Ya tienes cuenta?"
      footerAction="Iniciar sesión"
      footerSuffix=""
      onFooterPress={() => router.back()}>
      <View style={styles.actionsBlock}>
        <AppButton
          label="Unirme como atleta"
          onPress={() => router.push('/athlete-join')}
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
