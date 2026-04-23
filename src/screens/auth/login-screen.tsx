import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { StatusBanner } from '@/components/feedback/status-banner';
import { AppButton } from '@/components/forms/app-button';
import { AppInput } from '@/components/forms/app-input';
import { ScreenContainer } from '@/components/layout/screen-container';
import { Accent, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { resolveSignInCredentials } from '@/services/auth';

import { ThemedText } from '@/components/themed-text';

export function LoginScreen() {
  const theme = useTheme();
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
      setErrorMessage('Introduce tu email y tu contrasena para continuar.');
      return;
    }

    setIsSubmitting(true);

    try {
      const credentials = resolveSignInCredentials({ email, password });

      await signIn(credentials);
      router.replace('/clients');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo iniciar sesion.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScreenContainer scrollable={false} contentStyle={styles.content}>
      <View style={[styles.topRule, { backgroundColor: Accent.primary }]} />
      <View style={styles.brand}>
        <ThemedText type="label" style={[styles.brandLabel, { color: Accent.primary }]}>
          EvoMetrics
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Panel profesional
        </ThemedText>
      </View>

      <View style={styles.intro}>
        <ThemedText type="headline">Bienvenido de nuevo.</ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          Accede a tu panel de clientes y revisiones.
        </ThemedText>
      </View>

      <View style={styles.form}>
        <AppInput
          label="Correo"
          placeholder="coach@evometrics.app"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
        />
        <AppInput
          label="Contrasena"
          placeholder="••••••••"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {errorMessage ? <StatusBanner tone="danger" message={errorMessage} /> : null}
        {isSubmitting ? <StatusBanner tone="info" loading message="Validando acceso..." /> : null}

        <View style={styles.actions}>
          <AppButton label="Iniciar sesion" onPress={handleLogin} loading={isSubmitting} />
          <View style={[styles.divider, { borderTopColor: theme.backgroundSelected }]} />
          <AppButton
            label="Crear cuenta"
            variant="ghost"
            onPress={() => router.push('/register')}
            disabled={isSubmitting}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    maxWidth: 480,
    gap: Spacing.four,
  },
  topRule: {
    height: 3,
    width: 64,
    borderRadius: 2,
  },
  brand: {
    gap: Spacing.half,
  },
  brandLabel: {
    letterSpacing: 1,
  },
  intro: {
    gap: Spacing.two,
  },
  form: {
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  actions: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  divider: {
    borderTopWidth: 1,
    marginVertical: Spacing.one,
  },
});