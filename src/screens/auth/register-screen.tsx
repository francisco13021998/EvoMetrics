import { router } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { StatusBanner } from '@/components/feedback/status-banner';
import { AppButton } from '@/components/forms/app-button';
import { AppInput } from '@/components/forms/app-input';
import { ScreenContainer } from '@/components/layout/screen-container';
import { Accent, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from '@/components/themed-text';

export function RegisterScreen() {
  const theme = useTheme();
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRegister() {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setErrorMessage('Nombre, email y contrasena son obligatorios.');
      return;
    }

    if (password.trim().length < 6) {
      setErrorMessage('La contrasena debe tener al menos 6 caracteres.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await signUp({
        email: email.trim(),
        password,
        metadata: {
          fullName: fullName.trim(),
          clinicName: clinicName.trim() || undefined,
        },
      });

      if (result.needsEmailConfirmation) {
        setSuccessMessage('Cuenta creada. Revisa tu correo para confirmar el acceso antes de iniciar sesion.');
        return;
      }

      router.replace('/clients');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo crear la cuenta.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScreenContainer scrollable contentStyle={styles.content}>
      <View style={[styles.topRule, { backgroundColor: Accent.primary }]} />
      <View style={styles.brand}>
        <ThemedText type="label" style={[styles.brandLabel, { color: Accent.primary }]}>
          EvoMetrics
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Registro profesional
        </ThemedText>
      </View>

      <View style={styles.intro}>
        <ThemedText type="headline">Crea tu espacio.</ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          Configura tu perfil profesional para empezar a gestionar clientes.
        </ThemedText>
      </View>

      <View style={styles.form}>
        <AppInput label="Nombre completo" placeholder="Valentina Rojas" value={fullName} onChangeText={setFullName} />
        <AppInput label="Centro o marca (opcional)" placeholder="EvoMetrics Studio" value={clinicName} onChangeText={setClinicName} />
        <AppInput
          label="Correo"
          placeholder="coach@evometrics.app"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <AppInput label="Contrasena" placeholder="Minimo 6 caracteres" secureTextEntry value={password} onChangeText={setPassword} />

        {errorMessage ? <StatusBanner tone="danger" message={errorMessage} /> : null}
        {successMessage ? <StatusBanner tone="success" message={successMessage} /> : null}
        {isSubmitting ? <StatusBanner tone="info" loading message="Creando tu cuenta..." /> : null}

        <View style={styles.actions}>
          <AppButton label="Crear cuenta" onPress={handleRegister} loading={isSubmitting} />
          <View style={[styles.divider, { borderTopColor: theme.backgroundSelected }]} />
          <AppButton label="Ya tengo cuenta" variant="ghost" onPress={() => router.back()} disabled={isSubmitting} />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'center',
    maxWidth: 480,
    gap: Spacing.four,
    paddingTop: Spacing.six,
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