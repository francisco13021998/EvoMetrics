import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthShell } from '@/components/auth/auth-shell';
import { StatusBanner } from '@/components/feedback/status-banner';
import { AppButton } from '@/components/forms/app-button';
import { AppInput } from '@/components/forms/app-input';
import { useAuth } from '@/hooks/use-auth';
import { resolveSignInCredentials } from '@/services/auth';

export function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const preset = resolveSignInCredentials({ email, password: '' });

    if (preset.email === email && preset.password !== password && preset.password) {
      setPassword(preset.password);
    }

    if (preset.email !== email) {
      setEmail(preset.email);
      if (!password) {
        setPassword(preset.password);
      }
    }
  }, [email, password]);

  async function handleLogin() {
    setErrorMessage(null);

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Introduce tu email y tu contraseña para continuar.');
      return;
    }

    setIsSubmitting(true);

    try {
      const credentials = resolveSignInCredentials({ email, password });

      await signIn(credentials);
      router.replace('/clients');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo iniciar sesión.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      brandSubtitle="Gestión profesional para nutrición y entrenamiento"
      eyebrow="Acceso seguro"
      title="Inicia sesión en tu panel"
      description="Accede a tus clientes y revisiones con una interfaz clara, rápida y preparada para consulta profesional diaria."
      highlights={['Flujo guiado', 'Datos organizados', 'Resultados fiables']}
      footerPrefix=""
      footerAction=""
      footerSuffix=""
      onFooterPress={() => {}}
      footerDisabled>
      <View style={styles.fieldsBlock}>
        <AppInput
          label="Correo"
          placeholder="coach@evometrics.app"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
          variant="auth"
        />
        <AppInput
          label="Contraseña"
          placeholder="Introduce tu contraseña"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          variant="auth"
        />
      </View>

      <View style={styles.actionsBlock}>
        {errorMessage ? <StatusBanner tone="danger" title="No se pudo iniciar sesión" message={errorMessage} /> : null}
        {isSubmitting ? <StatusBanner tone="info" title="Comprobando credenciales" loading message="Validando acceso..." /> : null}

        <AppButton label="Iniciar sesión" onPress={handleLogin} loading={isSubmitting} disabled={isSubmitting} />
        <AppButton
          label="Unirme"
          variant="ghost"
          onPress={() => router.push('/join')}
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