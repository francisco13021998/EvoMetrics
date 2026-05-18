import { router } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthShell } from '@/components/auth/auth-shell';
import { StatusBanner } from '@/components/feedback/status-banner';
import { AppButton } from '@/components/forms/app-button';
import { AppInput } from '@/components/forms/app-input';
import { useAuth } from '@/hooks/use-auth';

export function RegisterScreen() {
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
    <AuthShell
      brandSubtitle="Onboarding guiado para profesionales de salud y fitness"
      eyebrow="Registro profesional"
      title="Crea tu cuenta de trabajo"
      description="Configura tu perfil una sola vez y empieza a registrar revisiones de forma ordenada y segura."
      highlights={['Configuracion en minutos', 'Estructura profesional', 'Escalable con tu cartera']}
      footerPrefix="¿Ya tienes cuenta?"
      footerAction="Iniciar sesión"
      footerSuffix=""
      onFooterPress={() => router.back()}
      footerDisabled={isSubmitting}>
      <View style={styles.fieldsBlock}>
        <AppInput
          label="Nombre completo"
          placeholder="Valentina Rojas"
          value={fullName}
          onChangeText={setFullName}
          variant="auth"
        />
        <AppInput
          label="Centro o marca (opcional)"
          placeholder="EvoMetrics Studio"
          value={clinicName}
          onChangeText={setClinicName}
          variant="auth"
        />
        <AppInput
          label="Correo"
          placeholder="coach@evometrics.app"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          variant="auth"
        />
        <AppInput
          label="Contraseña"
          placeholder="Mínimo 6 caracteres"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          variant="auth"
        />
      </View>

      <View style={styles.actionsBlock}>
        {errorMessage ? <StatusBanner tone="danger" title="No se pudo crear la cuenta" message={errorMessage} /> : null}
        {successMessage ? <StatusBanner tone="success" title="Cuenta creada" message={successMessage} /> : null}
        {isSubmitting ? <StatusBanner tone="info" title="Creando cuenta" loading message="Creando tu cuenta..." /> : null}

        <AppButton label="Crear cuenta" onPress={handleRegister} loading={isSubmitting} />
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