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
import { Spacing } from '@/constants/theme';
import { revisionsService } from '@/services/revisions';
import { Revision } from '@/types/domain';
import { formatRevisionPhase } from '@/utils/revisions';

import { ThemedText } from '@/components/themed-text';

type RevisionDetailScreenProps = {
  revisionId: string;
};

function fmt(value: number | null | undefined, unit: string) {
  return value !== null && value !== undefined ? `${value} ${unit}` : '-';
}

export function RevisionDetailScreen({ revisionId }: RevisionDetailScreenProps) {
  const [revision, setRevision] = useState<Revision | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadRevision() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextRevision = await revisionsService.getById(revisionId);
        setRevision(nextRevision);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo cargar la revision.';
        setErrorMessage(message);
      } finally {
        setIsLoading(false);
      }
    }

    void loadRevision();
  }, [revisionId]);

  async function confirmDelete() {
    if (!revision || isDeleting) return;

    setIsDeleting(true);

    try {
      await revisionsService.remove(revision.id);
      router.replace(`/clients/${revision.clientId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo eliminar la revision.';
      setErrorMessage(message);
      setIsDeleting(false);
    }
  }

  function handleDelete() {
    if (!revision) return;

    Alert.alert(
      'Eliminar revision',
      'Esta accion no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => { void confirmDelete(); } },
      ]
    );
  }

  if (isLoading) {
    return (
      <ScreenContainer>
        <PageHeader title="Cargando..." />
        <PageSection first>
          <StatusBanner tone="info" loading message="Consultando datos en Supabase." />
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
          <AppButton label="Volver" variant="ghost" onPress={() => router.back()} />
        </PageSection>
      </ScreenContainer>
    );
  }

  if (!revision) {
    return (
      <ScreenContainer>
        <EmptyState
          title="Revision no encontrada"
          description="No existe una revision con ese identificador."
          actionLabel="Volver"
          onAction={() => router.back()}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <PageHeader
        eyebrow={formatRevisionPhase(revision.phase)}
        title={new Date(revision.reviewedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
        rightSlot={
          <AppButton label="← Volver" variant="ghost" size="compact" fullWidth={false} onPress={() => router.back()} />
        }
      />

      <PageSection label="Resumen" first>
        <MetricRow label="Fase" value={formatRevisionPhase(revision.phase)} />
        <MetricRow label="IMC" value={revision.bmi !== null ? String(revision.bmi) : '-'} />
        <MetricRow label="Peso" value={fmt(revision.weightKg, 'kg')} />
        <MetricRow label="Diferencia de peso" value={revision.weightDiffKg !== null ? `${revision.weightDiffKg} kg` : '-'} />
        <MetricRow label="Grasa visual" value={revision.bodyFatVisualPct !== null ? `${revision.bodyFatVisualPct}%` : '-'} />
        <MetricRow label="Masa grasa" value={fmt(revision.fatMassKg, 'kg')} />
        <MetricRow label="Diferencia masa grasa" value={revision.fatMassDiffKg !== null ? `${revision.fatMassDiffKg} kg` : '-'} />
        <MetricRow label="Masa libre" value={fmt(revision.leanMassKg, 'kg')} />
        <MetricRow label="Diferencia masa libre" value={revision.leanMassDiffKg !== null ? `${revision.leanMassDiffKg} kg` : '-'} />
        <MetricRow label="Mantenimiento" value={revision.maintenanceKcal !== null ? `${revision.maintenanceKcal} kcal` : '-'} />
        <MetricRow label="Objetivo calórico" value={revision.targetKcal !== null ? `${revision.targetKcal} kcal` : '-'} last />
      </PageSection>

      <PageSection label="Perímetros">
        <MetricRow label="Cuello" value={fmt(revision.neckCm, 'cm')} />
        <MetricRow label="Brazo" value={fmt(revision.armCm, 'cm')} />
        <MetricRow label="Cintura" value={fmt(revision.waistCm, 'cm')} />
        <MetricRow label="Abdomen" value={fmt(revision.bellyCm, 'cm')} />
        <MetricRow label="Pelvis" value={fmt(revision.pelvisCm, 'cm')} />
        <MetricRow label="Glúteo" value={fmt(revision.gluteCm, 'cm')} />
        <MetricRow label="Muslo" value={fmt(revision.thighCm, 'cm')} last />
      </PageSection>

      <PageSection label="Pliegues">
        <MetricRow label="Tricipital" value={fmt(revision.tricepFoldMm, 'mm')} />
        <MetricRow label="Subescapular" value={fmt(revision.subscapularFoldMm, 'mm')} />
        <MetricRow label="Abdominal" value={fmt(revision.abdominalFoldMm, 'mm')} />
        <MetricRow label="Suprailiaco" value={fmt(revision.suprailiacFoldMm, 'mm')} />
        <MetricRow label="Muslo frontal" value={fmt(revision.frontThighFoldMm, 'mm')} />
        <MetricRow label="Pantorrilla" value={fmt(revision.calfFoldMm, 'mm')} last />
      </PageSection>

      {revision.notes ? (
        <PageSection label="Notas">
          <ThemedText type="default" themeColor="textSecondary">
            {revision.notes}
          </ThemedText>
        </PageSection>
      ) : null}

      <PageSection label="Acciones">
        <View style={styles.actions}>
          <AppButton label="Editar revision" onPress={() => router.push(`/revisions/${revision.id}/edit?clientId=${revision.clientId}`)} />
          <AppButton label="Volver al cliente" variant="secondary" onPress={() => router.replace(`/clients/${revision.clientId}`)} />
          <AppButton label="Eliminar revision" variant="danger" onPress={handleDelete} loading={isDeleting} />
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