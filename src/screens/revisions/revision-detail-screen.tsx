import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { EmptyState } from '@/components/feedback/empty-state';
import { StatusBanner } from '@/components/feedback/status-banner';
import { AppButton } from '@/components/forms/app-button';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { ScreenContainer } from '@/components/layout/screen-container';
import { ThemedText } from '@/components/themed-text';
import { FormulaInfoButton } from '@/components/ui/formula-info-button';
import { buildBodyFatFormulaInfoContent, getPerimeterFormulaCodeForSex } from '@/constants/body-fat-formulas';
import { Accent, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { type BodyFatFormulaReference, bodyFatFormulasService } from '@/services/body-fat-formulas';
import { clientsService } from '@/services/clients';
import { revisionsService } from '@/services/revisions';
import { Client, Revision } from '@/types/domain';
import { findActivityFactorOption } from '@/utils/activity';
import {
    calculateBodyFatAverage,
    calculateBodyFatFromPerimeters,
    calculateBodyFatFromSkinfolds,
} from '@/utils/calculations';
import {
    buildBodyFatAverageSignature,
    buildRevisionBodyFatAverageSignature,
    findPreviousComparableRevisionByAverageSignature,
} from '@/utils/revision-comparisons';
import { getPerimeterFieldKeysForSex } from '@/utils/revision-measurements';
import { formatRevisionPhase } from '@/utils/revisions';

type RevisionDetailScreenProps = {
  revisionId: string;
};

type DetailItem = {
  label: string;
  value: string;
  delta?: string | null;
};

type SectionKey = 'summary' | 'perimeters' | 'skinfolds' | 'notes';

const PERIMETER_LABEL_BY_KEY = {
  neckCm: 'Cuello',
  armCm: 'Brazo',
  waistCm: 'Cintura',
  bellyCm: 'Abdomen',
  pelvisCm: 'Pelvis',
  gluteCm: 'Glúteo',
  thighCm: 'Muslo',
} as const;

function fmt(value: number | null | undefined, unit: string) {
  return value !== null && value !== undefined ? `${value} ${unit}` : '-';
}

function fmtNumber(value: number | null | undefined) {
  return value !== null && value !== undefined ? String(value) : '-';
}

function fmtDiff(value: number | null | undefined, unit: string) {
  if (value === null || value === undefined) {
    return null;
  }

  return `${value > 0 ? '+' : ''}${value} ${unit}`;
}

function formatLongDate(value: string) {
  return new Date(value).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function RevisionDetailScreen({ revisionId }: RevisionDetailScreenProps) {
  const { user } = useAuth();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [client, setClient] = useState<Client | null>(null);
  const [clientRevisions, setClientRevisions] = useState<Revision[]>([]);
  const [revision, setRevision] = useState<Revision | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SectionKey | null>(null);
  const [isRevisionMenuOpen, setIsRevisionMenuOpen] = useState(false);
  const [perimeterFormulaInfo, setPerimeterFormulaInfo] = useState<BodyFatFormulaReference | null>(null);
  const [skinfoldFormulaInfo, setSkinfoldFormulaInfo] = useState<BodyFatFormulaReference | null>(null);

  const loadRevision = useCallback(async () => {
    if (!user?.id) {
      setErrorMessage('No se ha podido identificar el usuario autenticado.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const nextRevision = await revisionsService.getById(revisionId);
      setRevision(nextRevision);

      if (nextRevision) {
        const nextClient = await clientsService.getById(nextRevision.clientId, user.id);
        setClient(nextClient);
        const [nextPerimeterFormula, nextSkinfoldFormula] = await Promise.all([
          nextRevision.perimeterFormulaId
            ? bodyFatFormulasService.getById(nextRevision.perimeterFormulaId)
            : bodyFatFormulasService.getByCode(getPerimeterFormulaCodeForSex(nextClient?.sex)),
          nextRevision.skinfoldFormulaId
            ? bodyFatFormulasService.getById(nextRevision.skinfoldFormulaId)
            : Promise.resolve(null),
        ]);
        setPerimeterFormulaInfo(nextPerimeterFormula);
        setSkinfoldFormulaInfo(nextSkinfoldFormula);
        const nextRevisions = await revisionsService.listByClient(nextRevision.clientId);
        setClientRevisions(nextRevisions);
      } else {
        setClient(null);
        setClientRevisions([]);
        setPerimeterFormulaInfo(null);
        setSkinfoldFormulaInfo(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cargar la revision.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [revisionId, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadRevision();
    }, [loadRevision])
  );

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

    setIsRevisionMenuOpen(false);

    Alert.alert('Eliminar revision', 'Esta accion no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          void confirmDelete();
        },
      },
    ]);
  }

  const columns = width >= 380 ? 2 : 1;

  const perimeterCalculation = useMemo(() => {
    if (!revision || (client?.sex !== 'female' && client?.sex !== 'male')) {
      return null;
    }

    return calculateBodyFatFromPerimeters(client.sex, {
      neckCm: revision.neckCm,
      bellyCm: revision.bellyCm,
      gluteCm: revision.gluteCm,
      heightCm: client.heightCm,
    });
  }, [client?.heightCm, client?.sex, revision]);

  const skinfoldCalculation = useMemo(() => {
    if (!revision || (client?.sex !== 'female' && client?.sex !== 'male')) {
      return null;
    }

    return calculateBodyFatFromSkinfolds(client.sex, client.age, {
      bicepFoldMm: revision.bicepFoldMm,
      tricepFoldMm: revision.tricepFoldMm,
      subscapularFoldMm: revision.subscapularFoldMm,
      suprailiacFoldMm: revision.suprailiacFoldMm,
      abdominalFoldMm: revision.abdominalFoldMm,
      frontThighFoldMm: revision.frontThighFoldMm,
      calfFoldMm: revision.calfFoldMm,
    });
  }, [client?.age, client?.sex, revision]);

  const bodyFatAverage = useMemo(() => {
    if (!revision) {
      return null;
    }

    return calculateBodyFatAverage({
      visualBodyFatPct: revision.bodyFatVisualPct,
      skinfoldBodyFatPct: skinfoldCalculation?.bodyFatPct ?? null,
      perimeterBodyFatPct: perimeterCalculation?.bodyFatPct ?? null,
    });
  }, [perimeterCalculation?.bodyFatPct, revision, skinfoldCalculation?.bodyFatPct]);
  const currentAverageSignature = useMemo(
    () => buildBodyFatAverageSignature({
      visualBodyFatPct: revision?.bodyFatVisualPct,
      perimeterBodyFatPct: perimeterCalculation?.bodyFatPct ?? null,
      perimeterFormulaId: revision?.perimeterFormulaId ?? null,
      skinfoldBodyFatPct: skinfoldCalculation?.bodyFatPct ?? null,
      skinfoldFormulaId: revision?.skinfoldFormulaId ?? null,
    }),
    [
      perimeterCalculation?.bodyFatPct,
      revision?.bodyFatVisualPct,
      revision?.perimeterFormulaId,
      revision?.skinfoldFormulaId,
      skinfoldCalculation?.bodyFatPct,
    ]
  );
  const previousComparableAverageRevision = useMemo(() => {
    if (!client) {
      return null;
    }

    return findPreviousComparableRevisionByAverageSignature(
      clientRevisions,
      revision?.id,
      currentAverageSignature,
      (candidateRevision) => buildRevisionBodyFatAverageSignature(client, candidateRevision)
    );
  }, [client, clientRevisions, currentAverageSignature, revision?.id]);

  const previousBodyFatAverage = useMemo(() => {
    if (!previousComparableAverageRevision) {
      return null;
    }

    return calculateBodyFatAverage({
      visualBodyFatPct: previousComparableAverageRevision.bodyFatVisualPct,
      skinfoldBodyFatPct:
        calculateBodyFatFromSkinfolds(client?.sex, client?.age, {
          bicepFoldMm: previousComparableAverageRevision.bicepFoldMm,
          tricepFoldMm: previousComparableAverageRevision.tricepFoldMm,
          subscapularFoldMm: previousComparableAverageRevision.subscapularFoldMm,
          suprailiacFoldMm: previousComparableAverageRevision.suprailiacFoldMm,
          abdominalFoldMm: previousComparableAverageRevision.abdominalFoldMm,
          frontThighFoldMm: previousComparableAverageRevision.frontThighFoldMm,
          calfFoldMm: previousComparableAverageRevision.calfFoldMm,
        })?.bodyFatPct ?? null,
      perimeterBodyFatPct:
        calculateBodyFatFromPerimeters(client?.sex, {
          neckCm: previousComparableAverageRevision.neckCm,
          bellyCm: previousComparableAverageRevision.bellyCm,
          gluteCm: previousComparableAverageRevision.gluteCm,
          heightCm: client?.heightCm,
        })?.bodyFatPct ?? null,
    });
  }, [client?.age, client?.heightCm, client?.sex, previousComparableAverageRevision]);

  const perimeterFormulaContent = useMemo(
    () => buildBodyFatFormulaInfoContent(perimeterFormulaInfo?.code, { sex: client?.sex, age: client?.age }),
    [client?.age, client?.sex, perimeterFormulaInfo?.code]
  );
  const skinfoldFormulaContent = useMemo(
    () => buildBodyFatFormulaInfoContent(skinfoldFormulaInfo?.code, { sex: client?.sex, age: client?.age }),
    [client?.age, client?.sex, skinfoldFormulaInfo?.code]
  );

  const bodyFatAverageDiff =
    bodyFatAverage && previousBodyFatAverage
      ? bodyFatAverage.roundedBodyFatPct - previousBodyFatAverage.roundedBodyFatPct
      : null;
  const selectedActivityOption = findActivityFactorOption(revision?.activityFactor ?? null);
  const overviewCards = useMemo<DetailItem[]>(() => {
    if (!revision) return [];

    return [
      {
        label: 'Peso',
        value: fmt(revision.weightKg, 'kg'),
        delta: fmtDiff(revision.weightDiffKg, 'kg'),
      },
      {
        label: 'Media final',
        value: bodyFatAverage ? `${bodyFatAverage.roundedBodyFatPct}%` : 'No disponible',
        delta:
          bodyFatAverageDiff !== null
            ? fmtDiff(bodyFatAverageDiff, '%')
            : bodyFatAverage
              ? 'Sin referencia homogénea'
              : null,
      },
      {
        label: 'IMC',
        value: fmtNumber(revision.bmi),
      },
      {
        label: 'Fase',
        value: formatRevisionPhase(revision.phase),
      },
    ];
  }, [bodyFatAverage, bodyFatAverageDiff, revision]);

  const summaryStats = useMemo<DetailItem[]>(() => {
    if (!revision) return [];

    const metrics: DetailItem[] = [];

    metrics.push({
      label: 'Grasa visual',
      value: revision.bodyFatVisualPct !== null && revision.bodyFatVisualPct !== undefined
        ? `${Math.round(revision.bodyFatVisualPct)}%`
        : 'No disponible',
    });

    if (selectedActivityOption && revision.activityFactor !== null && revision.activityFactor !== undefined) {
      metrics.push({
        label: 'Frecuencia de actividad',
        value: selectedActivityOption.description,
      });

      metrics.push({
        label: 'Referencia FA',
        value: selectedActivityOption.description,
      });
    } else if (revision.activityFactor !== null && revision.activityFactor !== undefined) {
      metrics.push({
        label: 'Frecuencia de actividad',
        value: selectedActivityOption?.description ?? 'No disponible',
      });
    }

    if (client?.sex === 'female' || client?.sex === 'male') {
      if (perimeterFormulaInfo?.shortLabel) {
        metrics.push({
          label: 'Fórmula perímetros',
          value: perimeterFormulaInfo.shortLabel,
        });
      }

      metrics.push({
        label: 'Grasa por perimetros',
        value: perimeterCalculation ? `${perimeterCalculation.roundedBodyFatPct}%` : 'No disponible',
      });

      metrics.push({
        label: 'Grasa por pliegues',
        value: skinfoldCalculation ? `${skinfoldCalculation.roundedBodyFatPct}%` : 'No disponible',
      });

      if (skinfoldFormulaInfo?.shortLabel) {
        metrics.push({
          label: 'Fórmula pliegues',
          value: skinfoldFormulaInfo.shortLabel,
        });
      }
    }

    return [
      ...metrics,
      {
        label: 'Masa grasa',
        value: fmt(revision.fatMassKg, 'kg'),
        delta: fmtDiff(revision.fatMassDiffKg, 'kg'),
      },
      {
        label: 'Masa libre',
        value: fmt(revision.leanMassKg, 'kg'),
        delta: fmtDiff(revision.leanMassDiffKg, 'kg'),
      },
    ];
  }, [
    client?.sex,
    perimeterCalculation,
    perimeterFormulaInfo?.shortLabel,
    revision,
    selectedActivityOption,
    skinfoldCalculation,
    skinfoldFormulaInfo?.shortLabel,
  ]);

  const perimeterFieldGroups = useMemo(() => getPerimeterFieldKeysForSex(client?.sex), [client?.sex]);
  const perimeterValueByKey = useMemo(() => {
    if (!revision) {
      return null;
    }

    return {
      neckCm: fmt(revision.neckCm, 'cm'),
      armCm: fmt(revision.armCm, 'cm'),
      waistCm: fmt(revision.waistCm, 'cm'),
      bellyCm: fmt(revision.bellyCm, 'cm'),
      pelvisCm: fmt(revision.pelvisCm, 'cm'),
      gluteCm: fmt(revision.gluteCm, 'cm'),
      thighCm: fmt(revision.thighCm, 'cm'),
    };
  }, [revision]);
  const perimeterRequiredItems = useMemo<DetailItem[]>(() => {
    if (!perimeterValueByKey) {
      return [];
    }

    return perimeterFieldGroups.required.map((key) => ({
      label: PERIMETER_LABEL_BY_KEY[key],
      value: perimeterValueByKey[key],
    }));
  }, [perimeterFieldGroups.required, perimeterValueByKey]);
  const perimeterOptionalItems = useMemo<DetailItem[]>(() => {
    if (!perimeterValueByKey) {
      return [];
    }

    return perimeterFieldGroups.optional.map((key) => ({
      label: PERIMETER_LABEL_BY_KEY[key],
      value: perimeterValueByKey[key],
    }));
  }, [perimeterFieldGroups.optional, perimeterValueByKey]);

  const skinfoldItems = useMemo<DetailItem[]>(() => {
    if (!revision) return [];

    return [
      { label: 'Bíceps', value: fmt(revision.bicepFoldMm, 'mm') },
      { label: 'Tricipital', value: fmt(revision.tricepFoldMm, 'mm') },
      { label: 'Subescapular', value: fmt(revision.subscapularFoldMm, 'mm') },
      { label: 'Suprailiaco', value: fmt(revision.suprailiacFoldMm, 'mm') },
    ];
  }, [revision]);

  const notesValue = revision?.notes?.trim() ? revision.notes : 'Sin notas registradas.';

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

  function renderTechnicalGrid(items: DetailItem[], tone: 'primary' | 'secondary' = 'primary') {
    const isSecondary = tone === 'secondary';

    return (
      <View style={[styles.technicalList, { borderColor: theme.backgroundSelected }]}>
        {items.map((item, index) => {
          const isLastItem = index === items.length - 1;
          const isPairEnd = index % 2 === 1 || isLastItem;

          return (
            <View
              key={item.label}
              style={[
                styles.technicalRow,
                isSecondary && styles.technicalRowSecondary,
                !isPairEnd && styles.technicalRowDivider,
                columns === 2 ? styles.technicalRowTwoCol : styles.technicalRowSingle,
              ]}>
              <View style={styles.technicalLabelCell}>
                <ThemedText type="small" themeColor="textSecondary" style={[styles.technicalLabelText, isSecondary && styles.technicalLabelTextSecondary]}>
                  {item.label}
                </ThemedText>
              </View>
              <View style={styles.technicalValueCell}>
                <ThemedText type="smallBold" style={[styles.technicalValueText, isSecondary && styles.technicalValueTextSecondary]}>
                  {item.value}
                </ThemedText>
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  function renderSectionCard(
    sectionKey: SectionKey,
    eyebrow: string,
    title: string,
    count: string,
    children: React.ReactNode
  ) {
    const isOpen = activeSection === sectionKey;

    return (
      <View style={[styles.sheetSection, { borderTopColor: theme.backgroundSelected }]}>
        <Pressable
          onPress={() => setActiveSection((currentSection) => (currentSection === sectionKey ? null : sectionKey))}
          style={styles.sectionToggle}>
          <View style={styles.sectionHeaderCopy}>
            <ThemedText type="label" style={styles.sectionEyebrow}>{eyebrow}</ThemedText>
            <ThemedText type="smallBold" style={styles.sectionTitle}>{title}</ThemedText>
          </View>
          <View style={styles.sectionToggleMeta}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.sectionCountText}>{count}</ThemedText>
            <ThemedText type="smallBold" style={styles.sectionChevron}>{isOpen ? '−' : '+'}</ThemedText>
          </View>
        </Pressable>
        {isOpen ? <View style={styles.sectionBody}>{children}</View> : null}
      </View>
    );
  }

  function renderPerimeterFormulaHeader() {
    if (!perimeterFormulaInfo) {
      return null;
    }

    return (
      <View style={[styles.formulaHeaderRow, { borderColor: theme.backgroundSelected }]}>
        <View style={styles.formulaHeaderCopy}>
          <View style={styles.formulaHeaderEyebrowPill}>
            <ThemedText type="smallBold" style={styles.formulaHeaderEyebrowText}>Formula activa</ThemedText>
          </View>
          <ThemedText type="smallBold" style={styles.formulaTitle}>{perimeterFormulaInfo.title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.formulaHint}>
            Se calcula con las medidas clave según el sexo del cliente.
          </ThemedText>
        </View>
        <FormulaInfoButton
          title={perimeterFormulaInfo.title}
          descriptionLines={perimeterFormulaInfo.descriptionLines}
          content={perimeterFormulaContent}
          accessibilityLabel="Información sobre la fórmula de perímetros"
        />
      </View>
    );
  }

  function renderSkinfoldFormulaHeader() {
    if (!skinfoldFormulaInfo) {
      return null;
    }

    return (
      <View style={[styles.formulaHeaderRow, { borderColor: theme.backgroundSelected }]}>
        <View style={styles.formulaHeaderCopy}>
          <View style={styles.formulaHeaderEyebrowPill}>
            <ThemedText type="smallBold" style={styles.formulaHeaderEyebrowText}>Formula activa</ThemedText>
          </View>
          <ThemedText type="smallBold" style={styles.formulaTitle}>{skinfoldFormulaInfo.title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.formulaHint}>
            Usa bíceps, tríceps, subescapular y suprailiaco con constantes por sexo y edad.
          </ThemedText>
        </View>
        <FormulaInfoButton
          title={skinfoldFormulaInfo.title}
          descriptionLines={skinfoldFormulaInfo.descriptionLines}
          content={skinfoldFormulaContent}
          accessibilityLabel="Información sobre la fórmula de pliegues"
        />
      </View>
    );
  }

  return (
    <ScreenContainer contentStyle={styles.screenContent}>
      <View style={[styles.heroCard, { borderColor: theme.backgroundSelected }]}>
        <View style={styles.heroTopRow}>
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Volver"
            style={({ pressed }) => [
              styles.backButton,
              {
                borderColor: theme.backgroundSelected,
                backgroundColor: pressed ? '#F6F9FE' : '#FFFFFF',
                opacity: pressed ? 0.92 : 1,
              },
            ]}>
            <ThemedText type="smallBold" style={styles.backButtonIcon}>←</ThemedText>
            <ThemedText type="smallBold" style={styles.backButtonText}>Volver</ThemedText>
          </Pressable>

          <Pressable
            onPress={() => setIsRevisionMenuOpen(true)}
            accessibilityLabel="Acciones de revision"
            style={({ pressed }) => [
              styles.menuButton,
              {
                borderColor: theme.backgroundSelected,
                backgroundColor: pressed ? '#F6F9FE' : '#FFFFFF',
                opacity: pressed ? 0.92 : 1,
              },
            ]}>
            <ThemedText type="headline" style={styles.menuDots}>⋯</ThemedText>
          </Pressable>
        </View>

        <View style={styles.heroCopy}>
          <ThemedText type="label" style={styles.heroEyebrow}>Detalle de revision</ThemedText>
          {client?.name ? (
            <ThemedText type="headline" style={styles.clientTitle}>
              {client.name}
            </ThemedText>
          ) : null}
          <ThemedText type="small" themeColor="textSecondary" style={styles.heroDate}>
            {formatLongDate(revision.reviewedAt)}
          </ThemedText>
        </View>

        <View style={styles.heroMetricsRow}>
          {overviewCards.map((item) => (
            <View
              key={item.label}
              style={[
                styles.heroMetricCard,
                styles.heroMetricCardSecondary,
                { borderColor: theme.backgroundSelected },
              ]}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.heroMetricLabel}>
                {item.label}
              </ThemedText>
              <ThemedText type="smallBold" style={styles.heroMetricValue}>
                {item.value}
              </ThemedText>
              {item.delta ? (
                <ThemedText type="small" style={styles.heroMetricDelta}>
                  {item.delta}
                </ThemedText>
              ) : (
                <View style={styles.heroMetricSpacer} />
              )}
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.detailSheet, { borderColor: theme.backgroundSelected }]}>
        {renderSectionCard(
          'summary',
          'Resumen',
          'Metricas secundarias',
          `${summaryStats.length}`,
          <View style={styles.summaryList}>
            {summaryStats.map((item, index) => (
              <View
                key={item.label}
                style={[
                  styles.summaryRow,
                  index !== summaryStats.length - 1 && styles.summaryRowDivider,
                ]}>
                <View style={styles.summaryRowCopy}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.summaryLabel}>
                    {item.label}
                  </ThemedText>
                  {item.delta ? (
                    <ThemedText type="small" style={styles.summaryDelta}>
                      {item.delta}
                    </ThemedText>
                  ) : null}
                </View>
                <ThemedText type="smallBold" style={styles.summaryValue}>
                  {item.value}
                </ThemedText>
              </View>
            ))}
          </View>
        )}

        {renderSectionCard(
          'perimeters',
          'Perimetros',
          'Medidas corporales',
          `${perimeterRequiredItems.length + perimeterOptionalItems.length}`,
          <View style={styles.perimeterSectionBody}>
            {renderPerimeterFormulaHeader()}
            <View style={[styles.measureGroup, styles.measureGroupPrimary, { borderColor: theme.backgroundSelected }]}>
              <View style={styles.measureGroupHeader}>
                <View style={styles.measureGroupHeaderCopy}>
                  <ThemedText type="smallBold" style={styles.measureGroupTitle}>Usadas en cálculo</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.measureGroupHint}>
                    Medidas que determinan el resultado automático.
                  </ThemedText>
                </View>
                <View style={styles.measureGroupCountPill}>
                  <ThemedText type="smallBold" style={styles.measureGroupCountText}>Clave</ThemedText>
                </View>
              </View>
              {renderTechnicalGrid(perimeterRequiredItems)}
            </View>
            <View style={[styles.measureGroup, styles.measureGroupSecondary, { borderColor: theme.backgroundSelected }]}>
              <View style={styles.measureGroupHeader}>
                <View style={styles.measureGroupHeaderCopy}>
                  <ThemedText type="smallBold" style={[styles.measureGroupTitle, styles.measureGroupTitleSecondary]}>Opcionales</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.measureGroupHint}>
                    Se guardan como contexto y seguimiento adicional.
                  </ThemedText>
                </View>
                <View style={styles.measureGroupSecondaryPill}>
                  <ThemedText type="smallBold" style={styles.measureGroupSecondaryPillText}>Secundario</ThemedText>
                </View>
              </View>
              {renderTechnicalGrid(perimeterOptionalItems, 'secondary')}
            </View>
          </View>
        )}

        {renderSectionCard(
          'skinfolds',
          'Pliegues',
          'Control adiposo',
          `${skinfoldItems.length}`,
          <View style={styles.perimeterSectionBody}>
            {renderSkinfoldFormulaHeader()}
            {renderTechnicalGrid(skinfoldItems)}
          </View>
        )}

        {renderSectionCard(
          'notes',
          'Notas',
          'Observaciones',
          revision.notes?.trim() ? '1' : '0',
          <View style={styles.noteInline}>
            <ThemedText type="default" themeColor="textSecondary" style={styles.noteText}>
              {notesValue}
            </ThemedText>
          </View>
        )}
      </View>

      <Modal transparent visible={isRevisionMenuOpen} animationType="fade" onRequestClose={() => setIsRevisionMenuOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setIsRevisionMenuOpen(false)}>
          <Pressable style={[styles.menuPanel, { borderColor: theme.backgroundSelected }]} onPress={() => null}>
            <AppButton
              label="Editar revision"
              variant="surface"
              size="compact"
              onPress={() => {
                setIsRevisionMenuOpen(false);
                router.push(`/revisions/${revision.id}/edit?clientId=${revision.clientId}`);
              }}
            />
            <AppButton
              label={isDeleting ? 'Eliminando...' : 'Eliminar revision'}
              variant="danger"
              size="compact"
              onPress={handleDelete}
              loading={isDeleting}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    gap: Spacing.two,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: Radius.large,
    backgroundColor: '#FFFFFF',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  backButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backButtonIcon: {
    color: Accent.primary,
  },
  backButtonText: {
    color: Accent.primary,
  },
  heroCopy: {
    gap: 3,
  },
  heroEyebrow: {
    color: Accent.primary,
  },
  clientTitle: {
    fontSize: 24,
    lineHeight: 30,
  },
  heroDate: {
    lineHeight: 18,
  },
  heroMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  heroMetricCard: {
    borderRadius: Radius.large,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 2,
    backgroundColor: '#F9FBFF',
  },
  heroMetricCardPrimary: {
    width: '100%',
    backgroundColor: '#EEF4FF',
  },
  heroMetricCardSecondary: {
    width: '48.8%',
  },
  heroMetricLabelPrimary: {
    color: '#4A628A',
  },
  heroMetricLabel: {
    color: '#5E6E88',
  },
  heroMetricValue: {
    color: Accent.ink,
  },
  heroMetricDelta: {
    color: Accent.primary,
    lineHeight: 18,
  },
  heroMetricSpacer: {
    height: 18,
  },
  detailSheet: {
    borderWidth: 1,
    borderRadius: Radius.large,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  sheetSection: {
    borderTopWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sectionHeaderCopy: {
    gap: 1,
  },
  sectionEyebrow: {
    color: Accent.primary,
  },
  sectionTitle: {
    color: Accent.ink,
    fontSize: 16,
    lineHeight: 20,
  },
  sectionToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sectionToggleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionCountText: {
    color: '#6A7991',
    fontSize: 12,
    lineHeight: 16,
  },
  sectionChevron: {
    color: '#6C7A92',
    width: 18,
    textAlign: 'center',
  },
  sectionBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 2,
  },
  perimeterSectionBody: {
    gap: Spacing.two,
  },
  formulaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.medium,
    backgroundColor: '#F8FBFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  formulaHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  formulaHeaderEyebrowPill: {
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    backgroundColor: '#EEF4FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  formulaHeaderEyebrowText: {
    color: Accent.primary,
    fontSize: 11,
    lineHeight: 14,
  },
  formulaTitle: {
    color: Accent.ink,
  },
  formulaHint: {
    lineHeight: 18,
  },
  measureGroup: {
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.medium,
    padding: 10,
  },
  measureGroupPrimary: {
    backgroundColor: '#FCFDFF',
  },
  measureGroupSecondary: {
    backgroundColor: '#F7F9FC',
  },
  measureGroupHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  measureGroupHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  measureGroupTitle: {
    color: Accent.ink,
  },
  measureGroupTitleSecondary: {
    color: '#50627E',
  },
  measureGroupHint: {
    lineHeight: 18,
  },
  measureGroupCountPill: {
    borderRadius: Radius.pill,
    backgroundColor: '#EEF4FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  measureGroupCountText: {
    color: Accent.primary,
    fontSize: 11,
    lineHeight: 14,
  },
  measureGroupSecondaryPill: {
    borderRadius: Radius.pill,
    backgroundColor: '#EEF2F8',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  measureGroupSecondaryPillText: {
    color: '#5C6B86',
    fontSize: 11,
    lineHeight: 14,
  },
  summaryList: {
    backgroundColor: '#FFFFFF',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: 10,
  },
  summaryRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2FB',
  },
  summaryRowCopy: {
    flex: 1,
    gap: 2,
  },
  summaryLabel: {
    lineHeight: 18,
  },
  summaryValue: {
    color: Accent.ink,
  },
  summaryDelta: {
    color: Accent.primary,
    lineHeight: 18,
  },
  technicalList: {
    borderTopWidth: 0,
    borderWidth: 0,
    backgroundColor: '#FFFFFF',
  },
  technicalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingVertical: 10,
    gap: Spacing.two,
  },
  technicalRowSecondary: {
    opacity: 0.72,
  },
  technicalRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2FB',
  },
  technicalRowTwoCol: {
    minHeight: 48,
  },
  technicalRowSingle: {
    minHeight: 48,
  },
  technicalLabelCell: {
    flex: 1,
  },
  technicalValueCell: {
    alignItems: 'flex-end',
  },
  technicalLabelText: {
    lineHeight: 18,
  },
  technicalLabelTextSecondary: {
    color: '#667792',
  },
  technicalValueText: {
    color: Accent.ink,
    textAlign: 'right',
  },
  technicalValueTextSecondary: {
    color: '#50627E',
  },
  noteInline: {
    paddingVertical: 2,
  },
  noteText: {
    lineHeight: 22,
  },
  menuButton: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  menuDots: {
    color: '#10203B',
    lineHeight: 24,
    marginTop: -2,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 32, 59, 0.16)',
    paddingHorizontal: Spacing.three,
    paddingTop: 96,
  },
  menuPanel: {
    alignSelf: 'flex-end',
    width: 220,
    borderWidth: 1,
    borderRadius: Radius.large,
    backgroundColor: '#FFFFFF',
    padding: Spacing.two,
    gap: Spacing.two,
  },
});