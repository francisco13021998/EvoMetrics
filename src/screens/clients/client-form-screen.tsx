import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { EmptyState } from '@/components/feedback/empty-state';
import { StatusBanner } from '@/components/feedback/status-banner';
import { AppButton } from '@/components/forms/app-button';
import { AppDateTimeInput } from '@/components/forms/app-date-time';
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
import { calculateAgeFromBirthDate, formatDateOnly, parseDateOnly } from '@/utils/client-age';


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
  const { width } = useWindowDimensions();
  const isWide = width >= 720;
  const [name, setName] = useState('');
  const [sex, setSex] = useState<ClientSex | null>(null);
  const [athleteLevel, setAthleteLevel] = useState(DEFAULT_ATHLETE_LEVEL);
  const [heightCm, setHeightCm] = useState('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
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
        setBirthDate(parseDateOnly(nextClient.birthDate));
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
    const resolvedBirthDate = birthDate ? formatDateOnly(birthDate) : null;

    if (parsedHeight !== null && Number.isNaN(parsedHeight)) {
      setErrorMessage('La altura debe ser un valor numerico valido.');
      setIsSubmitting(false);
      return;
    }

    if (mode === 'create' && !resolvedBirthDate) {
      setErrorMessage('La fecha de nacimiento es obligatoria para crear el cliente.');
      setIsSubmitting(false);
      return;
    }

    try {
      if (mode === 'create') {
        const createdClient = await clientsService.create({
          ownerId: user.id,
          name: name.trim(),
          sex,
          athleteLevel,
          heightCm: parsedHeight,
          birthDate: resolvedBirthDate,
        });
        router.replace(`/clients/${createdClient.id}`);
        return;
      }

      if (!clientId) throw new Error('No se ha encontrado el cliente a editar.');

      const updatedClient = await clientsService.update(clientId, user.id, {
        name: name.trim(),
        sex,
        athleteLevel,
        heightCm: parsedHeight,
        birthDate: resolvedBirthDate,
      });
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
          <View style={styles.formCardTopAccent} />
          <View style={styles.formIntro}>
            <View style={styles.formIntroCopy}>
              <ThemedText type="label" style={styles.formEyebrow}>Ficha principal</ThemedText>
              <ThemedText type="smallBold" style={styles.formTitle}>Datos del cliente</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.formDescription}>Información básica para empezar y automatizar su seguimiento.</ThemedText>
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

          <View style={[styles.formRow, !isWide && styles.formRowStacked]}>
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
              <AppDateTimeInput
                label="Fecha de nacimiento"
                value={birthDate}
                mode="date"
                helper={birthDate ? `Edad actual: ${calculateAgeFromBirthDate(birthDate) ?? '-'} años` : 'Calcula la edad automáticamente.'}
                onChange={setBirthDate}
                shellStyle={styles.formField}
              />
            </View>
          </View>
        </View>

        <View style={[styles.actions, { borderColor: theme.backgroundSelected }]}>
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
    gap: 8,
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
    paddingTop: 12,
  },
  formCard: {
    borderWidth: 1,
    borderRadius: Radius.large,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
    overflow: 'hidden',
    shadowColor: '#12336E',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  formCardTopAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#2D66E0',
  },
  formIntro: {
    paddingTop: 4,
  },
  formIntroCopy: {
    flex: 1,
    gap: 3,
  },
  formEyebrow: {
    color: Accent.primary,
  },
  formTitle: {
    color: '#10203B',
    fontSize: 18,
    lineHeight: 24,
  },
  formDescription: {
    lineHeight: 19,
  },
  formField: {
    minHeight: 56,
    borderRadius: Radius.medium,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  formRowStacked: {
    flexDirection: 'column',
  },
  formCell: {
    flex: 1,
  },
  actions: {
    gap: 10,
    borderWidth: 1,
    borderRadius: Radius.large,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  actionsCopy: {
    lineHeight: 19,
  },
});