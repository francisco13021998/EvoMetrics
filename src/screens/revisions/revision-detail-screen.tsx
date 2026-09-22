import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { EmptyState } from '@/components/feedback/empty-state';
import { StatusBanner } from '@/components/feedback/status-banner';
import { AppButton } from '@/components/forms/app-button';
import { AppDateTimeInput } from '@/components/forms/app-date-time';
import { AppSelect } from '@/components/forms/app-select';
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
import { photosService } from '@/services/photos';
import { revisionsService } from '@/services/revisions';
import { Client, ClientPhoto, Revision } from '@/types/domain';
import { findActivityFactorOption } from '@/utils/activity';
import {
    calculateBodyFatAverage,
    calculateBodyFatFromPerimeters,
    calculateBodyFatFromSkinfolds,
    calculateFatMassDiffKg,
    calculateLeanMassDiffKg,
    calculateWeightDiffKg,
} from '@/utils/calculations';
import { getClientAge } from '@/utils/client-age';
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

type MeasurementValueMap = Record<string, number | null | undefined>;

type SectionKey = 'summary' | 'perimeters' | 'skinfolds' | 'photos' | 'notes';

const PERIMETER_LABEL_BY_KEY = {
  neckCm: 'Cuello',
  armCm: 'Brazo',
  waistCm: 'Cintura',
  bellyCm: 'Abdomen',
  pelvisCm: 'Cadera',
  gluteCm: 'Glúteo',
  thighCm: 'Muslo',
  calfCm: 'Gemelo',
  torsoCm: 'Torso',
} as const;
 
const SKINFOLD_LABEL_BY_KEY = {
  bicepFoldMm: 'Bíceps',
  tricepFoldMm: 'Tricipital',
  subscapularFoldMm: 'Subescapular',
  abdominalFoldMm: 'Abdominal',
  suprailiacFoldMm: 'Suprailiaco',
  frontThighFoldMm: 'Muslo frontal',
  calfFoldMm: 'Pantorrilla',
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

function calculateDiff(currentValue: number | null | undefined, comparisonValue: number | null | undefined) {
  if (!hasMeasuredValue(currentValue) || !hasMeasuredValue(comparisonValue)) {
    return null;
  }

  return Math.round((currentValue - comparisonValue) * 100) / 100;
}

function formatPercentValue(value: number | null | undefined) {
  return value !== null && value !== undefined ? `${value}%` : 'No disponible';
}

function buildMeasurementItem(
  label: string,
  currentValue: number | null | undefined,
  comparisonValue: number | null | undefined,
  unit: 'cm' | 'mm'
): DetailItem | null {
  if (!hasMeasuredValue(currentValue)) {
    return null;
  }

  return {
    label,
    value: fmt(currentValue, unit),
    delta: fmtDiff(calculateDiff(currentValue, comparisonValue), unit),
  };
}

function formatLongDate(value: string) {
  return new Date(value).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatPhotoDate(value: string) {
  return new Date(value).toLocaleDateString('es-ES');
}

function toDateOnlyIso(value: Date) {
  return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0)).toISOString();
}

function parseIsoDateOrNow(value: string | null | undefined) {
  if (!value) {
    return new Date();
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return new Date();
  }

  return parsedDate;
}

function hasMeasuredValue(value: number | null | undefined) {
  return value !== null && value !== undefined;
}

export function RevisionDetailScreen({ revisionId }: RevisionDetailScreenProps) {
  const { user, userRole } = useAuth();
  const isAthlete = userRole === 'athlete';
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [client, setClient] = useState<Client | null>(null);
  const [clientRevisions, setClientRevisions] = useState<Revision[]>([]);
  const [revision, setRevision] = useState<Revision | null>(null);
  const [revisionPhotos, setRevisionPhotos] = useState<ClientPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SectionKey | null>(null);
  const [isRevisionMenuOpen, setIsRevisionMenuOpen] = useState(false);
  const [perimeterFormulaInfo, setPerimeterFormulaInfo] = useState<BodyFatFormulaReference | null>(null);
  const [skinfoldFormulaInfo, setSkinfoldFormulaInfo] = useState<BodyFatFormulaReference | null>(null);
  const [selectedComparisonRevisionId, setSelectedComparisonRevisionId] = useState('');
  const [previewPhoto, setPreviewPhoto] = useState<ClientPhoto | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadCapturedAt, setUploadCapturedAt] = useState<Date | null>(new Date());
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

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
        const nextClient = isAthlete
          ? await clientsService.getByIdForViewer(nextRevision.clientId)
          : await clientsService.getById(nextRevision.clientId, user.id!);
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
        const [nextRevisions, nextRevisionPhotos] = await Promise.all([
          revisionsService.listByClient(nextRevision.clientId),
          isAthlete
            ? photosService.listByRevisionForViewer(nextRevision.id)
            : photosService.listByRevision(nextRevision.id, user.id!),
        ]);
        setClientRevisions(nextRevisions);
        setRevisionPhotos(nextRevisionPhotos);
      } else {
        setClient(null);
        setClientRevisions([]);
        setRevisionPhotos([]);
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

    Alert.alert('Eliminar revisión', 'Esta acción no se puede deshacer.', [
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

  function openUploadModal() {
    setUploadCapturedAt(parseIsoDateOrNow(revision?.reviewedAt));
    setIsUploadModalOpen(true);
  }

  function closeUploadModal() {
    setIsUploadModalOpen(false);
  }

  async function handleUploadPhotoFromRevision() {
    if (!user?.id || !client || !revision || isUploadingPhoto) {
      return;
    }

    if (!uploadCapturedAt) {
      setErrorMessage('Selecciona una fecha para la imagen.');
      return;
    }

    setErrorMessage(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setErrorMessage('Necesitas dar permiso a la galeria para subir imagenes.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      allowsMultipleSelection: true,
      quality: 0.9,
      selectionLimit: 0,
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    setIsUploadingPhoto(true);

    try {
      await photosService.uploadManyFromDevice({
        ownerId: user.id,
        clientId: client.id,
        revisionId: revision.id,
        assets: result.assets,
        capturedAt: toDateOnlyIso(uploadCapturedAt),
      });

      closeUploadModal();
      await loadRevision();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo subir la imagen.';
      setErrorMessage(message);
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  const columns = width >= 380 ? 2 : 1;

  const comparisonRevisions = useMemo(
    () => clientRevisions.filter((candidateRevision) => candidateRevision.id !== revision?.id),
    [clientRevisions, revision?.id]
  );

  const selectedComparisonRevision = useMemo(
    () => comparisonRevisions.find((candidateRevision) => candidateRevision.id === selectedComparisonRevisionId) ?? comparisonRevisions[0] ?? null,
    [comparisonRevisions, selectedComparisonRevisionId]
  );

  useEffect(() => {
    if (comparisonRevisions.length === 0) {
      if (selectedComparisonRevisionId) {
        setSelectedComparisonRevisionId('');
      }
      return;
    }

    if (!comparisonRevisions.some((candidateRevision) => candidateRevision.id === selectedComparisonRevisionId)) {
      setSelectedComparisonRevisionId(comparisonRevisions[0].id);
    }
  }, [comparisonRevisions, selectedComparisonRevisionId]);

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

    if (revision.bodyFatSkinfoldsPct !== null) {
      const sumMm = [revision.bicepFoldMm, revision.tricepFoldMm, revision.subscapularFoldMm, revision.suprailiacFoldMm]
        .every((value) => value !== null && value !== undefined)
        ? (revision.bicepFoldMm ?? 0) + (revision.tricepFoldMm ?? 0) + (revision.subscapularFoldMm ?? 0) + (revision.suprailiacFoldMm ?? 0)
        : null;

      return {
        bodyFatPct: revision.bodyFatSkinfoldsPct,
        roundedBodyFatPct: Math.round(revision.bodyFatSkinfoldsPct),
        sumMm,
      };
    }

    return calculateBodyFatFromSkinfolds(client.sex, getClientAge(client, revision ? new Date(revision.reviewedAt) : undefined), {
      bicepFoldMm: revision.bicepFoldMm,
      tricepFoldMm: revision.tricepFoldMm,
      subscapularFoldMm: revision.subscapularFoldMm,
      suprailiacFoldMm: revision.suprailiacFoldMm,
      abdominalFoldMm: revision.abdominalFoldMm,
      frontThighFoldMm: revision.frontThighFoldMm,
      calfFoldMm: revision.calfFoldMm,
    });
  }, [client?.birthDate, client?.sex, revision]);

  const comparisonPerimeterCalculation = useMemo(() => {
    if (!selectedComparisonRevision || (client?.sex !== 'female' && client?.sex !== 'male')) {
      return null;
    }

    return calculateBodyFatFromPerimeters(client.sex, {
      neckCm: selectedComparisonRevision.neckCm,
      bellyCm: selectedComparisonRevision.bellyCm,
      gluteCm: selectedComparisonRevision.gluteCm,
      heightCm: client.heightCm,
    });
  }, [client?.heightCm, client?.sex, selectedComparisonRevision]);

  const comparisonSkinfoldCalculation = useMemo(() => {
    if (!selectedComparisonRevision || (client?.sex !== 'female' && client?.sex !== 'male')) {
      return null;
    }

    if (selectedComparisonRevision.bodyFatSkinfoldsPct !== null) {
      const sumMm = [
        selectedComparisonRevision.bicepFoldMm,
        selectedComparisonRevision.tricepFoldMm,
        selectedComparisonRevision.subscapularFoldMm,
        selectedComparisonRevision.suprailiacFoldMm,
      ].every((value) => value !== null && value !== undefined)
        ? (selectedComparisonRevision.bicepFoldMm ?? 0) + (selectedComparisonRevision.tricepFoldMm ?? 0) + (selectedComparisonRevision.subscapularFoldMm ?? 0) + (selectedComparisonRevision.suprailiacFoldMm ?? 0)
        : null;

      return {
        bodyFatPct: selectedComparisonRevision.bodyFatSkinfoldsPct,
        roundedBodyFatPct: Math.round(selectedComparisonRevision.bodyFatSkinfoldsPct),
        sumMm,
      };
    }

    return calculateBodyFatFromSkinfolds(client.sex, getClientAge(client, selectedComparisonRevision ? new Date(selectedComparisonRevision.reviewedAt) : undefined), {
      bicepFoldMm: selectedComparisonRevision.bicepFoldMm,
      tricepFoldMm: selectedComparisonRevision.tricepFoldMm,
      subscapularFoldMm: selectedComparisonRevision.subscapularFoldMm,
      suprailiacFoldMm: selectedComparisonRevision.suprailiacFoldMm,
      abdominalFoldMm: selectedComparisonRevision.abdominalFoldMm,
      frontThighFoldMm: selectedComparisonRevision.frontThighFoldMm,
      calfFoldMm: selectedComparisonRevision.calfFoldMm,
    });
  }, [client?.birthDate, client?.sex, selectedComparisonRevision]);

  const comparisonPerimeterMeasurementValues = useMemo<MeasurementValueMap | null>(() => {
    if (!selectedComparisonRevision) {
      return null;
    }

    return {
      neckCm: selectedComparisonRevision.neckCm,
      armCm: selectedComparisonRevision.armCm,
      waistCm: selectedComparisonRevision.waistCm,
      bellyCm: selectedComparisonRevision.bellyCm,
      pelvisCm: selectedComparisonRevision.pelvisCm,
      gluteCm: selectedComparisonRevision.gluteCm,
      thighCm: selectedComparisonRevision.thighCm,
      calfCm: selectedComparisonRevision.calfCm,
      torsoCm: selectedComparisonRevision.torsoCm,
    };
  }, [selectedComparisonRevision]);

  const comparisonSkinfoldMeasurementValues = useMemo<MeasurementValueMap | null>(() => {
    if (!selectedComparisonRevision) {
      return null;
    }

    return {
      bicepFoldMm: selectedComparisonRevision.bicepFoldMm,
      tricepFoldMm: selectedComparisonRevision.tricepFoldMm,
      subscapularFoldMm: selectedComparisonRevision.subscapularFoldMm,
      abdominalFoldMm: selectedComparisonRevision.abdominalFoldMm,
      suprailiacFoldMm: selectedComparisonRevision.suprailiacFoldMm,
      frontThighFoldMm: selectedComparisonRevision.frontThighFoldMm,
      calfFoldMm: selectedComparisonRevision.calfFoldMm,
    };
  }, [selectedComparisonRevision]);

  const bodyFatAverage = useMemo(() => {
    if (!revision) {
      return null;
    }

    if (revision.bodyFatPct !== null) {
      return {
        bodyFatPct: revision.bodyFatPct,
        roundedBodyFatPct: Math.round(revision.bodyFatPct),
      };
    }

    return calculateBodyFatAverage({
      visualBodyFatPct: revision.bodyFatVisualPct,
      skinfoldBodyFatPct: skinfoldCalculation?.bodyFatPct ?? null,
      perimeterBodyFatPct: perimeterCalculation?.bodyFatPct ?? null,
    });
  }, [perimeterCalculation?.bodyFatPct, revision, skinfoldCalculation?.bodyFatPct]);
  const comparisonBodyFatAverage = useMemo(() => {
    if (!selectedComparisonRevision) {
      return null;
    }

    if (selectedComparisonRevision.bodyFatPct !== null) {
      return {
        bodyFatPct: selectedComparisonRevision.bodyFatPct,
        roundedBodyFatPct: Math.round(selectedComparisonRevision.bodyFatPct),
      };
    }

    return calculateBodyFatAverage({
      visualBodyFatPct: selectedComparisonRevision.bodyFatVisualPct,
      skinfoldBodyFatPct: comparisonSkinfoldCalculation?.bodyFatPct ?? null,
      perimeterBodyFatPct: comparisonPerimeterCalculation?.bodyFatPct ?? null,
    });
  }, [comparisonPerimeterCalculation?.bodyFatPct, comparisonSkinfoldCalculation?.bodyFatPct, selectedComparisonRevision]);

  const perimeterFormulaContent = useMemo(
    () => buildBodyFatFormulaInfoContent(perimeterFormulaInfo?.code, { sex: client?.sex, age: getClientAge(client, revision ? new Date(revision.reviewedAt) : undefined) }),
    [client, perimeterFormulaInfo?.code, revision]
  );
  const skinfoldFormulaContent = useMemo(
    () => buildBodyFatFormulaInfoContent(skinfoldFormulaInfo?.code, { sex: client?.sex, age: getClientAge(client, revision ? new Date(revision.reviewedAt) : undefined) }),
    [client, skinfoldFormulaInfo?.code, revision]
  );

  const bodyFatAverageDiff =
    bodyFatAverage && comparisonBodyFatAverage
      ? bodyFatAverage.roundedBodyFatPct - comparisonBodyFatAverage.roundedBodyFatPct
      : null;
  const selectedActivityOption = findActivityFactorOption(revision?.activityFactor ?? null);
  const weightDiffKg = useMemo(
    () => calculateWeightDiffKg(revision?.weightKg ?? null, selectedComparisonRevision),
    [revision?.weightKg, selectedComparisonRevision]
  );
  const fatMassDiffKg = useMemo(
    () => calculateFatMassDiffKg(revision?.fatMassKg ?? null, selectedComparisonRevision),
    [revision?.fatMassKg, selectedComparisonRevision]
  );
  const leanMassDiffKg = useMemo(
    () => calculateLeanMassDiffKg(revision?.leanMassKg ?? null, selectedComparisonRevision),
    [revision?.leanMassKg, selectedComparisonRevision]
  );
  const comparisonOptions = useMemo(
    () => comparisonRevisions.map((candidateRevision) => ({
      label: formatShortDate(candidateRevision.reviewedAt),
      value: candidateRevision.id,
    })),
    [comparisonRevisions]
  );
  const overviewCards = useMemo<DetailItem[]>(() => {
    if (!revision) return [];

    return [
      {
        label: 'Peso',
        value: fmt(revision.weightKg, 'kg'),
        delta: fmtDiff(weightDiffKg, 'kg'),
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
  }, [bodyFatAverage, bodyFatAverageDiff, revision, weightDiffKg]);

  const summaryStats = useMemo<DetailItem[]>(() => {
    if (!revision) return [];

    const metrics: DetailItem[] = [];
    const currentVisualBodyFatPct = revision.bodyFatVisualPct !== null && revision.bodyFatVisualPct !== undefined
      ? Math.round(revision.bodyFatVisualPct)
      : null;
    const comparisonVisualBodyFatPct = selectedComparisonRevision?.bodyFatVisualPct !== null && selectedComparisonRevision?.bodyFatVisualPct !== undefined
      ? Math.round(selectedComparisonRevision.bodyFatVisualPct)
      : null;
    const currentPerimeterBodyFatPct = perimeterCalculation ? perimeterCalculation.roundedBodyFatPct : null;
    const comparisonPerimeterBodyFatPct = comparisonPerimeterCalculation ? comparisonPerimeterCalculation.roundedBodyFatPct : null;
    const currentSkinfoldBodyFatPct = skinfoldCalculation ? skinfoldCalculation.roundedBodyFatPct : null;
    const comparisonSkinfoldBodyFatPct = comparisonSkinfoldCalculation ? comparisonSkinfoldCalculation.roundedBodyFatPct : null;

    metrics.push({
      label: 'Grasa visual',
      value: formatPercentValue(currentVisualBodyFatPct),
      delta: fmtDiff(calculateDiff(currentVisualBodyFatPct, comparisonVisualBodyFatPct), '%'),
    });

    if (selectedActivityOption && revision.activityFactor !== null && revision.activityFactor !== undefined) {
      metrics.push({
        label: 'Frecuencia de actividad',
        value: selectedActivityOption.description,
      });
    } else if (revision.activityFactor !== null && revision.activityFactor !== undefined) {
      metrics.push({
        label: 'Frecuencia de actividad',
        value: selectedActivityOption?.description ?? 'No disponible',
      });
    }

    if (client?.sex === 'female' || client?.sex === 'male') {
      metrics.push({
        label: 'Grasa por perimetros',
        value: perimeterCalculation ? `${perimeterCalculation.roundedBodyFatPct}%` : 'No disponible',
        delta: fmtDiff(calculateDiff(currentPerimeterBodyFatPct, comparisonPerimeterBodyFatPct), '%'),
      });

      metrics.push({
        label: 'Grasa por pliegues',
        value: skinfoldCalculation ? `${skinfoldCalculation.roundedBodyFatPct}%` : 'No disponible',
        delta: fmtDiff(calculateDiff(currentSkinfoldBodyFatPct, comparisonSkinfoldBodyFatPct), '%'),
      });
    }

    return [
      ...metrics,
      {
        label: 'Masa grasa',
        value: fmt(revision.fatMassKg, 'kg'),
        delta: fmtDiff(fatMassDiffKg, 'kg'),
      },
      {
        label: 'Masa libre',
        value: fmt(revision.leanMassKg, 'kg'),
        delta: fmtDiff(leanMassDiffKg, 'kg'),
      },
    ];
  }, [
    client?.sex,
    fatMassDiffKg,
    leanMassDiffKg,
    comparisonPerimeterCalculation,
    comparisonSkinfoldCalculation,
    perimeterCalculation,
    revision,
    selectedActivityOption,
    selectedComparisonRevision?.bodyFatVisualPct,
    skinfoldCalculation,
  ]);

  const perimeterFieldGroups = useMemo(() => getPerimeterFieldKeysForSex(client?.sex), [client?.sex]);
  const perimeterMeasurementValues = useMemo(() => {
    if (!revision) {
      return null;
    }

    return {
      neckCm: revision.neckCm,
      armCm: revision.armCm,
      waistCm: revision.waistCm,
      bellyCm: revision.bellyCm,
      pelvisCm: revision.pelvisCm,
      gluteCm: revision.gluteCm,
      thighCm: revision.thighCm,
      calfCm: revision.calfCm,
      torsoCm: revision.torsoCm,
    };
  }, [revision]);
  const perimeterRequiredItems = useMemo<DetailItem[]>(() => {
    if (!perimeterMeasurementValues) {
      return [];
    }

    return perimeterFieldGroups.required.flatMap((key) => {
      const item = buildMeasurementItem(
        PERIMETER_LABEL_BY_KEY[key],
        perimeterMeasurementValues[key],
        comparisonPerimeterMeasurementValues?.[key],
        'cm'
      );

      return item ? [item] : [];
    });
  }, [comparisonPerimeterMeasurementValues, perimeterFieldGroups.required, perimeterMeasurementValues]);
  const perimeterOptionalItems = useMemo<DetailItem[]>(() => {
    if (!perimeterMeasurementValues) {
      return [];
    }

    return perimeterFieldGroups.optional.flatMap((key) => {
      const item = buildMeasurementItem(
        PERIMETER_LABEL_BY_KEY[key],
        perimeterMeasurementValues[key],
        comparisonPerimeterMeasurementValues?.[key],
        'cm'
      );

      return item ? [item] : [];
    });
  }, [comparisonPerimeterMeasurementValues, perimeterFieldGroups.optional, perimeterMeasurementValues]);

  const skinfoldItems = useMemo<DetailItem[]>(() => {
    if (!revision) return [];

    const skinfoldValueByKey = {
      bicepFoldMm: revision.bicepFoldMm,
      tricepFoldMm: revision.tricepFoldMm,
      subscapularFoldMm: revision.subscapularFoldMm,
      abdominalFoldMm: revision.abdominalFoldMm,
      suprailiacFoldMm: revision.suprailiacFoldMm,
      frontThighFoldMm: revision.frontThighFoldMm,
      calfFoldMm: revision.calfFoldMm,
    };

    return (Object.keys(skinfoldValueByKey) as (keyof typeof skinfoldValueByKey)[]).flatMap((key) => {
      const item = buildMeasurementItem(
        SKINFOLD_LABEL_BY_KEY[key],
        skinfoldValueByKey[key],
        comparisonSkinfoldMeasurementValues?.[key],
        'mm'
      );

      return item ? [item] : [];
    });
  }, [comparisonSkinfoldMeasurementValues, revision]);

  const hasPerimeterSection = perimeterRequiredItems.length > 0 || perimeterOptionalItems.length > 0;
  const hasSkinfoldSection = skinfoldItems.length > 0;
  const revisionBodyFatAverageLabel = bodyFatAverage ? `${bodyFatAverage.roundedBodyFatPct}% grasa` : 'Grasa no disponible';

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
          title="Revisión no encontrada"
          description="No existe una revisión con ese identificador."
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
                {item.delta ? (
                  <ThemedText type="small" style={[styles.technicalValueDelta, isSecondary && styles.technicalValueDeltaSecondary]}>
                    {item.delta}
                  </ThemedText>
                ) : null}
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
    const sectionIcon =
      sectionKey === 'summary'
        ? 'stats-chart-outline'
        : sectionKey === 'perimeters'
          ? 'resize-outline'
          : sectionKey === 'skinfolds'
            ? 'analytics-outline'
            : sectionKey === 'photos'
              ? 'images-outline'
              : 'document-text-outline';

    return (
      <View style={[styles.sheetSection, { borderColor: theme.backgroundSelected }]}>
        <Pressable
          onPress={() => setActiveSection((currentSection) => (currentSection === sectionKey ? null : sectionKey))}
          accessibilityRole="button"
          accessibilityLabel={`${isOpen ? 'Cerrar' : 'Abrir'} sección ${title}`}
          style={({ pressed }) => [styles.sectionToggle, { opacity: pressed ? 0.92 : 1 }]}>
          <View style={styles.sectionTitleArea}>
            <View style={[styles.sectionIconWrap, isOpen && styles.sectionIconWrapActive]}>
              <Ionicons name={sectionIcon} size={18} color={isOpen ? '#FFFFFF' : Accent.primary} />
            </View>
            <View style={styles.sectionHeaderCopy}>
              <ThemedText type="label" style={styles.sectionEyebrow}>{eyebrow}</ThemedText>
              <ThemedText type="smallBold" style={styles.sectionTitle}>{title}</ThemedText>
            </View>
          </View>
          <View style={styles.sectionToggleMeta}>
            <View style={styles.sectionCountPill}>
              <ThemedText type="smallBold" style={styles.sectionCountText}>{count}</ThemedText>
            </View>
            <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={isOpen ? Accent.primary : '#7B8AA0'} />
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
          <ThemedText type="smallBold" style={styles.formulaTitle}>Cálculo por perímetros</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.formulaHint}>
            La fórmula utilizada queda disponible desde el icono de información.
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
          <ThemedText type="smallBold" style={styles.formulaTitle}>Cálculo por pliegues</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.formulaHint}>
            El detalle completo de la fórmula se consulta desde el icono de información.
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

        {!isAthlete ? (
          <Pressable
            onPress={() => setIsRevisionMenuOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Acciones de revisión"
            style={({ pressed }) => [
              styles.menuButton,
              {
                borderColor: theme.backgroundSelected,
                backgroundColor: pressed ? '#EFF5FF' : '#FFFFFF',
                opacity: pressed ? 0.92 : 1,
              },
            ]}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#1F3D69" />
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.heroCard, { borderColor: theme.backgroundSelected }]}>
        <View style={styles.heroIdentityRow}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="clipboard-outline" size={26} color={Accent.primary} />
          </View>
          <View style={styles.heroCopy}>
            <ThemedText type="label" style={styles.heroEyebrow}>Detalle de revisión</ThemedText>
            <ThemedText type="headline" style={styles.clientTitle}>
              {client?.name ?? 'Cliente'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.heroDate}>
              {formatLongDate(revision.reviewedAt)}
            </ThemedText>
          </View>
        </View>

        <View style={styles.heroMetaRow}>
          <View style={styles.phasePill}>
            <Ionicons name="flag-outline" size={16} color={Accent.primary} />
            <ThemedText type="smallBold" style={styles.phasePillText}>{formatRevisionPhase(revision.phase)}</ThemedText>
          </View>
          <View style={styles.phasePillSoft}>
            <Ionicons name="git-compare-outline" size={16} color="#5C6B86" />
            <ThemedText type="small" themeColor="textSecondary">
              {selectedComparisonRevision ? `vs ${formatShortDate(selectedComparisonRevision.reviewedAt)}` : 'Sin comparativa'}
            </ThemedText>
          </View>
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

      <View style={[styles.compareCard, { borderColor: theme.backgroundSelected }]}>
        <View style={styles.compareCardHeader}>
          <View style={styles.compareIconWrap}>
            <Ionicons name="trending-up-outline" size={20} color={Accent.primary} />
          </View>
          <View style={styles.compareCardCopy}>
            <ThemedText type="smallBold" style={styles.compareCardTitle}>Comparativa de progreso</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.compareCardHint}>
              Selecciona una revisión de referencia para interpretar diferencias.
            </ThemedText>
          </View>
        </View>

        {comparisonOptions.length > 0 ? (
          <AppSelect
            label="Comparar con"
            value={selectedComparisonRevision?.id ?? ''}
            options={comparisonOptions}
            onChange={setSelectedComparisonRevisionId}
            containerStyle={styles.compareSelectShell}
            pickerTextStyle={styles.compareSelectText}
          />
        ) : (
          <View style={styles.compareEmptyState}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.compareEmptyText}>
              Esta revisión se muestra sin diferencias porque todavía no hay otra visita registrada.
            </ThemedText>
          </View>
        )}
      </View>

      <View style={styles.detailSheet}>
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

        {hasPerimeterSection
          ? renderSectionCard(
              'perimeters',
              'Perimetros',
              'Medidas corporales',
              `${perimeterRequiredItems.length + perimeterOptionalItems.length}`,
              <View style={styles.perimeterSectionBody}>
                {renderPerimeterFormulaHeader()}
                {perimeterRequiredItems.length > 0 ? (
                  <View style={[styles.measureGroup, styles.measureGroupPrimary, { borderColor: theme.backgroundSelected }]}>
                    <View style={styles.measureGroupHeader}>
                      <View style={styles.measureGroupHeaderCopy}>
                        <ThemedText type="smallBold" style={styles.measureGroupTitle}>Medidas registradas</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary" style={styles.measureGroupHint}>
                          Valores disponibles para el análisis principal por perímetros.
                        </ThemedText>
                      </View>
                      <View style={styles.measureGroupCountPill}>
                        <ThemedText type="smallBold" style={styles.measureGroupCountText}>{perimeterRequiredItems.length}</ThemedText>
                      </View>
                    </View>
                    {renderTechnicalGrid(perimeterRequiredItems)}
                  </View>
                ) : null}
                {perimeterOptionalItems.length > 0 ? (
                  <View style={[styles.measureGroup, styles.measureGroupSecondary, { borderColor: theme.backgroundSelected }]}>
                    <View style={styles.measureGroupHeader}>
                      <View style={styles.measureGroupHeaderCopy}>
                        <ThemedText type="smallBold" style={[styles.measureGroupTitle, styles.measureGroupTitleSecondary]}>Contexto adicional</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary" style={styles.measureGroupHint}>
                          Medidas extra guardadas para seguimiento complementario.
                        </ThemedText>
                      </View>
                      <View style={styles.measureGroupSecondaryPill}>
                        <ThemedText type="smallBold" style={styles.measureGroupSecondaryPillText}>{perimeterOptionalItems.length}</ThemedText>
                      </View>
                    </View>
                    {renderTechnicalGrid(perimeterOptionalItems, 'secondary')}
                  </View>
                ) : null}
              </View>
            )
          : null}

        {hasSkinfoldSection
          ? renderSectionCard(
              'skinfolds',
              'Pliegues',
              'Control adiposo',
              `${skinfoldItems.length}`,
              <View style={styles.perimeterSectionBody}>
                {renderSkinfoldFormulaHeader()}
                {renderTechnicalGrid(skinfoldItems)}
              </View>
            )
          : null}

        {renderSectionCard(
          'photos',
          'Imágenes',
          'Fotos asociadas',
          `${revisionPhotos.length}`,
          <View style={styles.revisionPhotosWrap}>
            {!isAthlete && (
              <AppButton
                label="Subir imagen asociada"
                size="compact"
                variant="surface"
                onPress={openUploadModal}
              />
            )}

            {revisionPhotos.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.revisionPhotosEmptyText}>
                No hay imágenes asociadas a esta revisión.
              </ThemedText>
            ) : (
              <View style={styles.photoGrid}>
                {revisionPhotos.map((photo) => (
                  <Pressable
                    key={photo.id}
                    onPress={() => setPreviewPhoto(photo)}
                    style={({ pressed }) => [styles.photoTile, { opacity: pressed ? 0.9 : 1 }]}>
                    <Image source={{ uri: photo.imageUrl }} style={styles.photoThumb} contentFit="cover" transition={150} />
                  </Pressable>
                ))}
              </View>
            )}
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

      <Modal transparent visible={Boolean(previewPhoto)} animationType="fade" onRequestClose={() => setPreviewPhoto(null)}>
        <Pressable style={styles.viewerBackdrop} onPress={() => setPreviewPhoto(null)}>
          <Pressable style={[styles.viewerPanel, { borderColor: theme.backgroundSelected }]} onPress={() => null}>
            {previewPhoto ? (
              <>
                <Image source={{ uri: previewPhoto.imageUrl }} style={styles.viewerImage} contentFit="contain" transition={150} />
                <View style={styles.viewerMetaRow}>
                  <View style={styles.viewerMetaCopy}>
                    <ThemedText type="small" themeColor="textSecondary">Fecha: {formatPhotoDate(previewPhoto.capturedAt)}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">{revisionBodyFatAverageLabel}</ThemedText>
                  </View>
                </View>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent visible={isUploadModalOpen} animationType="fade" onRequestClose={closeUploadModal}>
        <Pressable style={styles.menuBackdrop} onPress={closeUploadModal}>
          <Pressable style={[styles.uploadPanel, { borderColor: theme.backgroundSelected }]} onPress={() => null}>
            <View style={styles.uploadHeader}>
              <ThemedText type="smallBold">Subir imagen</ThemedText>
              <Pressable onPress={closeUploadModal} style={styles.uploadCloseButton}>
                <ThemedText type="smallBold" style={styles.uploadCloseText}>×</ThemedText>
              </Pressable>
            </View>

            <AppDateTimeInput
              label="Fecha"
              value={uploadCapturedAt}
              mode="date"
              helper="Preseleccionada a hoy"
              onChange={(value) => setUploadCapturedAt(value)}
            />

            <View style={styles.uploadActions}>
              <AppButton label="Cancelar" variant="ghost" size="compact" fullWidth={false} onPress={closeUploadModal} disabled={isUploadingPhoto} />
              <AppButton label="Seleccionar y subir" size="compact" fullWidth={false} onPress={() => void handleUploadPhotoFromRevision()} loading={isUploadingPhoto} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent visible={isRevisionMenuOpen} animationType="fade" onRequestClose={() => setIsRevisionMenuOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setIsRevisionMenuOpen(false)}>
          <Pressable style={[styles.menuPanel, { borderColor: theme.backgroundSelected }]} onPress={() => null}>
            <AppButton
              label="Editar revisión"
              variant="surface"
              size="compact"
              onPress={() => {
                setIsRevisionMenuOpen(false);
                router.push(`/revisions/${revision.id}/edit?clientId=${revision.clientId}`);
              }}
            />
            <AppButton
              label={isDeleting ? 'Eliminando...' : 'Eliminar revisión'}
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
  heroCard: {
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
  heroIdentityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D2E0FA',
    backgroundColor: '#E8F0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  heroEyebrow: {
    color: Accent.primary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  clientTitle: {
    fontSize: 31,
    lineHeight: 36,
    color: '#10203B',
  },
  heroDate: {
    lineHeight: 18,
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E6EDF7',
  },
  phasePill: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: Radius.pill,
    backgroundColor: '#EEF5FF',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  phasePillText: {
    color: Accent.primary,
    lineHeight: 16,
  },
  phasePillSoft: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: Radius.pill,
    backgroundColor: '#F6F9FE',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  heroMetricCard: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 150,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DFE7F2',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
    backgroundColor: '#FFFFFF',
  },
  heroMetricCardPrimary: {
    width: '100%',
    backgroundColor: '#EEF4FF',
  },
  heroMetricCardSecondary: {
    backgroundColor: '#F9FBFF',
  },
  heroMetricLabelPrimary: {
    color: '#4A628A',
  },
  heroMetricLabel: {
    color: '#5E6E88',
    lineHeight: 17,
  },
  heroMetricValue: {
    color: Accent.ink,
    fontSize: 18,
    lineHeight: 23,
  },
  heroMetricDelta: {
    color: Accent.primary,
    lineHeight: 18,
  },
  heroMetricSpacer: {
    height: 18,
  },
  compareCard: {
    borderWidth: 1,
    borderColor: '#DFE7F2',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 12,
  },
  compareCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  compareIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF5FF',
  },
  compareCardCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  compareCardTitle: {
    color: Accent.ink,
    lineHeight: 18,
  },
  compareCardHint: {
    lineHeight: 18,
  },
  compareBadge: {
    borderRadius: Radius.pill,
    backgroundColor: '#EAF1FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  compareBadgeText: {
    color: Accent.primary,
    fontSize: 11,
    lineHeight: 14,
  },
  compareSelectShell: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.medium,
  },
  compareSelectText: {
    color: Accent.ink,
  },
  compareEmptyState: {
    borderRadius: Radius.medium,
    backgroundColor: '#F6F9FE',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  compareEmptyText: {
    lineHeight: 18,
  },
  detailSheet: {
    gap: 12,
  },
  sheetSection: {
    borderWidth: 1,
    borderColor: '#DFE7F2',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#12336E',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  sectionTitleArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  sectionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF5FF',
  },
  sectionIconWrapActive: {
    backgroundColor: Accent.primary,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sectionHeaderCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  sectionEyebrow: {
    color: Accent.primary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: Accent.ink,
    fontSize: 18,
    lineHeight: 23,
  },
  sectionToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  sectionToggleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionCountPill: {
    borderRadius: Radius.pill,
    backgroundColor: '#EEF4FF',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  sectionCountText: {
    color: Accent.primary,
    fontSize: 11,
    lineHeight: 14,
  },
  sectionBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#EDF2FB',
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
    borderColor: '#DFE7F2',
    borderRadius: Radius.medium,
    backgroundColor: '#F8FBFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  formulaHeaderCopy: {
    flex: 1,
    gap: 4,
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
    borderColor: '#DFE7F2',
    borderRadius: 18,
    padding: 12,
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
    paddingVertical: 11,
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
    gap: 2,
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
  technicalValueDelta: {
    color: Accent.primary,
    lineHeight: 16,
    textAlign: 'right',
  },
  technicalValueDeltaSecondary: {
    color: '#5C6B86',
  },
  technicalValueTextSecondary: {
    color: '#50627E',
  },
  noteInline: {
    borderRadius: 18,
    backgroundColor: '#F8FBFF',
    padding: 12,
  },
  noteText: {
    lineHeight: 22,
  },
  revisionPhotosWrap: {
    gap: Spacing.two,
    paddingVertical: 2,
  },
  revisionPhotosEmptyText: {
    lineHeight: 20,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 6,
  },
  photoTile: {
    width: '32%',
    borderRadius: Radius.small,
    overflow: 'hidden',
  },
  photoThumb: {
    aspectRatio: 1,
    width: '100%',
    backgroundColor: '#EAF1FF',
  },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 32, 59, 0.72)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  viewerPanel: {
    borderWidth: 1,
    borderColor: '#DFE7F2',
    borderRadius: 22,
    backgroundColor: '#0D1A33',
    padding: Spacing.two,
    gap: Spacing.two,
  },
  viewerImage: {
    width: '100%',
    height: 420,
    borderRadius: Radius.small,
    backgroundColor: '#15294D',
  },
  viewerMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  viewerMetaCopy: {
    flex: 1,
    gap: 2,
  },
  uploadPanel: {
    borderWidth: 1,
    borderColor: '#DFE7F2',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    padding: Spacing.three,
    gap: Spacing.three,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
    marginTop: 24,
  },
  uploadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  uploadCloseButton: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F6FB',
  },
  uploadCloseText: {
    color: '#5E6E88',
    fontSize: 18,
    lineHeight: 20,
  },
  uploadActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: Spacing.two,
  },
  menuButton: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderColor: '#DFE7F2',
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 32, 59, 0.18)',
    paddingHorizontal: Spacing.three,
    paddingTop: 96,
  },
  menuPanel: {
    alignSelf: 'flex-end',
    width: 240,
    borderWidth: 1,
    borderColor: '#DFE7F2',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    padding: Spacing.two,
    gap: Spacing.two,
    shadowColor: '#12336E',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
});

