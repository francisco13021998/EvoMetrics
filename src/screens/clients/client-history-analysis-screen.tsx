import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { EmptyState } from '@/components/feedback/empty-state';
import { StatusBanner } from '@/components/feedback/status-banner';
import { AppButton } from '@/components/forms/app-button';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { ScreenContainer } from '@/components/layout/screen-container';
import { HistoryLineChart } from '@/components/surface/history-line-chart';
import { ThemedText } from '@/components/themed-text';
import { Accent, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { clientsService } from '@/services/clients';
import { revisionsService } from '@/services/revisions';
import { Client } from '@/types/domain';
import {
    AnalysisMetricDefinition,
    SECONDARY_ANALYSIS_METRICS,
    SECONDARY_METRIC_GROUPS,
    SECONDARY_PRIMARY_METRIC_KEYS,
} from '@/utils/analysis-metrics';
import {
    type HistoricalComparisonMode,
    HistoricalRevisionMetrics,
    buildHistoricalRevisionMetrics,
    resolveHistoricalMetricComparison,
} from '@/utils/client-history';
import { buildRevisionBodyFatAverageSignature } from '@/utils/revision-comparisons';

type ClientHistoryAnalysisScreenProps = {
  clientId: string;
};

type TrendDirection = 'decrease-better' | 'increase-better' | 'neutral';
type MetricUnit = 'kg' | 'pct' | 'cm' | 'mm' | 'bmi';

type MetricConfig = {
  key: string;
  label: string;
  unit: MetricUnit;
  direction: TrendDirection;
  comparisonMode: HistoricalComparisonMode;
  accessor: (revision: HistoricalRevisionMetrics | null) => number | null;
};

type ChartMetricConfig = MetricConfig & {
  strokeColor: string;
};

type SecondaryMetricProgressRow = {
  metric: AnalysisMetricDefinition;
  latestRevision: HistoricalRevisionMetrics;
  latestValue: number;
  firstRevision: HistoricalRevisionMetrics;
  firstValue: number;
  totalDelta: number;
};

type SecondaryGroupId = (typeof SECONDARY_METRIC_GROUPS)[number]['id'];


const SUMMARY_METRICS: MetricConfig[] = [
  {
    key: 'bodyFatAveragePct',
    label: '% grasa medio',
    unit: 'pct',
    direction: 'decrease-better',
    comparisonMode: 'history-start',
    accessor: (revision) => revision?.bodyFatAveragePct ?? null,
  },
  {
    key: 'weightKg',
    label: 'Peso',
    unit: 'kg',
    direction: 'neutral',
    comparisonMode: 'history-start',
    accessor: (revision) => revision?.weightKg ?? null,
  },
  {
    key: 'fatMassKg',
    label: 'Masa grasa',
    unit: 'kg',
    direction: 'decrease-better',
    comparisonMode: 'history-start',
    accessor: (revision) => revision?.fatMassKg ?? null,
  },
  {
    key: 'leanMassKg',
    label: 'Masa libre',
    unit: 'kg',
    direction: 'increase-better',
    comparisonMode: 'history-start',
    accessor: (revision) => revision?.leanMassKg ?? null,
  },
];

const CHART_METRICS: ChartMetricConfig[] = [
  {
    key: 'weightKg',
    label: 'Peso',
    unit: 'kg',
    direction: 'neutral',
    comparisonMode: 'visible',
    accessor: (revision) => revision?.weightKg ?? null,
    strokeColor: Accent.primary,
  },
  {
    key: 'bodyFatAveragePct',
    label: '% grasa medio',
    unit: 'pct',
    direction: 'decrease-better',
    comparisonMode: 'average-homogeneous',
    accessor: (revision) => revision?.bodyFatAveragePct ?? null,
    strokeColor: '#2F7CF6',
  },
  {
    key: 'fatMassKg',
    label: 'Masa grasa',
    unit: 'kg',
    direction: 'decrease-better',
    comparisonMode: 'visible',
    accessor: (revision) => revision?.fatMassKg ?? null,
    strokeColor: '#DC5B5B',
  },
  {
    key: 'leanMassKg',
    label: 'Masa libre',
    unit: 'kg',
    direction: 'increase-better',
    comparisonMode: 'visible',
    accessor: (revision) => revision?.leanMassKg ?? null,
    strokeColor: Accent.success,
  },
];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('es-ES');
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
  });
}

function formatMetricValue(value: number | null, unit: MetricUnit) {
  if (value === null) {
    return '—';
  }

  const formattedValue = value.toLocaleString('es-ES', {
    minimumFractionDigits: unit === 'mm' ? 0 : 1,
    maximumFractionDigits: unit === 'mm' ? 0 : 1,
  });

  if (unit === 'pct') {
    return `${formattedValue}%`;
  }

  if (unit === 'bmi') {
    return formattedValue;
  }

  return `${formattedValue} ${unit}`;
}

function formatDeltaValue(value: number | null, unit: MetricUnit, emptyLabel = 'Sin referencia') {
  if (value === null) {
    return emptyLabel;
  }

  if (value === 0) {
    return unit === 'pct' ? '0.0%' : unit === 'bmi' ? '0.0' : `0.0 ${unit}`;
  }

  const sign = value > 0 ? '+' : '';
  return `${sign}${formatMetricValue(value, unit)}`;
}

function getDeltaTone(delta: number | null, direction: TrendDirection) {
  if (delta === null || delta === 0) {
    return { color: '#5C6B86' };
  }

  if (direction === 'neutral') {
    return { color: Accent.primary };
  }

  const favorable = direction === 'decrease-better' ? delta < 0 : delta > 0;
  return { color: favorable ? Accent.success : Accent.danger };
}

export function ClientHistoryAnalysisScreen({ clientId }: ClientHistoryAnalysisScreenProps) {
  const { user, userRole } = useAuth();
  const isAthlete = userRole === 'athlete';
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [client, setClient] = useState<Client | null>(null);
  const currentClient = client as Client;
  const [historicalRevisions, setHistoricalRevisions] = useState<HistoricalRevisionMetrics[]>([]);
  const [isSecondaryExpanded, setIsSecondaryExpanded] = useState(false);
  const [expandedSecondaryGroups, setExpandedSecondaryGroups] = useState<Record<SecondaryGroupId, boolean>>({
    'body-fat-measurements': false,
    skinfolds: false,
    perimeters: false,
  });
  const [isBodyFatWarningOpen, setIsBodyFatWarningOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isWide = width >= 960;
  const isMedium = width >= 720;
  const summaryCardWidth = isMedium ? '48.6%' : '48.2%';
  const screenContentWidth = Math.min(width, MaxContentWidth) - (Spacing.four * 2);
  const chartSectionInnerWidth = screenContentWidth - 28;
  const chartCardWidth = isWide
    ? Math.max(((chartSectionInnerWidth - Spacing.two) / 2) - 28, 260)
    : Math.max(chartSectionInnerWidth - 28, 220);

  const loadContent = useCallback(async () => {
    if (!user?.id) {
      setClient(null);
      setHistoricalRevisions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const nextClient = isAthlete
        ? await clientsService.getByIdForViewer(clientId)
        : await clientsService.getById(clientId, user.id!);
      setClient(nextClient);

      if (!nextClient) {
        setHistoricalRevisions([]);
        return;
      }

      const revisions = await revisionsService.listByClient(nextClient.id);
      setHistoricalRevisions(buildHistoricalRevisionMetrics(nextClient, revisions));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cargar el análisis histórico.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [clientId, user?.id]);

  useEffect(() => {
    void loadContent();
  }, [loadContent]);

  const currentRevision = historicalRevisions[0] ?? null;
  const latestRevision = historicalRevisions[0] ?? null;
  const chartSeries = useMemo(() => historicalRevisions.slice().reverse(), [historicalRevisions]);
  const secondaryRows = useMemo<SecondaryMetricProgressRow[]>(() => {
    return SECONDARY_ANALYSIS_METRICS.flatMap((metric) => {
      const metricHistory = historicalRevisions
        .map((revision) => ({ revision, value: metric.accessor(revision) }))
        .filter((entry): entry is { revision: HistoricalRevisionMetrics; value: number } => entry.value !== null);

      if (metricHistory.length === 0) {
        return [];
      }

      const latestEntry = metricHistory[0];
      const firstEntry = metricHistory[metricHistory.length - 1];

      return [{
        metric,
        latestRevision: latestEntry.revision,
        latestValue: latestEntry.value,
        firstRevision: firstEntry.revision,
        firstValue: firstEntry.value,
        totalDelta: latestEntry.value - firstEntry.value,
      }];
    });
  }, [historicalRevisions]);
  const secondaryRowsByKey = useMemo(
    () => new Map(secondaryRows.map((row) => [row.metric.key, row])),
    [secondaryRows]
  );
  const hasMixedBodyFatAverageMethods = useMemo(() => {
    if (!client) {
      return false;
    }

    const signatures = historicalRevisions
      .map((revision) => buildRevisionBodyFatAverageSignature(client, revision.revision))
      .filter((signature): signature is string => Boolean(signature));

    return new Set(signatures).size > 1;
  }, [client, historicalRevisions]);

  function renderSecondaryMetricRows(metricKeys: readonly string[]) {
    const rows = metricKeys
      .map((metricKey) => secondaryRowsByKey.get(metricKey))
      .filter((row): row is SecondaryMetricProgressRow => Boolean(row));

    if (rows.length === 0) {
      return null;
    }

    return (
      <View style={styles.secondaryMetricsWrap}>
        {rows.map((row, index) => {
          const tone = getDeltaTone(row.totalDelta, row.metric.direction);
          const progressSymbol = row.totalDelta === 0 ? '•' : row.totalDelta > 0 ? '▲' : '▼';

          return (
            <Pressable
              key={row.metric.key}
              onPress={() => router.push(`/clients/${currentClient.id}/metrics/${row.metric.key}`)}
              style={({ pressed }) => [
                styles.secondaryMetricRow,
                {
                  borderTopColor: theme.backgroundSelected,
                  borderTopWidth: index === 0 ? 0 : 1,
                  backgroundColor: pressed ? '#F6FAFF' : '#FAFCFF',
                },
              ]}>
              <View style={styles.secondaryMetricLeft}>
                <ThemedText type="smallBold" style={styles.secondaryMetricLabel}>{row.metric.label}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Último: {formatDate(row.latestRevision.reviewedAt)}
                </ThemedText>
              </View>
              <View style={styles.secondaryMetricRight}>
                <ThemedText type="smallBold">{formatMetricValue(row.latestValue, row.metric.unit)}</ThemedText>
                <View style={styles.secondaryProgressRow}>
                  <View style={[styles.secondaryProgressIndicator, { backgroundColor: tone.color }]}>
                    <ThemedText type="smallBold" style={styles.secondaryProgressSymbol}>{progressSymbol}</ThemedText>
                  </View>
                  <ThemedText type="smallBold" style={{ color: tone.color }}>
                    {formatDeltaValue(row.totalDelta, row.metric.unit, '0')}
                  </ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  Desde {formatDate(row.firstRevision.reviewedAt)}
                </ThemedText>
              </View>
            </Pressable>
          );
        })}
      </View>
    );
  }

  if (isLoading) {
    return (
      <ScreenContainer>
        <PageHeader title="Analizando..." />
        <PageSection first>
          <StatusBanner tone="info" loading message="Preparando análisis histórico..." />
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
          <AppButton label="Reintentar" onPress={() => void loadContent()} variant="secondary" />
        </PageSection>
      </ScreenContainer>
    );
  }

  if (!client) {
    return (
      <ScreenContainer>
        <EmptyState
          title="Cliente no encontrado"
          description="No se ha podido acceder a este cliente para construir el análisis histórico."
          actionLabel="Volver a clientes"
          onAction={() => router.replace('/clients')}
        />
      </ScreenContainer>
    );
  }

  if (historicalRevisions.length === 0) {
    return (
      <ScreenContainer contentStyle={styles.screenContent}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            style={({ pressed }) => [
              styles.backButton,
              {
                borderColor: theme.backgroundSelected,
                backgroundColor: pressed ? '#EFF5FF' : '#FFFFFF',
                opacity: pressed ? 0.92 : 1,
              },
            ]}>
            <Ionicons name="chevron-back" size={18} color={Accent.primary} />
            <ThemedText type="smallBold" style={styles.backButtonText}>Volver</ThemedText>
          </Pressable>
        </View>
        <View style={[styles.emptyAnalysisCard, { borderColor: theme.backgroundSelected }]}>
          <View style={styles.headerIconWrap}>
            <Ionicons name="analytics-outline" size={26} color={Accent.primary} />
          </View>
          <ThemedText type="label" style={styles.headerEyebrow}>Cliente: {client.name}</ThemedText>
          <ThemedText type="headline" style={styles.headerTitle}>Análisis histórico</ThemedText>
          <EmptyState
            title="Todavía no hay revisiones para analizar"
            description="Cuando registres la primera revisión aparecerán aquí el resumen, las gráficas y la comparativa histórica del cliente."
            actionLabel="Crear primera revisión"
            onAction={() => router.push(`/revisions/new?clientId=${client.id}`)}
          />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer contentStyle={styles.screenContent}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={({ pressed }) => [
            styles.backButton,
            {
              borderColor: theme.backgroundSelected,
              backgroundColor: pressed ? '#EFF5FF' : '#FFFFFF',
              opacity: pressed ? 0.92 : 1,
            },
          ]}>
          <Ionicons name="chevron-back" size={18} color={Accent.primary} />
          <ThemedText type="smallBold" style={styles.backButtonText}>Volver</ThemedText>
        </Pressable>
      </View>

      <View style={[styles.headerCard, { borderColor: theme.backgroundSelected }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerIconWrap}>
            <Ionicons name="analytics-outline" size={26} color={Accent.primary} />
          </View>
          <View style={styles.headerCopy}>
            <ThemedText type="label" style={styles.headerEyebrow}>Análisis</ThemedText>
            <ThemedText type="headline" style={styles.headerTitle}>Evolución histórica</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.headerSubtitle}>
              {client.name} · {historicalRevisions.length} revisiones registradas
            </ThemedText>
          </View>
        </View>

      </View>


      <View style={[styles.analysisSection, { borderColor: theme.backgroundSelected }]}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconWrap}>
            <Ionicons name="speedometer-outline" size={18} color={Accent.primary} />
          </View>
          <View style={styles.sectionCopy}>
            <ThemedText type="label" style={styles.sectionEyebrow}>Resumen</ThemedText>
            <ThemedText type="headline" style={styles.sectionTitle}>Indicadores principales</ThemedText>
          </View>
        </View>
        <View style={styles.summaryGridCompact}>
          {SUMMARY_METRICS.map((metric) => {
            const comparison = resolveHistoricalMetricComparison({
              client,
              history: historicalRevisions,
              currentRevision: historicalRevisions[0] ?? currentRevision,
              mode: metric.comparisonMode,
              accessor: metric.accessor,
            });
            const tone = getDeltaTone(comparison.delta, metric.direction);

            return (
              <View
                key={metric.key}
                style={[
                  styles.summaryCardCompact,
                  { width: summaryCardWidth, borderColor: theme.backgroundSelected },
                ]}>
                <View style={styles.summaryLabelRow}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {metric.label}
                  </ThemedText>
                  {metric.key === 'bodyFatAveragePct' && hasMixedBodyFatAverageMethods ? (
                    <Pressable
                      accessibilityLabel="Aviso sobre comparación mixta de % grasa medio"
                      accessibilityRole="button"
                      onPress={() => setIsBodyFatWarningOpen(true)}
                      hitSlop={8}
                      style={({ pressed }) => [
                        styles.bodyFatWarningTrigger,
                        {
                          borderColor: pressed ? '#F0B56A' : '#F4C98B',
                          backgroundColor: pressed ? '#FFF1DF' : '#FFF6E8',
                          opacity: pressed ? 0.9 : 1,
                        },
                      ]}>
                      <ThemedText type="smallBold" style={styles.bodyFatWarningTriggerText}>!</ThemedText>
                    </Pressable>
                  ) : null}
                </View>
                <ThemedText type="headline" style={styles.summaryValue}>{formatMetricValue(comparison.currentValue, metric.unit)}</ThemedText>
                <ThemedText type="smallBold" style={{ color: tone.color }}>
                  {formatDeltaValue(comparison.delta, metric.unit, comparison.missingReferenceLabel)}
                </ThemedText>
              </View>
            );
          })}
        </View>
      </View>

      <View style={[styles.analysisSection, { borderColor: theme.backgroundSelected }]}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconWrap}>
            <Ionicons name="trending-up-outline" size={18} color={Accent.primary} />
          </View>
          <View style={styles.sectionCopy}>
            <ThemedText type="label" style={styles.sectionEyebrow}>Tendencias</ThemedText>
            <ThemedText type="headline" style={styles.sectionTitle}>Evolución visual</ThemedText>
          </View>
        </View>
        <View style={styles.chartsGrid}>
          {CHART_METRICS.map((metric) => {
            const comparison = resolveHistoricalMetricComparison({
              client,
              history: historicalRevisions,
              currentRevision: latestRevision,
              mode: 'history-start',
              accessor: metric.accessor,
            });
            const tone = getDeltaTone(comparison.delta, metric.direction);
            const points = chartSeries.map((revision) => ({
              label: formatDate(revision.reviewedAt),
              shortLabel: formatShortDate(revision.reviewedAt),
              value: metric.accessor(revision),
            }));

            return (
              <HistoryLineChart
                key={metric.key}
                title={metric.label}
                subtitle={points.length > 1 ? `${points.length} revisiones visibles` : 'Añade más revisiones para ver evolución'}
                valueLabel={formatMetricValue(comparison.currentValue, metric.unit)}
                deltaLabel={formatDeltaValue(comparison.delta, metric.unit, comparison.missingReferenceLabel)}
                deltaColor={tone.color}
                strokeColor={metric.strokeColor}
                width={chartCardWidth}
                points={points}
                yUnitSuffix={metric.unit === 'pct' ? '%' : metric.unit === 'bmi' ? '' : ` ${metric.unit}`}
              />
            );
          })}
        </View>
      </View>

      <Modal transparent visible={isBodyFatWarningOpen} animationType="fade" onRequestClose={() => setIsBodyFatWarningOpen(false)}>
        <Pressable style={styles.warningBackdrop} onPress={() => setIsBodyFatWarningOpen(false)}>
          <Pressable style={[styles.warningPanel, { borderColor: theme.backgroundSelected }]} onPress={() => null}>
            <View style={styles.warningHeader}>
              <View style={styles.warningHeaderText}>
                <ThemedText type="smallBold" style={styles.warningTitle}>Comparación entre métodos</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.warningSubtitle}>
                  Las revisiones usan métodos distintos (visual, perímetros o pliegues).
                </ThemedText>
              </View>
              <Pressable
                onPress={() => setIsBodyFatWarningOpen(false)}
                accessibilityLabel="Cerrar aviso"
                style={({ pressed }) => [styles.warningCloseButton, { backgroundColor: pressed ? '#EEF3FB' : '#F8FBFF' }]}>
                <ThemedText type="smallBold" style={styles.warningCloseText}>×</ThemedText>
              </Pressable>
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.warningBody}>
              El % es comparable, pero puede tener menor precisión.
            </ThemedText>
          </Pressable>
        </Pressable>
      </Modal>

      <View style={[styles.secondaryPanel, { borderColor: theme.backgroundSelected }]}>
        <Pressable
          onPress={() => setIsSecondaryExpanded((currentValue) => !currentValue)}
          accessibilityRole="button"
          accessibilityLabel={`${isSecondaryExpanded ? 'Cerrar' : 'Abrir'} lectura secundaria`}
          style={({ pressed }) => [styles.historyToggle, { borderColor: theme.backgroundSelected, opacity: pressed ? 0.92 : 1 }]}>
          <View style={styles.sectionIconWrap}>
            <Ionicons name="list-outline" size={18} color={Accent.primary} />
          </View>
          <View style={styles.sectionCopy}>
            <ThemedText type="label" style={styles.sectionEyebrow}>Detalle</ThemedText>
            <ThemedText type="headline" style={styles.sectionTitle}>Lectura secundaria</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">Último dato disponible y progreso total por métrica</ThemedText>
          </View>
          <Ionicons name={isSecondaryExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={Accent.primary} />
        </Pressable>

        {isSecondaryExpanded ? (
          <>
            <View style={styles.secondarySectionBlock}>
              <ThemedText type="smallBold" style={styles.secondarySectionTitle}>Datos principales</ThemedText>
              {renderSecondaryMetricRows(SECONDARY_PRIMARY_METRIC_KEYS)}
            </View>

            {SECONDARY_METRIC_GROUPS.map((group) => {
              const isOpen = expandedSecondaryGroups[group.id];

              return (
                <View key={group.id} style={styles.secondaryGroupWrap}>
                  <Pressable
                    onPress={() =>
                      setExpandedSecondaryGroups((currentGroups) => ({
                        ...currentGroups,
                        [group.id]: !currentGroups[group.id],
                      }))
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`${isOpen ? 'Cerrar' : 'Abrir'} ${group.title}`}
                    style={({ pressed }) => [styles.historyToggleGroup, { borderColor: theme.backgroundSelected, opacity: pressed ? 0.92 : 1 }]}>
                    <View style={styles.sectionCopy}>
                      <ThemedText type="smallBold">{group.title}</ThemedText>
                    </View>
                    <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={Accent.primary} />
                  </Pressable>
                  {isOpen ? renderSecondaryMetricRows(group.metricKeys) : null}
                </View>
              );
            })}
          </>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    gap: 14,
    paddingTop: 14,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  backButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#DFE7F2',
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
  },
  backButtonText: {
    color: '#10203B',
    lineHeight: 16,
  },
  headerCard: {
    borderWidth: 1,
    borderColor: '#DFE7F2',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 16,
    shadowColor: '#12336E',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerIconWrap: {
    width: 58,
    height: 58,
    borderWidth: 1,
    borderColor: '#D2E0FA',
    borderRadius: 20,
    backgroundColor: '#E8F0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  headerEyebrow: {
    color: Accent.primary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: '#10203B',
    fontSize: 31,
    lineHeight: 36,
  },
  headerSubtitle: {
    lineHeight: 18,
  },
  emptyAnalysisCard: {
    borderWidth: 1,
    borderColor: '#DFE7F2',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 10,
    alignItems: 'flex-start',
  },
  analysisSection: {
    borderWidth: 1,
    borderColor: '#DFE7F2',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF5FF',
  },
  sectionEyebrow: {
    color: Accent.primary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: '#10203B',
    fontSize: 22,
    lineHeight: 27,
  },
  bodyFatWarningTrigger: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bodyFatWarningTriggerText: {
    color: '#A95E12',
    fontSize: 10,
    lineHeight: 12,
  },
  summaryGridCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'space-between',
  },
  summaryCardCompact: {
    borderWidth: 1,
    borderColor: '#DFE7F2',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 6,
    minHeight: 96,
  },
  summaryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  summaryValue: {
    color: '#10203B',
  },
  chartsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  secondaryPanel: {
    borderWidth: 1,
    borderColor: '#DFE7F2',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 12,
  },
  sectionCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  autoSummaryMetaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  warningBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 32, 59, 0.18)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  warningPanel: {
    borderWidth: 1,
    borderRadius: Radius.large,
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 10,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  warningHeaderText: {
    flex: 1,
    gap: 2,
  },
  warningTitle: {
    color: Accent.ink,
  },
  warningSubtitle: {
    lineHeight: 18,
  },
  warningCloseButton: {
    width: 30,
    height: 30,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningCloseText: {
    color: '#5E6E88',
    fontSize: 18,
    lineHeight: 20,
  },
  warningBody: {
    lineHeight: 19,
  },
  secondaryMetricsWrap: {
    borderWidth: 1,
    borderColor: '#E3EBF6',
    borderRadius: Radius.medium,
    overflow: 'hidden',
    backgroundColor: '#FAFCFF',
  },
  secondarySectionBlock: {
    gap: 8,
  },
  secondarySectionTitle: {
    color: '#10203B',
  },
  secondaryGroupWrap: {
    gap: 8,
  },
  secondaryMetricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  secondaryMetricLeft: {
    flex: 1,
    gap: 2,
  },
  secondaryMetricLabel: {
    color: '#10203B',
  },
  secondaryMetricRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  secondaryProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  secondaryProgressIndicator: {
    width: 14,
    height: 14,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryProgressSymbol: {
    color: '#FFFFFF',
    fontSize: 8,
    lineHeight: 10,
  },
  historyToggle: {
    borderWidth: 1,
    borderColor: '#DFE7F2',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  historyToggleGroup: {
    borderWidth: 1,
    borderColor: '#DFE7F2',
    borderRadius: Radius.medium,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: '#F8FBFF',
  },
  historyToggleIcon: {
    color: Accent.primary,
    fontSize: 22,
    lineHeight: 24,
  },
}
);
