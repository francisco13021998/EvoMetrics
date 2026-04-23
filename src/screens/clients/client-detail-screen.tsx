import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/feedback/empty-state';
import { StatusBanner } from '@/components/feedback/status-banner';
import { AppButton } from '@/components/forms/app-button';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { ScreenContainer } from '@/components/layout/screen-container';
import { MetricRow } from '@/components/surface/metric-row';
import { RevisionRow } from '@/components/surface/revision-row';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { clientsService } from '@/services/clients';
import { revisionsService } from '@/services/revisions';
import { Client, Revision } from '@/types/domain';

import { ThemedText } from '@/components/themed-text';

type ClientDetailScreenProps = {
  clientId: string;
};

function formatSex(sex: Client['sex']) {
  if (sex === 'female') return 'Mujer';
  if (sex === 'male') return 'Hombre';
  if (sex === 'other') return 'Otro';
  return '-';
}

export function ClientDetailScreen({ clientId }: ClientDetailScreenProps) {
  const { user } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [revisions, setRevisions] = useState<Revision[]>([]);

  const showInitialLoading = isLoading && !client;

  async function loadClient() {
    if (!user?.id) {
      setClient(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const nextClient = await clientsService.getById(clientId, user.id);
      setClient(nextClient);

      if (nextClient) {
        const nextRevisions = await revisionsService.listByClient(nextClient.id);
        setRevisions(nextRevisions);
      } else {
        setRevisions([]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cargar el cliente.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadClient();
  }, [clientId, user?.id]);

  async function confirmDelete() {
    if (!client || !user?.id || isDeleting) return;

    setIsDeleting(true);

    try {
      await clientsService.remove(client.id, user.id);
      router.replace('/clients');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo eliminar el cliente.';
      setErrorMessage(message);
    } finally {
      setIsDeleting(false);
    }
  }

  function handleDelete() {
    if (!client) return;

    Alert.alert(
      'Eliminar cliente',
      `Se eliminara ${client.name}. Esta accion no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => { void confirmDelete(); } },
      ]
    );
  }

  if (showInitialLoading) {
    return (
      <ScreenContainer>
        <PageHeader title="Cargando..." />
        <PageSection first>
          <StatusBanner tone="info" loading message="Sincronizando datos del cliente." />
        </PageSection>
      </ScreenContainer>
    );
  }

  if (errorMessage) {
    return (
      <ScreenContainer>
        <PageHeader title="Error" />
        <PageSection first>
          <StatusBanner tone="danger" message={errorMessage} />
          <AppButton label="Reintentar" onPress={() => void loadClient()} variant="secondary" />
        </PageSection>
      </ScreenContainer>
    );
  }

  if (!client) {
    return (
      <ScreenContainer>
        <EmptyState
          title="Cliente no encontrado"
          description="Este perfil no existe o no pertenece al usuario autenticado."
          actionLabel="Volver a clientes"
          onAction={() => router.replace('/clients')}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <PageHeader
        eyebrow="Cliente"
        title={client.name}
        subtitle={`${formatSex(client.sex)} · ${client.age ? `${client.age} años` : 'Edad pendiente'} · ${client.heightCm ? `${client.heightCm} cm` : 'Altura pendiente'}`}
        rightSlot={
          <AppButton label="← Volver" variant="ghost" size="compact" fullWidth={false} onPress={() => router.back()} />
        }
      />

      <PageSection label="Datos" first>
        <MetricRow label="Nombre" value={client.name} />
        <MetricRow label="Sexo" value={formatSex(client.sex)} />
        <MetricRow label="Altura" value={client.heightCm ? `${client.heightCm} cm` : '-'} />
        <MetricRow label="Edad" value={client.age ? `${client.age} años` : '-'} last />
      </PageSection>

      <PageSection
        label="Revisiones"
        rightSlot={
          <AppButton label="Nueva" size="compact" fullWidth={false} onPress={() => router.push(`/revisions/new?clientId=${client.id}`)} />
        }>
        {revisions.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Sin revisiones registradas.
          </ThemedText>
        ) : (
          <View>
            {revisions.map((revision, index) => (
              <RevisionRow
                key={revision.id}
                phase={revision.phase}
                date={new Date(revision.reviewedAt).toLocaleDateString('es-ES')}
                weight={revision.weightKg ? `${revision.weightKg} kg` : '-'}
                onPress={() => router.push(`/revisions/${revision.id}`)}
                last={index === revisions.length - 1}
              />
            ))}
          </View>
        )}
      </PageSection>

      <PageSection label="Acciones">
        <View style={styles.actions}>
          <AppButton label="Editar cliente" onPress={() => router.push(`/clients/${client.id}/edit`)} />
          <AppButton label="Fotos" variant="secondary" onPress={() => router.push(`/clients/${client.id}/photos`)} />
          <AppButton label="Eliminar cliente" variant="danger" onPress={handleDelete} loading={isDeleting} />
        </View>
      </PageSection>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: Spacing.two,
  },
});