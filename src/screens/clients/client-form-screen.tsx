import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { EmptyState } from '@/components/feedback/empty-state';
import { StatusBanner } from '@/components/feedback/status-banner';
import { AppButton } from '@/components/forms/app-button';
import { AppCheckbox } from '@/components/forms/app-checkbox';
import { AppDateTimeInput } from '@/components/forms/app-date-time';
import { AppInput } from '@/components/forms/app-input';
import { AppSelect } from '@/components/forms/app-select';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { ScreenContainer } from '@/components/layout/screen-container';
import { ThemedText } from '@/components/themed-text';
import { ATHLETE_LEVEL_OPTIONS, DEFAULT_ATHLETE_LEVEL, normalizeAthleteLevel } from '@/constants/athlete-level';
import { Accent, Radius } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { clientsService } from '@/services/clients';
import { Client, ClientSex, RevisionFrequencyUnit } from '@/types/domain';
import { calculateAgeFromBirthDate, formatDateOnly, parseDateOnly } from '@/utils/client-age';
import { INACTIVE_REVISION_FREQUENCY_VALUE, isRevisionFrequencyActive } from '@/utils/client-revisions';


type ClientFormScreenProps = {
  mode: 'create' | 'edit';
  clientId?: string;
};

const SEX_OPTIONS: { label: string; value: ClientSex }[] = [
  { label: 'Mujer', value: 'female' },
  { label: 'Hombre', value: 'male' },
];

const REVISION_FREQUENCY_UNIT_OPTIONS: { label: string; value: RevisionFrequencyUnit }[] = [
  { label: 'Semanas', value: 'week' },
  { label: 'Meses', value: 'month' },
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
  const [birthDate, setBirthDate] = useState<Date | null>(mode === 'create' ? new Date(2000, 0, 1) : null);
  const [revisionFrequencyEnabled, setRevisionFrequencyEnabled] = useState(false);
  const [revisionFrequencyValue, setRevisionFrequencyValue] = useState('4');
  const [revisionFrequencyUnit, setRevisionFrequencyUnit] = useState<RevisionFrequencyUnit>('week');
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
        setRevisionFrequencyEnabled(isRevisionFrequencyActive(nextClient.revisionFrequencyValue, nextClient.revisionFrequencyUnit));
        setRevisionFrequencyValue(isRevisionFrequencyActive(nextClient.revisionFrequencyValue, nextClient.revisionFrequencyUnit) ? String(nextClient.revisionFrequencyValue) : '0');
        setRevisionFrequencyUnit(nextClient.revisionFrequencyUnit ?? 'week');
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

    const parsedRevisionFrequencyValue = Number(revisionFrequencyValue);

    if (revisionFrequencyEnabled && (!Number.isInteger(parsedRevisionFrequencyValue) || parsedRevisionFrequencyValue <= 0)) {
      setErrorMessage('La frecuencia de revisiones debe ser un numero entero mayor que cero.');
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
          revisionFrequencyValue: revisionFrequencyEnabled ? parsedRevisionFrequencyValue : INACTIVE_REVISION_FREQUENCY_VALUE,
          revisionFrequencyUnit: revisionFrequencyEnabled ? revisionFrequencyUnit : 'week',
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
        revisionFrequencyValue: revisionFrequencyEnabled ? parsedRevisionFrequencyValue : INACTIVE_REVISION_FREQUENCY_VALUE,
        revisionFrequencyUnit: revisionFrequencyEnabled ? revisionFrequencyUnit : 'week',
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
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={({ pressed }) => [styles.backButton, (pressed || isSubmitting) && styles.pressed]}>
          <Ionicons name="chevron-back" size={18} color={Accent.primary} />
          <ThemedText type="smallBold" style={styles.backButtonText}>Clientes</ThemedText>
        </Pressable>
      </View>

      <View style={styles.pageHeader}>
        <View style={styles.pageHeaderIcon}>
          <Ionicons name={mode === 'create' ? 'person-add-outline' : 'create-outline'} size={25} color={Accent.primary} />
        </View>
        <View style={styles.pageHeaderCopy}>
          <ThemedText type="label" style={styles.pageEyebrow}>{mode === 'create' ? 'Nuevo registro' : 'Ficha del cliente'}</ThemedText>
          <ThemedText type="headline" style={styles.pageTitle}>{mode === 'create' ? 'Nuevo cliente' : 'Editar cliente'}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.pageSubtitle}>
            {mode === 'create' ? 'Completa solo los datos necesarios para empezar.' : 'Actualiza la información de este cliente.'}
          </ThemedText>
        </View>
      </View>

      <PageSection first style={styles.formSection}>
        {isSubmitting ? <StatusBanner tone="info" loading message="Guardando..." /> : null}
        {errorMessage ? <StatusBanner tone="danger" message={errorMessage} /> : null}

        <View style={[styles.formCard, { borderColor: theme.backgroundSelected }]}>
          <View style={styles.formIntro}>
            <View style={styles.formIntroIcon}><Ionicons name="person-outline" size={19} color={Accent.primary} /></View>
            <View style={styles.formIntroCopy}>
              <ThemedText type="smallBold" style={styles.formTitle}>Información básica</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.formDescription}>Identificación y perfil general.</ThemedText>
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

          <View style={[styles.formRow, !isWide && styles.formRowStacked]}>
            <View style={styles.formCell}>
              <AppSelect
                label="Sexo"
                value={sex ?? ''}
                options={SEX_OPTIONS.map((option) => ({ label: option.label, value: option.value }))}
                placeholder="Selecciona"
                onChange={(value) => setSex(value as ClientSex)}
                containerStyle={styles.formField}
              />
            </View>
            <View style={styles.formCell}>
              <AppSelect
                label="Nivel"
                value={athleteLevel}
                options={ATHLETE_LEVEL_OPTIONS.map((option) => ({
                  label: option.displayLabel,
                  value: option.value,
                  disabled: !option.enabled,
                }))}
                placeholder="Selecciona"
                onChange={(value) => setAthleteLevel(normalizeAthleteLevel(value))}
                containerStyle={styles.formField}
              />
            </View>
          </View>

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
                allowYearSelection
                minYear={1940}
                helper={birthDate ? `Edad actual: ${calculateAgeFromBirthDate(birthDate) ?? '-'} años` : 'Calcula la edad automáticamente.'}
                onChange={setBirthDate}
                shellStyle={styles.formField}
              />
            </View>
          </View>

          <View style={[styles.revisionFrequencyCard, { borderColor: theme.backgroundSelected }]}>
            <View style={styles.revisionFrequencyHeader}>
              <View style={styles.revisionFrequencyIcon}><Ionicons name="calendar-outline" size={18} color={Accent.primary} /></View>
              <View style={styles.revisionFrequencyCopy}>
                <ThemedText type="smallBold" style={styles.revisionFrequencyTitle}>Seguimiento automático</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">Programa la próxima revisión.</ThemedText>
              </View>
            </View>
            <AppCheckbox
              label="Activar frecuencia de revisiones"
              checked={revisionFrequencyEnabled}
              onChange={setRevisionFrequencyEnabled}
            />

            {revisionFrequencyEnabled ? (
              <View style={[styles.formRow, !isWide && styles.formRowStacked]}>
                <View style={styles.formCell}>
                  <AppInput
                    label="Numero"
                    placeholder="4"
                    keyboardType="number-pad"
                    inputMode="numeric"
                    value={revisionFrequencyValue}
                    onChangeText={setRevisionFrequencyValue}
                    containerStyle={styles.formField}
                  />
                </View>
                <View style={styles.formCell}>
                  <AppSelect
                    label="Unidad"
                    value={revisionFrequencyUnit}
                    options={REVISION_FREQUENCY_UNIT_OPTIONS}
                    onChange={(value) => setRevisionFrequencyUnit(value as RevisionFrequencyUnit)}
                    containerStyle={styles.formField}
                  />
                </View>
              </View>
            ) : null}
          </View>
        </View>

        <View style={[styles.actions, { borderColor: theme.backgroundSelected }]}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.actionsCopy}>Podrás actualizar esta información cuando lo necesites.</ThemedText>
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
    gap: 16,
    paddingTop: 14,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#DFE7F2',
    borderRadius: Radius.pill,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
  },
  backButtonText: {
    color: '#10203B',
  },
  pressed: {
    opacity: 0.74,
    transform: [{ scale: 0.98 }],
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pageHeaderIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F0FF',
    borderWidth: 1,
    borderColor: '#D2E0FA',
  },
  pageHeaderCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  pageEyebrow: {
    color: Accent.primary,
    lineHeight: 18,
    textTransform: 'uppercase',
  },
  pageTitle: {
    color: '#10203B',
    fontSize: 30,
    lineHeight: 36,
  },
  pageSubtitle: {
    lineHeight: 19,
  },
  formSection: {
    gap: 14,
  },
  formCard: {
    borderWidth: 1,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 14,
    shadowColor: '#12336E',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  formIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  formIntroIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF5FF',
  },
  formIntroCopy: {
    flex: 1,
    gap: 3,
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
  revisionFrequencyCard: {
    borderWidth: 1,
    borderRadius: 18,
    backgroundColor: '#F8FBFF',
    padding: 14,
    gap: 12,
  },
  revisionFrequencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  revisionFrequencyIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F0FF',
  },
  revisionFrequencyCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  revisionFrequencyTitle: {
    color: '#10203B',
  },
  actions: {
    gap: 10,
    borderWidth: 1,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    padding: 14,
  },
  actionsCopy: {
    lineHeight: 19,
  },
});
