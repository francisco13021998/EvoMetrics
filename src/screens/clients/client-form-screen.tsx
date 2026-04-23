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
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { clientsService } from '@/services/clients';
import { Client, ClientSex } from '@/types/domain';


type ClientFormScreenProps = {
  mode: 'create' | 'edit';
  clientId?: string;
};

const SEX_OPTIONS: Array<{ label: string; value: ClientSex }> = [
  { label: 'Mujer', value: 'female' },
  { label: 'Hombre', value: 'male' },
  { label: 'Otro', value: 'other' },
];

export function ClientFormScreen({ mode, clientId }: ClientFormScreenProps) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [sex, setSex] = useState<ClientSex | null>(null);
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
        const createdClient = await clientsService.create({ ownerId: user.id, name: name.trim(), sex, heightCm: parsedHeight, age: parsedAge });
        router.replace(`/clients/${createdClient.id}`);
        return;
      }

      if (!clientId) throw new Error('No se ha encontrado el cliente a editar.');

      const updatedClient = await clientsService.update(clientId, user.id, { name: name.trim(), sex, heightCm: parsedHeight, age: parsedAge });
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
    <ScreenContainer>
      <PageHeader
        eyebrow={mode === 'create' ? 'Alta' : 'Edicion'}
        title={mode === 'create' ? 'Nuevo cliente' : 'Editar cliente'}
        rightSlot={
          <AppButton label="← Cancelar" variant="ghost" size="compact" fullWidth={false} onPress={() => router.back()} disabled={isSubmitting} />
        }
      />

      <PageSection first>
        {isSubmitting ? <StatusBanner tone="info" loading message="Guardando..." /> : null}
        {errorMessage ? <StatusBanner tone="danger" message={errorMessage} /> : null}

        <AppInput label="Nombre" placeholder="Ana Torres" value={name} onChangeText={setName} />

        <AppSelect
          label="Sexo"
          value={sex ?? ''}
          options={SEX_OPTIONS.map((option) => ({ label: option.label, value: option.value }))}
          placeholder="Selecciona el sexo"
          onChange={(value) => setSex(value as ClientSex)}
        />

        <View style={styles.formRow}>
          <View style={styles.formCell}>
            <AppInput
              label="Altura"
              placeholder="168"
              keyboardType="number-pad"
              unit="cm"
              value={heightCm}
              onChangeText={setHeightCm}
            />
          </View>
          <View style={styles.formCell}>
            <AppInput
              label="Edad"
              placeholder="31"
              keyboardType="number-pad"
              unit="años"
              value={age}
              onChangeText={setAge}
            />
          </View>
        </View>
      </PageSection>

      <PageSection>
        <View style={styles.actions}>
          <AppButton label={mode === 'create' ? 'Crear cliente' : 'Guardar cambios'} onPress={handleSubmit} loading={isSubmitting} />
        </View>
      </PageSection>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  formRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  formCell: {
    flex: 1,
  },
  actions: {
    gap: Spacing.two,
  },
});