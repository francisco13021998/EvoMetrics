import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthShell } from '@/components/auth/auth-shell';
import { StatusBanner } from '@/components/feedback/status-banner';
import { AppButton } from '@/components/forms/app-button';
import { AppInput } from '@/components/forms/app-input';
import { supabase } from '@/lib/supabase';
import { athletePinsService } from '@/services/athlete-pins';

export function AthleteRegisterExistingScreen() {
  const { pin } = useLocalSearchParams<{ pin: string }>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRegister() {
    setErrorMessage(null);

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPin = (pin ?? '').trim().toUpperCase();

    if (!trimmedEmail || !password) {
      setErrorMessage('Rellena todos los campos para continuar.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (!trimmedPin) {
      setErrorMessage('PIN inválido. Vuelve atrás e introduce el PIN de nuevo.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Crear cuenta
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      });

      if (signUpError) {
        setErrorMessage(signUpError.message);
        return;
      }

      // 2. Si no hay sesión activa, iniciar sesión
      if (!signUpData.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (signInError) {
          setErrorMessage('Cuenta creada, pero no se pudo iniciar sesión automáticamente. Inicia sesión manualmente.');
          return;
        }
      }

      // 3. Vincular con el cliente existente via PIN
      const result = await athletePinsService.registerAthleteExisting(trimmedPin);

      if (!result.success) {
        setErrorMessage(result.error);
        return;
      }

      // 4. Redirigir a la app de atleta
      router.replace('/athlete');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error inesperado. Inténtalo de nuevo.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      brandSubtitle="Acceso para atletas"
      eyebrow="Crear cuenta de atleta"
      title="Configura tu acceso"
      description="Tu entrenador ya ha creado tu perfil. Solo necesitas configurar tu email y contraseña para acceder a tus datos."
      highlights={['Perfil ya creado', 'Solo email y contraseña', 'Acceso inmediato']}
      footerPrefix="¿Ya tienes cuenta?"
      footerAction="Iniciar sesión"
      footerSuffix=""
      onFooterPress={() => router.replace('/login')}
      footerDisabled={isSubmitting}>
      <View style={styles.fieldsBlock}>
        <AppInput
          label="Email"
          placeholder="tu@email.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          value={email}
          onChangeText={setEmail}
          variant="auth"
        />
        <AppInput
          label="Contraseña"
          placeholder="Mínimo 8 caracteres"
          secureTextEntry
          textContentType="newPassword"
          value={password}
          onChangeText={setPassword}
          variant="auth"
        />
      </View>

      <View style={styles.actionsBlock}>
        {errorMessage ? <StatusBanner tone="danger" title="Error" message={errorMessage} /> : null}
        {isSubmitting ? <StatusBanner tone="info" loading message="Vinculando tu cuenta con el perfil..." /> : null}

        <AppButton
          label="Crear cuenta y acceder"
          onPress={handleRegister}
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
