import { router } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthShell } from '@/components/auth/auth-shell';
import { StatusBanner } from '@/components/feedback/status-banner';
import { AppButton } from '@/components/forms/app-button';
import { AppInput } from '@/components/forms/app-input';
import { supabase } from '@/lib/supabase';

export function TrainerRequestScreen() {
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRequest() {
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setErrorMessage('Introduce tu correo electrónico para continuar.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setErrorMessage('El formato del correo no es válido.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.functions.invoke('send-trainer-request', {
        body: { email: trimmedEmail },
      });

      if (error) {
        throw new Error(error.message);
      }

      setSuccessMessage('Solicitud enviada. Nos pondremos en contacto contigo lo antes posible.');
      setEmail('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo enviar la solicitud.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      brandSubtitle="Acceso para entrenadores"
      eyebrow="Solicitar cuenta de entrenador"
      title="Pide tu acceso como entrenador"
      description="Introduce tu correo y te contactaremos para validar tu perfil profesional y activar tu cuenta en EvoMetrics."
      highlights={['Revisión manual', 'Acceso profesional', 'Sin esperas largas']}
      footerPrefix="¿Ya tienes cuenta?"
      footerAction="Iniciar sesión"
      footerSuffix=""
      onFooterPress={() => router.replace('/login')}
      footerDisabled={isSubmitting}>
      <View style={styles.fieldsBlock}>
        <AppInput
          label="Tu correo electrónico"
          placeholder="entrenador@correo.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
          variant="auth"
        />
      </View>

      <View style={styles.actionsBlock}>
        {errorMessage ? (
          <StatusBanner tone="danger" title="No se pudo enviar" message={errorMessage} />
        ) : null}
        {successMessage ? (
          <StatusBanner tone="success" title="Solicitud enviada" message={successMessage} />
        ) : null}
        {isSubmitting ? (
          <StatusBanner tone="info" title="Enviando solicitud" loading message="Enviando tu solicitud..." />
        ) : null}

        <AppButton
          label="Enviar solicitud"
          onPress={handleRequest}
          loading={isSubmitting}
          disabled={isSubmitting || Boolean(successMessage)}
        />
        {successMessage ? (
          <AppButton
            label="Volver al inicio"
            variant="ghost"
            onPress={() => router.replace('/login')}
          />
        ) : null}
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
