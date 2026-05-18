import { router } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthShell } from '@/components/auth/auth-shell';
import { StatusBanner } from '@/components/feedback/status-banner';
import { AppButton } from '@/components/forms/app-button';
import { AppInput } from '@/components/forms/app-input';
import { athletePinsService } from '@/services/athlete-pins';

export function AthleteJoinScreen() {
  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleValidatePin() {
    setErrorMessage(null);

    if (pin.trim().length < 4) {
      setErrorMessage('Introduce el PIN que te ha proporcionado tu entrenador.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await athletePinsService.validatePin(pin.trim());

      if (!result.valid) {
        setErrorMessage('PIN incorrecto o expirado. Solicita uno nuevo a tu entrenador.');
        return;
      }

      if (result.pinType === 'existing_client') {
        router.push({
          pathname: '/athlete-register-existing',
          params: { pin: pin.trim().toUpperCase() },
        });
      } else {
        router.push({
          pathname: '/athlete-register',
          params: { pin: pin.trim().toUpperCase(), trainerId: result.trainerId },
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo validar el PIN.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      brandSubtitle="Acceso para atletas"
      eyebrow="Unirme como atleta"
      title="Introduce tu PIN de acceso"
      description="Tu entrenador te habrá proporcionado un PIN de 6 caracteres con validez de 1 hora para completar tu registro."
      highlights={['PIN temporal', 'Acceso seguro', 'Solo un uso']}
      footerPrefix="¿Eres entrenador?"
      footerAction="Iniciar sesión"
      footerSuffix=""
      onFooterPress={() => router.back()}
      footerDisabled={isSubmitting}>
      <View style={styles.fieldsBlock}>
        <AppInput
          label="PIN de acceso"
          placeholder="XXXXXX"
          autoCapitalize="characters"
          autoCorrect={false}
          value={pin}
          onChangeText={(text) => setPin(text.toUpperCase())}
          variant="auth"
        />
      </View>

      <View style={styles.actionsBlock}>
        {errorMessage ? <StatusBanner tone="danger" title="PIN inválido" message={errorMessage} /> : null}
        {isSubmitting ? <StatusBanner tone="info" title="Validando PIN" loading message="Comprobando tu código de acceso..." /> : null}

        <AppButton
          label="Continuar con el PIN"
          onPress={handleValidatePin}
          loading={isSubmitting}
          disabled={isSubmitting}
        />
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  fieldsBlock: {
    gap: 12,
  },
  actionsBlock: {
    gap: 12,
    marginTop: 8,
  },
});
