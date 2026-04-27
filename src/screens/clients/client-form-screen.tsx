import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/feedback/empty-state';
import { StatusBanner } from '@/components/feedback/status-banner';
import { AppButton } from '@/components/forms/app-button';
import { AppInput } from '@/components/forms/app-input';
import { AppSelect } from '@/components/forms/app-select';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { ScreenContainer } from '@/components/layout/screen-container';
import { ThemedText } from '@/components/themed-text';
import { ATHLETE_LEVEL_OPTIONS, DEFAULT_ATHLETE_LEVEL, normalizeAthleteLevel } from '@/constants/athlete-level';
import { Accent, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { clientsService } from '@/services/clients';
import { Client, ClientSex } from '@/types/domain';


type ClientFormScreenProps = {
  mode: 'create' | 'edit';
  clientId?: string;
};

const SEX_OPTIONS: { label: string; value: ClientSex }[] = [
  { label: 'Mujer', value: 'female' },
  { label: 'Hombre', value: 'male' },
];

export function ClientFormScreen({ mode, clientId }: ClientFormScreenProps) {
  const { user } = useAuth();
  const theme = useTheme();
  const [name, setName] = useState('');
  const [sex, setSex] = useState<ClientSex | null>(null);
  const [athleteLevel, setAthleteLevel] = useState(DEFAULT_ATHLETE_LEVEL);
  const [heightCm, setHeightCm] = useState('');
  const [age, setAge] = useState('');
  const [isLoading, setIsLoading] = useState(mode === 'edit');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [client, setClient] = useState<Client | null>(null);

  useEffect(() => {
    if (mode !== 'edit' || !clientId || !user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    clientsService
      .getById(clientId, user.id)
      .then((nextClient) => {
        if (!nextClient) { setClient(null); return; }

        setClient(nextClient);
        setName(nextClient.name);
        setSex(nextClient.sex);
        setAthleteLevel(nextClient.athleteLevel);
        setHeightCm(nextClient.heightCm ? String(nextClient.heightCm) : '');
        setAge(nextClient.age ? String(nextClient.age) : '');
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'No se pudo cargar el cliente.';
        setErrorMessage(message);
      })
      .finally(() => { setIsLoading(false); });
  }, [clientId, mode, user?.id]);

  async function handleSubmit() {
    if (!user?.id) { setErrorMessage('No hay una sesion activa.'); return; }
    if (!name.trim()) { setErrorMessage('El nombre del cliente es obligatorio.'); return; }

    setErrorMessage(null);
    setIsSubmitting(true);

    const parsedHeight = heightCm.trim() ? Number(heightCm.replace(',', '.')) : null;
    const parsedAge = age.trim() ? Number(age) : null;

    if ((parsedHeight !== null && Number.isNaN(parsedHeight)) || (parsedAge !== null && Number.isNaN(parsedAge))) {
      setErrorMessage('Altura y edad deben ser valores numericos validos.');
      setIsSubmitting(false);
      return;
    }

    try {
      if (mode === 'create') {
        const createdClient = await clientsService.create({ ownerId: user.id, name: name.trim(), sex, athleteLevel, heightCm: parsedHeight, age: parsedAge });
        router.replace(`/clients/${createdClient.id}`);
        return;
      }

      if (!clientId) throw new Error('No se ha encontrado el cliente a editar.');

      const updatedClient = await clientsService.update(clientId, user.id, { name: name.trim(), sex, athleteLevel, heightCm: parsedHeight, age: parsedAge });
      router.replace(`/clients/${updatedClient.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo guardar el cliente.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <ScreenContainer>
        <PageHeader title="Cargando..." />
        <PageSection first>
          <StatusBanner tone="info" loading message="Obteniendo datos del cliente." />
        </PageSection>
      </ScreenContainer>
    );
  }

  if (mode === 'edit' && !client && !errorMessage) {
    return (
      <ScreenContainer>
        <EmptyState
          title="Cliente no disponible"
          description="No se ha encontrado el registro que intentas editar."
          actionLabel="Volver a clientes"
          onAction={() => router.replace('/clients')}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer contentStyle={styles.screenContent}>
      <PageHeader
        eyebrow={mode === 'create' ? 'Alta' : 'Edicion'}
        title={mode === 'create' ? 'Nuevo cliente' : 'Editar cliente'}
        subtitle={mode === 'create' ? 'Ficha rápida y limpia.' : 'Actualiza la ficha del cliente.'}
        rightSlot={
          <AppButton
            variant="surface"
            size="compact"
            fullWidth={false}
            onPress={() => router.back()}
            disabled={isSubmitting}
            accessibilityLabel="Volver"
            leadingIcon={
              <View style={styles.backIconWrap}>
                <ThemedText type="smallBold" style={styles.backIcon}>←</ThemedText>
              </View>
            }
          />
        }
      />

      <PageSection first style={styles.formSection}>
        {isSubmitting ? <StatusBanner tone="info" loading message="Guardando..." /> : null}
        {errorMessage ? <StatusBanner tone="danger" message={errorMessage} /> : null}

        <View style={[styles.formCard, { borderColor: theme.backgroundSelected }]}>
          <View style={styles.formIntro}>
            <View style={[styles.formAccent, { backgroundColor: Accent.primary }]} />
            <View style={styles.formIntroCopy}>
              <ThemedText type="smallBold" style={styles.formTitle}>Datos del cliente</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Información básica para empezar.</ThemedText>
            </View>
          </View>

          <AppInput
            label="Nombre"
            placeholder="Ana Torres"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="next"
            containerStyle={styles.formField}
          />

          <AppSelect
            label="Sexo"
            value={sex ?? ''}
            options={SEX_OPTIONS.map((option) => ({ label: option.label, value: option.value }))}
            placeholder="Selecciona una opción"
            onChange={(value) => setSex(value as ClientSex)}
            containerStyle={styles.formField}
          />

          <AppSelect
            label="Nivel"
            value={athleteLevel}
            options={ATHLETE_LEVEL_OPTIONS.map((option) => ({
              label: option.displayLabel,
              value: option.value,
              disabled: !option.enabled,
            }))}
            placeholder="Selecciona el nivel"
            onChange={(value) => setAthleteLevel(normalizeAthleteLevel(value))}
            helper="Orienta los protocolos por defecto."
            containerStyle={styles.formField}
          />

          <View style={styles.formRow}>
            <View style={styles.formCell}>
              <AppInput
                label="Altura"
                placeholder="168"
                keyboardType="decimal-pad"
                inputMode="decimal"
                unit="cm"
                value={heightCm}
                onChangeText={setHeightCm}
                returnKeyType="next"
                containerStyle={styles.formField}
              />
            </View>
            <View style={styles.formCell}>
              <AppInput
                label="Edad"
                placeholder="31"
                keyboardType="number-pad"
                inputMode="numeric"
                unit="años"
                value={age}
                onChangeText={setAge}
                returnKeyType="done"
                containerStyle={styles.formField}
              />
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.actionsCopy}>Puedes editar estos datos más adelante.</ThemedText>
          <AppButton label={mode === 'create' ? 'Crear cliente' : 'Guardar cambios'} onPress={handleSubmit} loading={isSubmitting} />
          {mode === 'edit' ? (
            <AppButton label="Cancelar" variant="surface" onPress={() => router.back()} disabled={isSubmitting} />
          ) : null}
        </View>
      </PageSection>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    gap: 2,
  },
  backIcon: {
    color: Accent.primary,
    fontSize: 16,
    lineHeight: 16,
    textAlign: 'center',
  },
  backIconWrap: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formSection: {
    paddingTop: Spacing.three,
  },
  formCard: {
    borderWidth: 1,
    borderRadius: Radius.large,
    backgroundColor: '#FFFFFF',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  formIntro: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  formAccent: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
    marginTop: 8,
  },
  formIntroCopy: {
    flex: 1,
    gap: 2,
  },
  formTitle: {
    color: '#10203B',
  },
  formField: {
    minHeight: 54,
    borderRadius: Radius.medium,
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formCell: {
    flex: 1,
  },
  actions: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
  },
  actionsCopy: {
    lineHeight: 18,
  },
});