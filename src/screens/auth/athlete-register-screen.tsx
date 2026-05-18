import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthShell } from '@/components/auth/auth-shell';
import { StatusBanner } from '@/components/feedback/status-banner';
import { AppButton } from '@/components/forms/app-button';
import { AppInput } from '@/components/forms/app-input';
import { AppSelect } from '@/components/forms/app-select';
import { ATHLETE_LEVEL_OPTIONS, DEFAULT_ATHLETE_LEVEL } from '@/constants/athlete-level';
import { supabase } from '@/lib/supabase';
import { athletePinsService } from '@/services/athlete-pins';
import { AthleteLevel, ClientSex } from '@/types/domain';

const SEX_OPTIONS: { label: string; value: ClientSex }[] = [
  { label: 'Mujer', value: 'female' },
  { label: 'Hombre', value: 'male' },
];

export function AthleteRegisterScreen() {
  const { pin, trainerId } = useLocalSearchParams<{ pin: string; trainerId: string }>();

  const [name, setName] = useState('');
  const [sex, setSex] = useState<ClientSex | null>(null);
  const [athleteLevel, setAthleteLevel] = useState<AthleteLevel>(DEFAULT_ATHLETE_LEVEL);
  const [heightCm, setHeightCm] = useState('');
  const [age, setAge] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRegister() {
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('El nombre es obligatorio.');
      return;
    }

    if (!email.trim() || !password.trim()) {
      setErrorMessage('El correo y la contraseña son obligatorios.');
      return;
    }

    if (password.trim().length < 6) {
      setErrorMessage('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (!pin || !trainerId) {
      setErrorMessage('PIN inválido. Vuelve atrás y solicita uno nuevo a tu entrenador.');
      return;
    }

    const parsedHeight = heightCm.trim() ? Number(heightCm.replace(',', '.')) : null;
    const parsedAge = age.trim() ? Number(age) : null;

    if (parsedHeight !== null && (Number.isNaN(parsedHeight) || parsedHeight <= 0)) {
      setErrorMessage('La altura debe ser un número válido en cm.');
      return;
    }

    if (parsedAge !== null && (Number.isNaN(parsedAge) || parsedAge <= 0)) {
      setErrorMessage('La edad debe ser un número válido.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Crear cuenta en Supabase Auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { fullName: name.trim(), role: 'athlete' },
        },
      });

      if (signUpError) {
        throw new Error(signUpError.message);
      }

      // 2. Si no hay sesión inmediata, intentar iniciar sesión
      let hasSession = Boolean(signUpData.session);

      if (!hasSession) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) {
          throw new Error('Cuenta creada. Confirma tu correo electrónico y vuelve a iniciar sesión para completar el registro.');
        }

        hasSession = true;
      }

      // 3. Registrar atleta y crear cliente via RPC
      const result = await athletePinsService.registerAthlete({
        pin,
        name: name.trim(),
        sex: sex ?? null,
        athleteLevel,
        heightCm: parsedHeight,
        age: parsedAge,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      router.replace('/athlete');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo completar el registro.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      brandSubtitle="Registro de atleta"
      eyebrow="Crear mi perfil"
      title="Completa tu ficha de atleta"
      description="Introduce tus datos para que tu entrenador pueda seguir tu evolución desde el primer día."
      highlights={['Perfil completo', 'Vinculado a tu entrenador', 'Listo para entrenar']}
      footerPrefix="¿Tienes cuenta?"
      footerAction="Iniciar sesión"
      footerSuffix=""
      onFooterPress={() => router.replace('/login')}
      footerDisabled={isSubmitting}>
      <View style={styles.fieldsBlock}>
        {/* Datos de acceso */}
        <AppInput
          label="Correo electrónico"
          placeholder="atleta@correo.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
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

        {/* Datos personales */}
        <AppInput
          label="Nombre completo"
          placeholder="Ej: Carlos García"
          value={name}
          onChangeText={setName}
          variant="auth"
        />
        <AppSelect
          label="Sexo"
          value={sex}
          options={SEX_OPTIONS}
          placeholder="Selecciona tu sexo"
          onChange={(v) => setSex(v as ClientSex)}
        />
        <AppInput
          label="Edad"
          placeholder="Ej: 28"
          keyboardType="numeric"
          value={age}
          onChangeText={setAge}
          variant="auth"
        />
        <AppInput
          label="Altura (cm)"
          placeholder="Ej: 175"
          keyboardType="numeric"
          value={heightCm}
          onChangeText={setHeightCm}
          variant="auth"
        />
        <AppSelect
          label="Nivel deportivo"
          value={athleteLevel}
          options={ATHLETE_LEVEL_OPTIONS.filter((o) => o.enabled)}
          onChange={(v) => setAthleteLevel(v as AthleteLevel)}
        />
      </View>

      <View style={styles.actionsBlock}>
        {errorMessage ? <StatusBanner tone="danger" title="No se pudo registrar" message={errorMessage} /> : null}
        {isSubmitting ? (
          <StatusBanner tone="info" title="Creando perfil" loading message="Registrando tu cuenta y vinculando con tu entrenador..." />
        ) : null}

        <AppButton
          label="Crear mi cuenta de atleta"
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
