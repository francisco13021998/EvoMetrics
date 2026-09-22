import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Ionicons } from '@expo/vector-icons';

import { EmptyState } from '@/components/feedback/empty-state';
import { StatusBanner } from '@/components/feedback/status-banner';
import { AppButton } from '@/components/forms/app-button';
import { AppDateTimeInput } from '@/components/forms/app-date-time';
import { AppInput } from '@/components/forms/app-input';
import { AppSelect } from '@/components/forms/app-select';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { ScreenContainer } from '@/components/layout/screen-container';
import { CameraCaptureModal, CameraCaptureShot } from '@/components/surface/camera-capture-modal';
import { PhaseSelect } from '@/components/surface/phase-select';
import { ThemedText } from '@/components/themed-text';
import { FormulaInfoButton } from '@/components/ui/formula-info-button';
import {
  getActiveSkinfoldProtocolForAthleteLevel,
  getAvailableSkinfoldProtocolsForAthleteLevel,
  type SkinfoldProtocolFieldKey,
} from '@/constants/athlete-level';
import {
  buildBodyFatFormulaInfoContent,
  getPerimeterFormulaCodeForSex,
  getSkinfoldFormulaCodeForAthleteLevel,
} from '@/constants/body-fat-formulas';
import { Accent, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { bodyFatFormulasService, type BodyFatFormulaReference } from '@/services/body-fat-formulas';
import { clientsService } from '@/services/clients';
import { photosService } from '@/services/photos';
import { revisionsService } from '@/services/revisions';
import { Client, ClientPhoto, Revision } from '@/types/domain';
import { isSupportedActivityFactor } from '@/utils/activity';
import {
  calculateBodyFatFromPerimeters,
  calculateBodyFatFromSkinfolds,
  calculateMaintenanceCalories,
} from '@/utils/calculations';
import { getClientAge } from '@/utils/client-age';
import {
  findPreviousComparableRevisionByPerimeterFormula,
  findPreviousComparableRevisionBySkinfoldFormula,
} from '@/utils/revision-comparisons';
import { getPerimeterFieldKeysForSex } from '@/utils/revision-measurements';
import {
  REVISION_PHASE_OPTIONS,
  isRevisionPhase,
  normalizeRevisionPhase,
} from '@/utils/revisions';

const AnimatedGuideImage = Animated.createAnimatedComponent(Image);
const GUIDE_ZOOM_MIN_SCALE = 0.6;
const GUIDE_ZOOM_MAX_SCALE = 4;

function clampGuideZoomScale(value: number) {
  'worklet';
  return Math.min(Math.max(value, GUIDE_ZOOM_MIN_SCALE), GUIDE_ZOOM_MAX_SCALE);
}

function useGuideZoomTransform() {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  function resetZoom() {
    scale.value = withTiming(1);
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    savedScale.value = 1;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = clampGuideZoomScale(savedScale.value * event.scale);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const panGesture = Gesture.Pan()
    .minPointers(2)
    .onUpdate((event) => {
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const gesture = Gesture.Simultaneous(pinchGesture, panGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return { gesture, animatedStyle, resetZoom };
}

type GuideZoomTransform = ReturnType<typeof useGuideZoomTransform>;

type ZoomableGuideImageProps = {
  source: number;
  height: number;
  gesture: GuideZoomTransform['gesture'];
  animatedStyle: GuideZoomTransform['animatedStyle'];
  onReset: GuideZoomTransform['resetZoom'];
};

function ZoomableGuideImage({ source, height, gesture, animatedStyle, onReset }: ZoomableGuideImageProps) {
  return (
    <View style={[styles.guideImageViewport, { height }]}>
      <GestureDetector gesture={gesture}>
        <AnimatedGuideImage source={source} style={[styles.guideModalImage, { height }, animatedStyle]} contentFit="contain" transition={150} />
      </GestureDetector>
      <Pressable
        onPress={onReset}
        accessibilityRole="button"
        accessibilityLabel="Restablecer zoom de la imagen"
        style={({ pressed }) => [styles.guideZoomResetButton, { opacity: pressed ? 0.78 : 1 }]}>
        <Ionicons name="scan-outline" size={13} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}


type RevisionFormScreenProps = {
  mode: 'create' | 'edit';
  clientId?: string;
  revisionId?: string;
};

type RevisionFormState = {
  phase: string;
  reviewedAt: string;
  weightKg: string;
  neckCm: string;
  armCm: string;
  waistCm: string;
  bellyCm: string;
  pelvisCm: string;
  gluteCm: string;
  thighCm: string;
  bicepFoldMm: string;
  tricepFoldMm: string;
  subscapularFoldMm: string;
  abdominalFoldMm: string;
  suprailiacFoldMm: string;
  frontThighFoldMm: string;
  calfFoldMm: string;
  bodyFatVisualPct: string;
  activityFactor: string;
  maintenanceKcal: string;
  targetKcal: string;
  notes: string;
};

type FieldKey = Exclude<keyof RevisionFormState, 'phase' | 'reviewedAt' | 'notes'>;
type SectionKey = 'context' | 'perimeters' | 'skinfolds' | 'composition' | 'notes' | 'images';

// Forma mínima común entre lo que devuelve expo-image-picker (galería) y la cámara continua propia.
type PickedImageAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

type RevisionFieldConfig = {
  key: FieldKey;
  label: string;
  placeholder: string;
};

type RevisionReferencePlaceholders = Partial<Record<FieldKey, string>> & {
  phase?: string;
  reviewedAt?: string;
  notes?: string;
};

const PERIMETER_PROTOCOL_ID = 'perimeters';

const PERIMETER_PROTOCOL_OPTIONS = [
  {
    label: 'Perímetros',
    value: PERIMETER_PROTOCOL_ID,
  },
] as const;

const PERIMETER_FIELDS: RevisionFieldConfig[] = [
  { key: 'neckCm', label: 'Cuello (cm)', placeholder: '31' },
  { key: 'armCm', label: 'Brazo (cm)', placeholder: '28' },
  { key: 'waistCm', label: 'Cintura (cm)', placeholder: '73' },
  { key: 'bellyCm', label: 'Abdomen (cm)', placeholder: '76' },
  { key: 'pelvisCm', label: 'Pelvis (cm)', placeholder: '92' },
  { key: 'gluteCm', label: 'Gluteo (cm)', placeholder: '96' },
  { key: 'thighCm', label: 'Muslo (cm)', placeholder: '55' },
];

const PERIMETER_FIELD_BY_KEY = Object.fromEntries(
  PERIMETER_FIELDS.map((field) => [field.key, field])
) as Record<(typeof PERIMETER_FIELDS)[number]['key'], RevisionFieldConfig>;

const SKINFOLD_FIELD_CONFIGS: RevisionFieldConfig[] = [
  { key: 'bicepFoldMm', label: 'Bíceps (mm)', placeholder: '7' },
  { key: 'tricepFoldMm', label: 'Tricipital (mm)', placeholder: '12' },
  { key: 'subscapularFoldMm', label: 'Subescapular (mm)', placeholder: '10' },
  { key: 'abdominalFoldMm', label: 'Abdominal (mm)', placeholder: '14' },
  { key: 'suprailiacFoldMm', label: 'Suprailiaco (mm)', placeholder: '13' },
  { key: 'frontThighFoldMm', label: 'Muslo frontal (mm)', placeholder: '17' },
  { key: 'calfFoldMm', label: 'Pantorrilla (mm)', placeholder: '11' },
];

const SKINFOLD_FIELD_BY_KEY = Object.fromEntries(
  SKINFOLD_FIELD_CONFIGS.map((field) => [field.key, field])
) as Record<(typeof SKINFOLD_FIELD_CONFIGS)[number]['key'], RevisionFieldConfig>;

const COMPOSITION_FIELDS: RevisionFieldConfig[] = [
  { key: 'bodyFatVisualPct', label: 'Grasa visual (%)', placeholder: '21.4' },
];

const initialForm: RevisionFormState = {
  phase: '',
  reviewedAt: '',
  weightKg: '',
  neckCm: '',
  armCm: '',
  waistCm: '',
  bellyCm: '',
  pelvisCm: '',
  gluteCm: '',
  thighCm: '',
  bicepFoldMm: '',
  tricepFoldMm: '',
  subscapularFoldMm: '',
  abdominalFoldMm: '',
  suprailiacFoldMm: '',
  frontThighFoldMm: '',
  calfFoldMm: '',
  bodyFatVisualPct: '',
  activityFactor: '',
  maintenanceKcal: '',
  targetKcal: '',
  notes: '',
};

function toInputValue(value: number | string | null | undefined) {
  return value === null || value === undefined ? '' : String(value);
}

function formatNumber(value: number) {
  return value.toLocaleString('es-ES', {
    maximumFractionDigits: 2,
  });
}

function getFieldUnit(fieldKey: FieldKey) {
  if (fieldKey === 'weightKg') return 'kg';
  if (fieldKey.endsWith('Cm')) return 'cm';
  if (fieldKey.endsWith('Mm')) return 'mm';
  if (fieldKey.endsWith('Pct')) return '%';
  if (fieldKey.endsWith('Kcal')) return 'kcal';
  return '';
}

function parseFieldValue(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsedValue = Number(value.replace(',', '.'));
  return Number.isNaN(parsedValue) ? null : parsedValue;
}

function parseNullableNumber(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsedValue = Number(value.replace(',', '.'));

  if (Number.isNaN(parsedValue)) {
    throw new Error('Revisa los campos numericos: hay valores no validos.');
  }

  return parsedValue;
}

function formatDateForInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatDateForDisplay(value: Date) {
  return value.toLocaleDateString('es-ES', {
    dateStyle: 'short',
  });
}

function truncateText(value: string, length = 80) {
  if (value.length <= length) {
    return value;
  }

  return `${value.slice(0, length - 1)}…`;
}

function parseDateInputToIso(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const [yearStr, monthStr, dayStr] = trimmedValue.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new Error('La fecha de la revision no es valida. Usa un formato tipo 2026-04-21.');
  }

  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0)).toISOString();
}

function toDateOnlyIso(value: Date) {
  return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0)).toISOString();
}

function parseDateOrNow(value: string | null | undefined) {
  if (!value) {
    return new Date();
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return new Date();
  }

  return parsedDate;
}

function mapRevisionToForm(revision: Revision): RevisionFormState {
  return {
    phase: normalizeRevisionPhase(revision.phase),
    reviewedAt: revision.reviewedAt ? formatDateForInput(new Date(revision.reviewedAt)) : '',
    weightKg: toInputValue(revision.weightKg),
    neckCm: toInputValue(revision.neckCm),
    armCm: toInputValue(revision.armCm),
    waistCm: toInputValue(revision.waistCm),
    bellyCm: toInputValue(revision.bellyCm),
    pelvisCm: toInputValue(revision.pelvisCm),
    gluteCm: toInputValue(revision.gluteCm),
    thighCm: toInputValue(revision.thighCm),
    bicepFoldMm: toInputValue(revision.bicepFoldMm),
    tricepFoldMm: toInputValue(revision.tricepFoldMm),
    subscapularFoldMm: toInputValue(revision.subscapularFoldMm),
    abdominalFoldMm: toInputValue(revision.abdominalFoldMm),
    suprailiacFoldMm: toInputValue(revision.suprailiacFoldMm),
    frontThighFoldMm: toInputValue(revision.frontThighFoldMm),
    calfFoldMm: toInputValue(revision.calfFoldMm),
    bodyFatVisualPct: toInputValue(revision.bodyFatVisualPct),
    activityFactor: toInputValue(revision.activityFactor),
    maintenanceKcal: toInputValue(revision.maintenanceKcal),
    targetKcal: toInputValue(revision.targetKcal),
    notes: revision.notes ?? '',
  };
}

function hasRevisionValue(value: number | null | undefined) {
  return value !== null && value !== undefined;
}

function hasSavedPerimeterMeasurements(revision: Revision) {
  return [
    revision.neckCm,
    revision.armCm,
    revision.waistCm,
    revision.bellyCm,
    revision.pelvisCm,
    revision.gluteCm,
    revision.thighCm,
  ].some(hasRevisionValue);
}

function getSavedSkinfoldValueByField(revision: Revision): Record<SkinfoldProtocolFieldKey, number | null> {
  return {
    bicepFoldMm: revision.bicepFoldMm,
    tricepFoldMm: revision.tricepFoldMm,
    subscapularFoldMm: revision.subscapularFoldMm,
    abdominalFoldMm: revision.abdominalFoldMm,
    suprailiacFoldMm: revision.suprailiacFoldMm,
    frontThighFoldMm: revision.frontThighFoldMm,
    calfFoldMm: revision.calfFoldMm,
  };
}

function getInitialPerimeterProtocolId(revision: Revision) {
  return revision.perimeterFormulaId || hasSavedPerimeterMeasurements(revision) ? PERIMETER_PROTOCOL_ID : '';
}

function getInitialSkinfoldProtocolId(
  revision: Revision,
  athleteLevel: Client['athleteLevel'],
  formulaCode?: string | null
) {
  const availableProtocols = getAvailableSkinfoldProtocolsForAthleteLevel(athleteLevel);

  if (formulaCode) {
    const matchedProtocol = availableProtocols.find((protocol) => protocol.formulaCode === formulaCode);

    if (matchedProtocol) {
      return matchedProtocol.id;
    }
  }

  const savedValues = getSavedSkinfoldValueByField(revision);
  const matchedByFields = availableProtocols.find((protocol) =>
    protocol.fields.some((fieldKey) => hasRevisionValue(savedValues[fieldKey]))
  );

  if (matchedByFields) {
    return matchedByFields.id;
  }

  if (revision.skinfoldFormulaId) {
    return getActiveSkinfoldProtocolForAthleteLevel(athleteLevel)?.id ?? availableProtocols[0]?.id ?? '';
  }

  return '';
}

function sectionFields(
  form: RevisionFormState,
  setForm: React.Dispatch<React.SetStateAction<RevisionFormState>>
) {
  return {
    setField: (field: keyof RevisionFormState, value: string) => {
      setForm((currentForm) => ({
        ...currentForm,
        [field]: value,
      }));
    },
    form,
  };
}

function countCompletedFields(form: RevisionFormState, fields: RevisionFieldConfig[]) {
  return fields.filter((field) => form[field.key].trim()).length;
}

function stripFieldLabel(label: string) {
  return label.replace(/\s*\([^)]*\)/g, '').trim();
}

function getDeltaColor(delta: number | null, direction: 'decrease-is-better' | 'increase-is-better') {
  if (delta === null || delta === 0) {
    return '#5C6B86';
  }

  const isImprovement = direction === 'decrease-is-better' ? delta < 0 : delta > 0;
  return isImprovement ? Accent.success : Accent.danger;
}

export function RevisionFormScreen({ mode, clientId, revisionId }: RevisionFormScreenProps) {
  const { user } = useAuth();
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const [client, setClient] = useState<Client | null>(null);
  const [clientRevisions, setClientRevisions] = useState<Revision[]>([]);
  const [referenceRevision, setReferenceRevision] = useState<Revision | null>(null);
  const [form, setForm] = useState<RevisionFormState>(initialForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeSections, setActiveSections] = useState<SectionKey[]>(['context']);
  const [showPerimeterOptionals, setShowPerimeterOptionals] = useState(false);
  const [perimeterFormulaInfo, setPerimeterFormulaInfo] = useState<BodyFatFormulaReference | null>(null);
  const [skinfoldFormulaInfo, setSkinfoldFormulaInfo] = useState<BodyFatFormulaReference | null>(null);
  const [selectedPerimeterProtocolId, setSelectedPerimeterProtocolId] = useState<string>('');
  const [selectedSkinfoldProtocolId, setSelectedSkinfoldProtocolId] = useState<string>('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadCapturedAt, setUploadCapturedAt] = useState<Date | null>(new Date());
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<ClientPhoto[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<ClientPhoto[]>([]);
  const [isRemovingPhotoId, setIsRemovingPhotoId] = useState<string | null>(null);
  const [isCompositionGuideOpen, setIsCompositionGuideOpen] = useState(false);
  const primaryGuideZoom = useGuideZoomTransform();
  const secondaryGuideZoom = useGuideZoomTransform();
  const [guidePageIndex, setGuidePageIndex] = useState(0);
  const guideScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (isCompositionGuideOpen) {
      primaryGuideZoom.resetZoom();
      secondaryGuideZoom.resetZoom();
      setGuidePageIndex(0);
      guideScrollRef.current?.scrollTo({ x: 0, animated: false });
    }
    // Reinicia el zoom y la página cada vez que se abre la guía.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompositionGuideOpen]);

  useEffect(() => {
    async function loadContext() {
      if (!clientId || !user?.id) {
        setErrorMessage('No se ha seleccionado un cliente valido.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextClient = await clientsService.getById(clientId, user.id);

        if (!nextClient) {
          setErrorMessage('El cliente no existe o no pertenece al usuario autenticado.');
          setIsLoading(false);
          return;
        }

        setClient(nextClient);
        const [nextPerimeterFormulaInfo, nextSkinfoldFormulaInfo] = await Promise.all([
          bodyFatFormulasService.getByCode(getPerimeterFormulaCodeForSex(nextClient.sex)),
          bodyFatFormulasService.getByCode(getSkinfoldFormulaCodeForAthleteLevel(nextClient.athleteLevel)),
        ]);
        setPerimeterFormulaInfo(nextPerimeterFormulaInfo);
        setSkinfoldFormulaInfo(nextSkinfoldFormulaInfo);

        const nextRevisions = await revisionsService.listByClient(nextClient.id);
        setClientRevisions(nextRevisions);
        setReferenceRevision(nextRevisions.find((revision) => revision.id !== revisionId) ?? null);
        const latestClientRevision = nextRevisions[0] ?? null;

        if (mode === 'create') {
          setSelectedPerimeterProtocolId('');
          setSelectedSkinfoldProtocolId('');
          setForm((currentForm) => ({
            ...currentForm,
            phase:
              currentForm.phase ||
              normalizeRevisionPhase(latestClientRevision?.phase) ||
              REVISION_PHASE_OPTIONS[0].value,
            reviewedAt: formatDateForInput(new Date()),
          }));
        }

        if (mode === 'edit' && revisionId) {
          const revision = await revisionsService.getById(revisionId);

          if (!revision || revision.clientId !== nextClient.id) {
            throw new Error('La revision no existe o no pertenece a este cliente.');
          }

          const revisionSkinfoldFormula = revision.skinfoldFormulaId
            ? await bodyFatFormulasService.getById(revision.skinfoldFormulaId)
            : null;

          setForm(mapRevisionToForm(revision));
          setSelectedPerimeterProtocolId(getInitialPerimeterProtocolId(revision));
          setSelectedSkinfoldProtocolId(
            getInitialSkinfoldProtocolId(revision, nextClient.athleteLevel, revisionSkinfoldFormula?.code ?? nextSkinfoldFormulaInfo?.code)
          );
          setExistingPhotos(await photosService.listByRevision(revisionId, user.id));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo cargar el formulario de revision.';
        setErrorMessage(message);
      } finally {
        setIsLoading(false);
      }
    }

    void loadContext();
  }, [clientId, mode, revisionId, user?.id]);

  async function handleSubmit() {
    if (!client) {
      setErrorMessage('No se ha encontrado el cliente de esta revision.');
      return;
    }

    if (!user) {
      setErrorMessage('Necesitas iniciar sesion para guardar la revision.');
      return;
    }

    const normalizedPhase = normalizeRevisionPhase(form.phase);

    if (!isRevisionPhase(normalizedPhase)) {
      setErrorMessage('Selecciona una fase valida para la revision.');
      return;
    }

    const weightKg = parseNullableNumber(form.weightKg);

    if (mode === 'create' && weightKg === null) {
      setErrorMessage('Indica un peso para crear la revision.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const payload = {
        clientId: client.id,
        phase: normalizedPhase,
        reviewedAt: parseDateInputToIso(form.reviewedAt),
        weightKg,
        neckCm: selectedPerimeterProtocolId ? parseNullableNumber(form.neckCm) : null,
        armCm: selectedPerimeterProtocolId ? parseNullableNumber(form.armCm) : null,
        waistCm: selectedPerimeterProtocolId ? parseNullableNumber(form.waistCm) : null,
        bellyCm: selectedPerimeterProtocolId ? parseNullableNumber(form.bellyCm) : null,
        pelvisCm: selectedPerimeterProtocolId ? parseNullableNumber(form.pelvisCm) : null,
        gluteCm: selectedPerimeterProtocolId ? parseNullableNumber(form.gluteCm) : null,
        thighCm: selectedPerimeterProtocolId ? parseNullableNumber(form.thighCm) : null,
        bicepFoldMm: selectedSkinfoldProtocolId ? parseNullableNumber(form.bicepFoldMm) : null,
        tricepFoldMm: selectedSkinfoldProtocolId ? parseNullableNumber(form.tricepFoldMm) : null,
        subscapularFoldMm: selectedSkinfoldProtocolId ? parseNullableNumber(form.subscapularFoldMm) : null,
        abdominalFoldMm: selectedSkinfoldProtocolId ? parseNullableNumber(form.abdominalFoldMm) : null,
        suprailiacFoldMm: selectedSkinfoldProtocolId ? parseNullableNumber(form.suprailiacFoldMm) : null,
        frontThighFoldMm: selectedSkinfoldProtocolId ? parseNullableNumber(form.frontThighFoldMm) : null,
        calfFoldMm: selectedSkinfoldProtocolId ? parseNullableNumber(form.calfFoldMm) : null,
        bodyFatVisualPct: parseNullableNumber(form.bodyFatVisualPct),
        activityFactor: isSupportedActivityFactor(activityFactorValue) ? Number((activityFactorValue ?? 0).toFixed(2)) : null,
        maintenanceKcal: parseNullableNumber(form.maintenanceKcal),
        maintenanceKcalEstimated: maintenanceEstimate,
        targetKcal: parseNullableNumber(form.targetKcal),
        perimeterFormulaId: selectedPerimeterProtocolId ? perimeterFormulaInfo?.id ?? null : null,
        skinfoldFormulaId: selectedSkinfoldProtocolId ? skinfoldFormulaInfo?.id ?? null : null,
        notes: form.notes.trim() || null,
      };

      if (mode === 'create') {
        // La preparación se resuelve sola en BBDD (trigger assign_revision_preparation): si la fase
        // es "Inicio" cierra la preparación abierta del cliente y abre una nueva; si no, se cuelga
        // de la que ya estuviera en curso.
        const createdRevision = await revisionsService.create({
          ...payload,
          ownerId: user.id,
        });

        if (pendingPhotos.length > 0) {
          await Promise.all(
            pendingPhotos.map((photo) =>
              photosService.updateRevision({
                photoId: photo.id,
                ownerId: user.id,
                revisionId: createdRevision.id,
              })
            )
          );
          setPendingPhotos([]);
        }

        router.replace(`/revisions/${createdRevision.id}`);
        return;
      }

      if (!revisionId) {
        throw new Error('No se ha encontrado la revision a editar.');
      }

      await revisionsService.update(revisionId, {
        ...payload,
        ownerId: user.id,
      });
      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo guardar la revision.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function openUploadModal() {
    const revisionDateFallback = form.reviewedAt ? parseDateOrNow(form.reviewedAt) : new Date();
    setUploadCapturedAt(revisionDateFallback);
    setIsUploadModalOpen(true);
  }

  function closeUploadModal() {
    setIsUploadModalOpen(false);
  }

  async function handleRemovePendingPhoto(photo: ClientPhoto) {
    if (!user?.id || isRemovingPhotoId) {
      return;
    }

    setIsRemovingPhotoId(photo.id);

    try {
      await photosService.remove(photo.id, user.id);
      setPendingPhotos((currentPhotos) => currentPhotos.filter((current) => current.id !== photo.id));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo quitar la imagen.';
      setErrorMessage(message);
    } finally {
      setIsRemovingPhotoId(null);
    }
  }

  async function uploadPickedAssets(assets: PickedImageAsset[]) {
    if (!user?.id || !client || isUploadingPhoto || assets.length === 0) {
      return;
    }

    if (!uploadCapturedAt) {
      setErrorMessage('Selecciona una fecha para la imagen.');
      return;
    }

    setErrorMessage(null);
    setIsUploadingPhoto(true);

    try {
      const uploadedPhotos = await photosService.uploadManyFromDevice({
        ownerId: user.id,
        clientId: client.id,
        revisionId: mode === 'edit' ? revisionId ?? null : null,
        assets,
        capturedAt: toDateOnlyIso(uploadCapturedAt),
      });

      if (mode === 'create') {
        setPendingPhotos((currentPhotos) => [...currentPhotos, ...uploadedPhotos]);
      } else {
        setExistingPhotos((currentPhotos) => [...uploadedPhotos, ...currentPhotos]);
      }

      closeUploadModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo subir la imagen.';
      setErrorMessage(message);
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  async function handlePickFromLibrary() {
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

    await uploadPickedAssets(result.assets);
  }

  function handleOpenCamera() {
    if (!uploadCapturedAt) {
      setErrorMessage('Selecciona una fecha para la imagen.');
      return;
    }

    setErrorMessage(null);
    setIsUploadModalOpen(false);
    setIsCameraModalOpen(true);
  }

  async function handleFinishCameraSession(shots: CameraCaptureShot[]) {
    setIsCameraModalOpen(false);
    await uploadPickedAssets(shots);
  }

  const { setField } = sectionFields(form, setForm);
  const isCreateMode = mode === 'create';
  const isWide = width >= 960;
  const isMedium = width >= 720;
  const compositionGuidePanelWidth = Math.min(width - 24, 920);
  const compositionGuideImageHeight = Math.min(height * 0.34, 380);
  const compositionGuidePageWidth = compositionGuidePanelWidth - Spacing.three * 2;
  const reviewedAtDate = form.reviewedAt ? new Date(form.reviewedAt) : null;
  const referencePlaceholders = useMemo<RevisionReferencePlaceholders | null>(() => {
    if (mode !== 'create' || !referenceRevision) {
      return null;
    }

    return {
      weightKg: toInputValue(referenceRevision.weightKg),
      neckCm: toInputValue(referenceRevision.neckCm),
      armCm: toInputValue(referenceRevision.armCm),
      waistCm: toInputValue(referenceRevision.waistCm),
      bellyCm: toInputValue(referenceRevision.bellyCm),
      pelvisCm: toInputValue(referenceRevision.pelvisCm),
      gluteCm: toInputValue(referenceRevision.gluteCm),
      thighCm: toInputValue(referenceRevision.thighCm),
      bicepFoldMm: toInputValue(referenceRevision.bicepFoldMm),
      tricepFoldMm: toInputValue(referenceRevision.tricepFoldMm),
      subscapularFoldMm: toInputValue(referenceRevision.subscapularFoldMm),
      abdominalFoldMm: toInputValue(referenceRevision.abdominalFoldMm),
      suprailiacFoldMm: toInputValue(referenceRevision.suprailiacFoldMm),
      frontThighFoldMm: toInputValue(referenceRevision.frontThighFoldMm),
      calfFoldMm: toInputValue(referenceRevision.calfFoldMm),
      bodyFatVisualPct: toInputValue(referenceRevision.bodyFatVisualPct),
      activityFactor: toInputValue(referenceRevision.activityFactor),
      maintenanceKcal: toInputValue(referenceRevision.maintenanceKcal),
      targetKcal: toInputValue(referenceRevision.targetKcal),
      phase: normalizeRevisionPhase(referenceRevision.phase),
      reviewedAt: formatDateForDisplay(new Date(referenceRevision.reviewedAt ?? Date.now())),
      notes: referenceRevision.notes?.trim() ? truncateText(referenceRevision.notes.trim()) : '',
    };
  }, [mode, referenceRevision]);
  const perimeterFieldGroups = useMemo(() => {
    const fieldKeys = getPerimeterFieldKeysForSex(client?.sex);

    return {
      required: fieldKeys.required.map((key) => PERIMETER_FIELD_BY_KEY[key]),
      optional: fieldKeys.optional.map((key) => PERIMETER_FIELD_BY_KEY[key]),
    };
  }, [client?.sex]);
  const completedRequiredPerimeters = countCompletedFields(form, perimeterFieldGroups.required);
  const availableSkinfoldProtocols = useMemo(
    () => getAvailableSkinfoldProtocolsForAthleteLevel(client?.athleteLevel),
    [client?.athleteLevel]
  );
  const isPerimeterProtocolSelected = selectedPerimeterProtocolId === PERIMETER_PROTOCOL_ID;
  const selectedSkinfoldProtocol = useMemo(
    () => availableSkinfoldProtocols.find((protocol) => protocol.id === selectedSkinfoldProtocolId) ?? null,
    [availableSkinfoldProtocols, selectedSkinfoldProtocolId]
  );
  const activeSkinfoldFields = useMemo(
    () => (selectedSkinfoldProtocol ? selectedSkinfoldProtocol.fields.map((key) => SKINFOLD_FIELD_BY_KEY[key]) : []),
    [selectedSkinfoldProtocol]
  );
  const activeSkinfoldFieldKeySet = useMemo(
    () => new Set(selectedSkinfoldProtocol?.fields ?? []),
    [selectedSkinfoldProtocol]
  );
  const completedSkinfolds = countCompletedFields(form, activeSkinfoldFields);
  const currentPerimeterFormulaId = isPerimeterProtocolSelected ? perimeterFormulaInfo?.id ?? null : null;
  const currentSkinfoldFormulaId = selectedSkinfoldProtocol?.formulaCode ? skinfoldFormulaInfo?.id ?? null : null;
  const activityFactorValue = parseFieldValue(form.activityFactor);
  const perimeterFormulaContent = useMemo(
    () =>
      isPerimeterProtocolSelected
        ? buildBodyFatFormulaInfoContent(perimeterFormulaInfo?.code ?? getPerimeterFormulaCodeForSex(client?.sex), { sex: client?.sex, age: getClientAge(client, reviewedAtDate ?? new Date()) })
        : null,
    [client, isPerimeterProtocolSelected, perimeterFormulaInfo?.code, reviewedAtDate]
  );
  const skinfoldFormulaContent = useMemo(
    () => buildBodyFatFormulaInfoContent(selectedSkinfoldProtocol?.formulaCode ?? skinfoldFormulaInfo?.code, { sex: client?.sex, age: getClientAge(client, reviewedAtDate ?? new Date()) }),
    [client, selectedSkinfoldProtocol?.formulaCode, skinfoldFormulaInfo?.code, reviewedAtDate]
  );
  const perimeterCalculation = useMemo(() => {
    if (!isPerimeterProtocolSelected || (client?.sex !== 'female' && client?.sex !== 'male')) {
      return null;
    }

    return calculateBodyFatFromPerimeters(client.sex, {
      neckCm: parseFieldValue(form.neckCm),
      bellyCm: parseFieldValue(form.bellyCm),
      gluteCm: parseFieldValue(form.gluteCm),
      heightCm: client.heightCm,
    });
  }, [client?.heightCm, client?.sex, form.bellyCm, form.gluteCm, form.neckCm, isPerimeterProtocolSelected]);
  const previousComparablePerimeterRevision = useMemo(
    () => findPreviousComparableRevisionByPerimeterFormula(clientRevisions, revisionId, currentPerimeterFormulaId),
    [clientRevisions, currentPerimeterFormulaId, revisionId]
  );
  const previousPerimeterCalculation = useMemo(() => {
    if ((client?.sex !== 'female' && client?.sex !== 'male') || !previousComparablePerimeterRevision) {
      return null;
    }

    return calculateBodyFatFromPerimeters(client.sex, {
      neckCm: previousComparablePerimeterRevision.neckCm,
      bellyCm: previousComparablePerimeterRevision.bellyCm,
      gluteCm: previousComparablePerimeterRevision.gluteCm,
      heightCm: client.heightCm,
    });
  }, [client?.heightCm, client?.sex, previousComparablePerimeterRevision]);
  const skinfoldCalculation = useMemo(() => {
    if (!selectedSkinfoldProtocol || (client?.sex !== 'female' && client?.sex !== 'male')) {
      return null;
    }

    return calculateBodyFatFromSkinfolds(client.sex, getClientAge(client, reviewedAtDate ?? new Date()), {
      bicepFoldMm: activeSkinfoldFieldKeySet.has('bicepFoldMm') ? parseFieldValue(form.bicepFoldMm) : null,
      tricepFoldMm: parseFieldValue(form.tricepFoldMm),
      subscapularFoldMm: parseFieldValue(form.subscapularFoldMm),
      suprailiacFoldMm: parseFieldValue(form.suprailiacFoldMm),
      abdominalFoldMm: parseFieldValue(form.abdominalFoldMm),
      frontThighFoldMm: activeSkinfoldFieldKeySet.has('frontThighFoldMm') ? parseFieldValue(form.frontThighFoldMm) : null,
      calfFoldMm: activeSkinfoldFieldKeySet.has('calfFoldMm') ? parseFieldValue(form.calfFoldMm) : null,
    });
  }, [
    client?.birthDate,
    client?.sex,
    activeSkinfoldFieldKeySet,
    selectedSkinfoldProtocol,
    reviewedAtDate,
    form.bicepFoldMm,
    form.abdominalFoldMm,
    form.calfFoldMm,
    form.frontThighFoldMm,
    form.subscapularFoldMm,
    form.suprailiacFoldMm,
    form.tricepFoldMm,
  ]);
  const previousComparableSkinfoldRevision = useMemo(
    () => findPreviousComparableRevisionBySkinfoldFormula(clientRevisions, revisionId, currentSkinfoldFormulaId),
    [clientRevisions, currentSkinfoldFormulaId, revisionId]
  );
  const previousSkinfoldCalculation = useMemo(() => {
    if ((client?.sex !== 'female' && client?.sex !== 'male') || !previousComparableSkinfoldRevision || !selectedSkinfoldProtocol) {
      return null;
    }

    return calculateBodyFatFromSkinfolds(client.sex, getClientAge(client, reviewedAtDate ?? new Date()), {
      bicepFoldMm: activeSkinfoldFieldKeySet.has('bicepFoldMm') ? previousComparableSkinfoldRevision.bicepFoldMm : null,
      tricepFoldMm: previousComparableSkinfoldRevision.tricepFoldMm,
      subscapularFoldMm: previousComparableSkinfoldRevision.subscapularFoldMm,
      suprailiacFoldMm: previousComparableSkinfoldRevision.suprailiacFoldMm,
      abdominalFoldMm: previousComparableSkinfoldRevision.abdominalFoldMm,
      frontThighFoldMm: activeSkinfoldFieldKeySet.has('frontThighFoldMm') ? previousComparableSkinfoldRevision.frontThighFoldMm : null,
      calfFoldMm: activeSkinfoldFieldKeySet.has('calfFoldMm') ? previousComparableSkinfoldRevision.calfFoldMm : null,
    });
  }, [activeSkinfoldFieldKeySet, client?.birthDate, client?.sex, previousComparableSkinfoldRevision, selectedSkinfoldProtocol, reviewedAtDate]);
  const skinfoldDifference =
    skinfoldCalculation && previousSkinfoldCalculation
      ? skinfoldCalculation.roundedBodyFatPct - previousSkinfoldCalculation.roundedBodyFatPct
      : null;
  const perimeterDifference =
    perimeterCalculation && previousPerimeterCalculation
      ? perimeterCalculation.roundedBodyFatPct - previousPerimeterCalculation.roundedBodyFatPct
      : null;
  const maintenanceEstimate = useMemo(
    () => calculateMaintenanceCalories({
      sex: client?.sex,
      weightKg: parseFieldValue(form.weightKg),
      heightCm: client?.heightCm,
      age: getClientAge(client, reviewedAtDate ?? new Date()),
      activityFactor: activityFactorValue,
    }),
    [activityFactorValue, client?.birthDate, client?.heightCm, client?.sex, form.weightKg, reviewedAtDate]
  );

  function renderWeightField() {
    return (
      <View style={[styles.contextCell, isMedium && styles.contextCellHalf]}>
        <AppInput
          label="Peso (kg)"
          hint={isCreateMode ? 'Obligatorio para crear la revision' : undefined}
          placeholder={referencePlaceholders?.weightKg ?? '61.2'}
          keyboardType="decimal-pad"
          unit="kg"
          value={form.weightKg}
          onChangeText={(value) => setField('weightKg', value)}
          containerStyle={styles.contextFieldShell}
          style={styles.compactInputText}
          affixTextStyle={styles.compactAffixText}
        />
      </View>
    );
  }

  function renderFieldGrid(
    fields: RevisionFieldConfig[],
    mobileColumns: 1 | 2 = 2,
    tone: 'primary' | 'secondary' = 'primary'
  ) {
    return (
      <View style={styles.fieldGrid}>
        {fields.map((field) => {
          const isSecondary = tone === 'secondary';

          return (
            <View
              key={field.key}
              style={[
                styles.fieldCard,
                isWide
                  ? styles.fieldCardThird
                  : mobileColumns === 2
                    ? styles.fieldCardHalf
                    : styles.fieldCardFull,
              ]}>
              <AppInput
                label={stripFieldLabel(field.label)}
                placeholder={referencePlaceholders?.[field.key] ?? field.placeholder}
                keyboardType="decimal-pad"
                unit={getFieldUnit(field.key) || undefined}
                value={form[field.key]}
                onChangeText={(value) => setField(field.key, value)}
                containerStyle={
                  field.key === 'bodyFatVisualPct'
                    ? styles.compactPrimaryFieldShell
                    : isSecondary
                      ? styles.compactSecondaryFieldShell
                      : styles.compactFieldShell
                }
                style={field.key === 'bodyFatVisualPct' ? styles.compactPrimaryInputText : styles.compactInputText}
                affixTextStyle={styles.compactAffixText}
              />
            </View>
          );
        })}
      </View>
    );
  }

  function renderImagesSectionBody() {
    const photos = mode === 'create' ? pendingPhotos : existingPhotos;

    return (
      <View style={styles.imagesSectionBody}>
        {photos.length > 0 ? (
          <View style={styles.imagesGrid}>
            {photos.map((photo) => (
              <View key={photo.id} style={styles.imageTile}>
                <Image source={{ uri: photo.imageUrl }} style={styles.imageTilePhoto} contentFit="cover" transition={150} />
                {mode === 'create' ? (
                  <Pressable
                    onPress={() => void handleRemovePendingPhoto(photo)}
                    disabled={isRemovingPhotoId === photo.id}
                    accessibilityRole="button"
                    accessibilityLabel="Quitar esta imagen"
                    style={styles.imageTileRemove}>
                    <Ionicons name={isRemovingPhotoId === photo.id ? 'hourglass-outline' : 'close'} size={13} color="#FFFFFF" />
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary" style={styles.imagesEmpty}>
            Aún no se han añadido fotos a esta revisión.
          </ThemedText>
        )}

        <Pressable
          onPress={openUploadModal}
          accessibilityRole="button"
          accessibilityLabel="Añadir imagen a la revisión"
          style={({ pressed }) => [styles.imagesAddButton, pressed && { opacity: 0.85 }]}>
          <Ionicons name="add-circle-outline" size={18} color={Accent.primary} />
          <ThemedText type="smallBold" style={styles.imagesAddButtonText}>Añadir imagen</ThemedText>
        </Pressable>

        <ThemedText type="small" themeColor="textSecondary" style={styles.imagesEmpty}>
          {mode === 'create'
            ? 'Se enlazan a la revisión al guardarla.'
            : 'Se asocian a esta revisión en cuanto se suben.'}
        </ThemedText>
      </View>
    );
  }

  function renderSectionCard(
    sectionKey: SectionKey,
    title: string,
    children: React.ReactNode
  ) {
    const isOpen = activeSections.includes(sectionKey);
    const sectionIcon =
      sectionKey === 'context'
        ? 'clipboard-outline'
        : sectionKey === 'composition'
          ? 'body-outline'
          : sectionKey === 'perimeters'
            ? 'resize-outline'
            : sectionKey === 'skinfolds'
              ? 'analytics-outline'
              : sectionKey === 'images'
                ? 'images-outline'
                : 'document-text-outline';
    const sectionHint =
      sectionKey === 'context'
        ? 'Cliente, fecha, fase y peso'
        : sectionKey === 'composition'
          ? 'Composición visual y energía'
          : sectionKey === 'perimeters'
            ? 'Perímetros y análisis automático'
            : sectionKey === 'skinfolds'
              ? 'Pliegues y comparación'
              : sectionKey === 'images'
                ? 'Fotos de progreso de la sesión'
                : 'Observaciones de la sesión';
    const revisionPhotoCount = pendingPhotos.length + existingPhotos.length;
    const sectionProgress =
      sectionKey === 'context'
        ? [form.phase, form.reviewedAt, form.weightKg].filter((value) => value.trim()).length
        : sectionKey === 'composition'
          ? countCompletedFields(form, COMPOSITION_FIELDS)
          : sectionKey === 'perimeters'
            ? completedRequiredPerimeters
            : sectionKey === 'skinfolds'
              ? completedSkinfolds
              : sectionKey === 'images'
                ? revisionPhotoCount
                : form.notes.trim() ? 1 : 0;
    const sectionTotal =
      sectionKey === 'context'
        ? 3
        : sectionKey === 'composition'
          ? COMPOSITION_FIELDS.length
          : sectionKey === 'perimeters'
            ? perimeterFieldGroups.required.length
            : sectionKey === 'skinfolds'
              ? activeSkinfoldFields.length
              : sectionKey === 'images'
                ? null
                : 1;

    function toggleSection() {
      setActiveSections((currentSections) =>
        currentSections.includes(sectionKey)
          ? []
          : [sectionKey]
      );
    }

    return (
      <View style={[styles.sectionCard, styles.sectionCardCreate, { borderColor: theme.backgroundSelected }]}>
        <Pressable
          onPress={toggleSection}
          accessibilityRole="button"
          accessibilityLabel={`${isOpen ? 'Cerrar' : 'Abrir'} sección ${title}`}
          style={({ pressed }) => [
            styles.sectionToggle,
            styles.sectionToggleCreate,
            { opacity: pressed ? 0.92 : 1 },
          ]}>
          <View style={styles.sectionTitleArea}>
            <View style={[styles.sectionIconWrap, isOpen && styles.sectionIconWrapActive]}>
              <Ionicons name={sectionIcon} size={18} color={isOpen ? '#FFFFFF' : Accent.primary} />
            </View>
            <View style={styles.sectionTitleBlock}>
              <ThemedText type="smallBold" style={styles.sectionTitle}>{title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.sectionHint}>
                {sectionHint}
              </ThemedText>
            </View>
          </View>
          <View style={styles.sectionToggleMeta}>
            <View style={styles.sectionCountPill}>
              <ThemedText type="smallBold" style={styles.sectionCountText}>
                {sectionTotal === null ? sectionProgress : `${sectionProgress}/${sectionTotal || '—'}`}
              </ThemedText>
            </View>
            <Ionicons
              name={isOpen ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={isOpen ? Accent.primary : '#7B8AA0'}
            />
          </View>
        </Pressable>
        {isOpen ? <View style={styles.sectionBody}>{children}</View> : null}
      </View>
    );
  }

  function renderContextSectionBody() {
    return (
      <>
      <View style={styles.phaseSelectWrap}>
        <PhaseSelect
          value={form.phase}
          onChange={(value) => setField('phase', normalizeRevisionPhase(value))}
          showPreparationInfo={isCreateMode}
        />
      </View>
      <View style={styles.contextGrid}>
        <View style={[styles.contextCell, isMedium && styles.contextCellHalf]}>
          <AppDateTimeInput
            label="Fecha"
            value={reviewedAtDate}
            onChange={(nextDate) => setField('reviewedAt', formatDateForInput(nextDate))}
            mode="date"
            shellStyle={styles.compactDateTimeShell}
            valueStyle={styles.compactDateTimeValue}
          />
        </View>
        {renderWeightField()}
      </View>
    </>
    );
  }

  function renderSkinfoldProtocolSelector() {
    return (
      <View style={styles.skinfoldSelectorBlock}>
        <View style={styles.skinfoldSelectorHeader}>
          <ThemedText type="smallBold" style={styles.skinfoldSelectorTitle}>Protocolo de pliegues</ThemedText>
          {selectedSkinfoldProtocol && skinfoldFormulaInfo ? (
            <FormulaInfoButton
              title={skinfoldFormulaInfo.title}
              descriptionLines={skinfoldFormulaInfo.descriptionLines}
              content={skinfoldFormulaContent}
              accessibilityLabel="Información sobre la fórmula de pliegues"
            />
          ) : null}
        </View>
        <AppSelect
          label="Selecciona protocolo"
          hideLabel
          value={selectedSkinfoldProtocolId}
          options={availableSkinfoldProtocols.map((protocol) => ({
            label: protocol.comingSoon ? `${protocol.label} · Próximamente` : protocol.label,
            value: protocol.id,
            disabled: !protocol.enabled,
          }))}
          placeholder="Seleccionar protocolo"
          onChange={setSelectedSkinfoldProtocolId}
          containerStyle={styles.skinfoldSelectShell}
          pickerTextStyle={styles.skinfoldSelectText}
        />
      </View>
    );
  }

  function renderPerimeterProtocolSelector() {
    return (
      <View style={styles.skinfoldSelectorBlock}>
        <View style={styles.skinfoldSelectorHeader}>
          <ThemedText type="smallBold" style={styles.skinfoldSelectorTitle}>Protocolo de perímetros</ThemedText>
          {isPerimeterProtocolSelected && perimeterFormulaInfo ? (
            <FormulaInfoButton
              title={perimeterFormulaInfo.title}
              descriptionLines={perimeterFormulaInfo.descriptionLines}
              content={perimeterFormulaContent}
              accessibilityLabel="Información sobre la fórmula de perímetros"
            />
          ) : null}
        </View>
        <AppSelect
          label="Selecciona protocolo"
          hideLabel
          value={selectedPerimeterProtocolId}
          options={PERIMETER_PROTOCOL_OPTIONS.map((protocol) => ({
            label: protocol.label,
            value: protocol.value,
          }))}
          placeholder="Seleccionar protocolo"
          onChange={setSelectedPerimeterProtocolId}
          containerStyle={styles.skinfoldSelectShell}
          pickerTextStyle={styles.skinfoldSelectText}
        />
      </View>
    );
  }

  function renderPerimeterSummary() {
    if (completedRequiredPerimeters < perimeterFieldGroups.required.length || !perimeterCalculation) {
      return null;
    }

    const deltaColor = getDeltaColor(perimeterDifference, 'decrease-is-better');

    return (
      <View style={[styles.autoSummaryCard, { borderColor: theme.backgroundSelected }]}> 
        <View style={styles.autoSummaryTopRow}>
          <View style={styles.autoSummaryCopy}>
            <View style={styles.autoSummaryLabelRow}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.autoSummaryLabel}>% grasa por perímetros</ThemedText>
              <ThemedText type="smallBold" style={styles.autoSummaryMiniLabel}>{perimeterFormulaInfo?.shortLabel ?? 'Fórmula'}</ThemedText>
            </View>
            <ThemedText type="headline" style={styles.autoSummaryValue}>{perimeterCalculation.roundedBodyFatPct}%</ThemedText>
          </View>
        </View>
        {previousPerimeterCalculation ? (
          <View style={styles.autoSummaryMetaLine}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.autoSummaryMetaText}>
              Última {previousPerimeterCalculation.roundedBodyFatPct}%
            </ThemedText>
            <ThemedText type="smallBold" style={[styles.autoSummaryInlineChange, { color: deltaColor }]}>
              {perimeterDifference !== null ? `${perimeterDifference >= 0 ? '+' : ''}${perimeterDifference}%` : '0%'}
            </ThemedText>
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary" style={styles.autoSummaryMetaText}>
            {previousComparablePerimeterRevision ? 'Sin referencia comparable' : 'Sin revisión previa con la misma fórmula'}
          </ThemedText>
        )}
      </View>
    );
  }

  function renderSkinfoldSummary() {
    if (!selectedSkinfoldProtocol || completedSkinfolds < activeSkinfoldFields.length || !skinfoldCalculation) {
      return null;
    }

    const deltaColor = getDeltaColor(skinfoldDifference, 'decrease-is-better');

    return (
      <View style={[styles.autoSummaryCard, { borderColor: theme.backgroundSelected }]}> 
        <View style={styles.autoSummaryTopRow}>
          <View style={styles.autoSummaryCopy}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.autoSummaryLabel}>% grasa por pliegues</ThemedText>
            <ThemedText type="headline" style={styles.autoSummaryValue}>{skinfoldCalculation.roundedBodyFatPct}%</ThemedText>
          </View>
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={styles.autoSummaryMetaText}>
          Suma pliegues: {formatNumber(skinfoldCalculation.sumMm)} mm
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.autoSummaryMetaText}>
          Densidad corporal: {formatNumber(skinfoldCalculation.bodyDensity)}
        </ThemedText>
        {previousSkinfoldCalculation ? (
          <View style={styles.autoSummaryMetaLine}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.autoSummaryMetaText}>
              Última {previousSkinfoldCalculation.roundedBodyFatPct}%
            </ThemedText>
            <ThemedText type="smallBold" style={[styles.autoSummaryInlineChange, { color: deltaColor }]}>
              {skinfoldDifference !== null ? `${skinfoldDifference >= 0 ? '+' : ''}${skinfoldDifference}%` : '0%'}
            </ThemedText>
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary" style={styles.autoSummaryMetaText}>
            {previousComparableSkinfoldRevision ? 'Sin referencia comparable' : 'Sin revisión previa con la misma fórmula'}
          </ThemedText>
        )}
      </View>
    );
  }

  if (isLoading) {
    return (
      <ScreenContainer>
        <PageHeader title="Cargando..." />
        <PageSection first>
          <StatusBanner tone="info" loading message="Preparando el formulario..." />
        </PageSection>
      </ScreenContainer>
    );
  }

  if (!client) {
    return (
      <ScreenContainer>
        <EmptyState
          title="Cliente no disponible"
          description={errorMessage ?? 'No se ha podido cargar el cliente asociado a esta revision.'}
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
        <AppButton label="Cancelar" variant="ghost" size="compact" fullWidth={false} onPress={() => router.back()} disabled={isSubmitting} />
      </View>

      <View style={[styles.headerCard, styles.headerCardCreate, { borderColor: theme.backgroundSelected }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerIconWrap}>
            <Ionicons name={mode === 'create' ? 'add-circle-outline' : 'create-outline'} size={26} color={Accent.primary} />
          </View>
          <View style={styles.headerCopy}>
            <ThemedText type="label" style={styles.headerEyebrow}>{mode === 'create' ? 'Nueva evaluación' : 'Actualización'}</ThemedText>
            <ThemedText type="headline" style={styles.headerTitle}>{mode === 'create' ? 'Crear revisión' : 'Editar revisión'}</ThemedText>
          </View>
        </View>

        <View style={styles.headerMetaGrid}>
          <View style={styles.headerMetaItem}>
            <ThemedText type="small" themeColor="textSecondary">Cliente</ThemedText>
            <ThemedText type="smallBold" style={styles.headerMetaValue}>{client.name}</ThemedText>
          </View>
          <View style={styles.headerMetaItem}>
            <ThemedText type="small" themeColor="textSecondary">Fecha</ThemedText>
            <ThemedText type="smallBold" style={styles.headerMetaValue}>
              {reviewedAtDate ? formatDateForDisplay(reviewedAtDate) : 'Sin fecha'}
            </ThemedText>
          </View>
        </View>
      </View>

      {isCreateMode ? (
        <View style={[styles.createGuide, { borderColor: theme.backgroundSelected }]}>
          <View style={styles.guideStep}>
            <Ionicons name="checkmark-circle-outline" size={16} color={Accent.primary} />
            <ThemedText type="smallBold" style={styles.guideText}>Contexto</ThemedText>
          </View>
          <View style={styles.guideStep}>
            <Ionicons name="resize-outline" size={16} color={Accent.primary} />
            <ThemedText type="smallBold" style={styles.guideText}>Medidas</ThemedText>
          </View>
          <View style={styles.guideStep}>
            <Ionicons name="save-outline" size={16} color={Accent.primary} />
            <ThemedText type="smallBold" style={styles.guideText}>Guardar</ThemedText>
          </View>
        </View>
      ) : null}

      {isSubmitting ? <StatusBanner tone="info" loading message="Guardando revision..." /> : null}

      <View style={styles.formCanvas}>

      {renderSectionCard('context', 'Contexto', renderContextSectionBody())}

      {renderSectionCard(
        'composition',
        'Composición',
        <View style={styles.compositionSectionBody}>
          <View style={styles.compositionGuideRow}>
            <View style={styles.compositionGuideCopy}>
              <ThemedText type="smallBold" style={styles.compositionGuideTitle}>
                Apoyo visual para estimar la grasa
              </ThemedText>
            </View>
            <AppButton
              label="Guia"
              variant="surface"
              size="compact"
              fullWidth={false}
              onPress={() => setIsCompositionGuideOpen(true)}
            />
          </View>
          {renderFieldGrid(COMPOSITION_FIELDS, 1)}
        </View>
      )}

      {renderSectionCard(
        'perimeters',
        'Perímetros',
        <View style={styles.perimetersSectionBody}>
          {renderPerimeterProtocolSelector()}
          {isPerimeterProtocolSelected ? (
            <>
              <View style={[styles.measureGroup, styles.measureGroupPrimary, { borderColor: theme.backgroundSelected }]}>
                <View style={styles.measureGroupHeader}>
                  <View style={styles.measureGroupHeaderCopy}>
                    <View style={styles.measureGroupTitleRow}>
                      <ThemedText type="smallBold" style={styles.measureGroupTitle}>Usadas en cálculo</ThemedText>
                    </View>
                  </View>
                  <View style={styles.measureGroupCountPill}>
                    <ThemedText type="smallBold" style={styles.measureGroupCountText}>
                      {completedRequiredPerimeters}/{perimeterFieldGroups.required.length}
                    </ThemedText>
                  </View>
                </View>
                {renderFieldGrid(perimeterFieldGroups.required, 2)}
              </View>
              {renderPerimeterSummary()}
              <Pressable
                onPress={() => setShowPerimeterOptionals((currentValue) => !currentValue)}
                style={({ pressed }) => [styles.optionalsToggle, { opacity: pressed ? 0.78 : 1 }]}>
                <ThemedText type="smallBold" style={styles.optionalsToggleText}>
                  {showPerimeterOptionals ? 'Ocultar perímetros opcionales' : 'Añadir perímetros opcionales'}
                </ThemedText>
                <ThemedText type="smallBold" style={styles.optionalsToggleIcon}>
                  {showPerimeterOptionals ? '−' : '+'}
                </ThemedText>
              </Pressable>
              {showPerimeterOptionals ? (
                <View style={[styles.measureGroup, styles.measureGroupSecondary, { borderColor: theme.backgroundSelected }]}>
                  <View style={styles.measureGroupHeader}>
                    <ThemedText type="smallBold" style={[styles.measureGroupTitle, styles.measureGroupTitleSecondary]}>Opcionales</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">Secundarios</ThemedText>
                  </View>
                  {renderFieldGrid(perimeterFieldGroups.optional, 2, 'secondary')}
                </View>
              ) : null}
            </>
          ) : null}
        </View>
      )}

      {renderSectionCard(
        'skinfolds',
        'Pliegues cutáneos',
        <View style={styles.skinfoldSectionBody}>
          {renderSkinfoldProtocolSelector()}
          {activeSkinfoldFields.length > 0 ? renderFieldGrid(activeSkinfoldFields, 2) : null}
          {renderSkinfoldSummary()}
        </View>
      )}

      {renderSectionCard('images', 'Imágenes', renderImagesSectionBody())}

      {renderSectionCard(
        'notes',
        'Notas',
        <AppInput
          label="Observaciones"
          placeholder={referencePlaceholders?.notes || 'Añade contexto clinico o decisiones de ajuste'}
          multiline
          numberOfLines={4}
          style={styles.textArea}
          value={form.notes}
          onChangeText={(value) => setField('notes', value)}
          containerStyle={styles.notesShell}
        />
      )}

      {errorMessage ? <StatusBanner tone="danger" message={errorMessage} /> : null}

      <View style={[styles.footerCard, { borderColor: theme.backgroundSelected }]}>
        <View style={styles.footerHeaderRow}>
          <View style={styles.footerIconWrap}>
            <Ionicons name="checkmark-done-outline" size={20} color={Accent.primary} />
          </View>
          <View style={styles.footerCopy}>
            <ThemedText type="smallBold" style={styles.footerTitle}>
              {isCreateMode ? 'Todo listo para guardar' : 'Guardar cambios de la revisión'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.footerHint}>
              {isCreateMode
                ? 'Revisa los datos clave y guarda para generar la revisión completa del cliente.'
                : 'Los cambios se aplican al guardar, sin afectar al resto del historial.'}
            </ThemedText>
          </View>
        </View>
        <AppButton label={mode === 'create' ? 'Guardar revision' : 'Guardar cambios'} onPress={handleSubmit} loading={isSubmitting} />
      </View>
      </View>

      <Modal transparent visible={isUploadModalOpen} animationType="fade" onRequestClose={closeUploadModal}>
        <Pressable style={styles.modalBackdrop} onPress={closeUploadModal}>
          <Pressable style={[styles.modalPanel, { borderColor: theme.backgroundSelected }]} onPress={() => null}>
            <View style={styles.modalHeader}>
              <ThemedText type="smallBold">Subir imagen</ThemedText>
              <Pressable onPress={closeUploadModal} style={styles.modalCloseButton}>
                <ThemedText type="smallBold" style={styles.modalCloseText}>×</ThemedText>
              </Pressable>
            </View>

            <AppDateTimeInput
              label="Fecha"
              value={uploadCapturedAt}
              mode="date"
              helper="Preseleccionada a hoy"
              onChange={(value) => setUploadCapturedAt(value)}
            />

            <View style={styles.uploadSourceRow}>
              <Pressable
                onPress={() => void handlePickFromLibrary()}
                disabled={isUploadingPhoto}
                accessibilityRole="button"
                accessibilityLabel="Añadir desde la galería o archivos"
                style={({ pressed }) => [styles.uploadSourceOption, pressed && { opacity: 0.85 }]}>
                <View style={styles.uploadSourceIcon}>
                  {isUploadingPhoto ? (
                    <ActivityIndicator color={Accent.primary} size="small" />
                  ) : (
                    <Ionicons name="images-outline" size={20} color={Accent.primary} />
                  )}
                </View>
                <ThemedText type="smallBold" style={styles.uploadSourceLabel}>Galería o archivos</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleOpenCamera}
                disabled={isUploadingPhoto}
                accessibilityRole="button"
                accessibilityLabel="Hacer fotos con la cámara"
                style={({ pressed }) => [styles.uploadSourceOption, pressed && { opacity: 0.85 }]}>
                <View style={styles.uploadSourceIcon}>
                  <Ionicons name="camera-outline" size={20} color={Accent.primary} />
                </View>
                <ThemedText type="smallBold" style={styles.uploadSourceLabel}>Cámara</ThemedText>
              </Pressable>
            </View>

            <View style={styles.modalActions}>
              <AppButton label="Cancelar" variant="ghost" size="compact" fullWidth={false} onPress={closeUploadModal} disabled={isUploadingPhoto} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <CameraCaptureModal
        visible={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onFinish={(shots) => void handleFinishCameraSession(shots)}
      />

      <Modal transparent visible={isCompositionGuideOpen} animationType="fade" onRequestClose={() => setIsCompositionGuideOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setIsCompositionGuideOpen(false)}>
          <Pressable
            style={[styles.guideModalPanel, { borderColor: theme.backgroundSelected, maxWidth: compositionGuidePanelWidth }]}
            onPress={() => null}>
            <View style={styles.guideModalHeader}>
              <View style={styles.guideModalTitleBlock}>
                <ThemedText type="smallBold" style={styles.guideModalTitle}>
                  Guia composición
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.guideModalSubtitle}>
                  Referencia visual para valorar el porcentaje graso.
                </ThemedText>
              </View>
              <Pressable onPress={() => setIsCompositionGuideOpen(false)} style={styles.modalCloseButton}>
                <ThemedText type="smallBold" style={styles.modalCloseText}>×</ThemedText>
              </Pressable>
            </View>

            <GestureHandlerRootView style={{ height: compositionGuideImageHeight }}>
              <ScrollView
                ref={guideScrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                onMomentumScrollEnd={(event) => {
                  const nextIndex = Math.round(event.nativeEvent.contentOffset.x / compositionGuidePageWidth);
                  setGuidePageIndex(Math.min(Math.max(nextIndex, 0), 1));
                }}>
                <View style={{ width: compositionGuidePageWidth }}>
                  <ZoomableGuideImage
                    source={require('../../../assets/images/guia-composicion/porcentaje-graso.jpg')}
                    height={compositionGuideImageHeight}
                    gesture={primaryGuideZoom.gesture}
                    animatedStyle={primaryGuideZoom.animatedStyle}
                    onReset={primaryGuideZoom.resetZoom}
                  />
                </View>
                <View style={{ width: compositionGuidePageWidth }}>
                  <ZoomableGuideImage
                    source={require('../../../assets/images/guia-composicion/comparativa-porcentaje-grasa.jpg')}
                    height={compositionGuideImageHeight}
                    gesture={secondaryGuideZoom.gesture}
                    animatedStyle={secondaryGuideZoom.animatedStyle}
                    onReset={secondaryGuideZoom.resetZoom}
                  />
                </View>
              </ScrollView>
            </GestureHandlerRootView>

            <View style={styles.guidePageDots}>
              {[0, 1].map((pageIndex) => (
                <View
                  key={pageIndex}
                  style={[styles.guidePageDot, pageIndex === guidePageIndex && styles.guidePageDotActive]}
                />
              ))}
            </View>

            <ThemedText type="small" themeColor="textSecondary" style={styles.guideZoomHint}>
              Desliza para ver la otra imagen y pellizca para hacer zoom.
            </ThemedText>

            <AppButton
              label="Cerrar guía"
              variant="ghost"
              size="compact"
              fullWidth={false}
              onPress={() => setIsCompositionGuideOpen(false)}
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
  formCanvas: {
    gap: 12,
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
  headerCardCreate: {
    backgroundColor: '#FFFFFF',
  },
  headerCardTopAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#2D66E0',
  },
  createGuide: {
    borderWidth: 1,
    borderColor: '#DFE7F2',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  guideStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.pill,
    backgroundColor: '#F6F9FE',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  guideText: {
    color: '#10203B',
    lineHeight: 16,
    fontSize: 12,
  },
  clientTag: {
    alignSelf: 'flex-start',
    marginTop: 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: '#D4E2FA',
    backgroundColor: '#EAF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clientTagText: {
    color: '#2A4E95',
    lineHeight: 16,
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
    flexShrink: 0,
  },
  backIcon: {
    color: Accent.primary,
    fontSize: 16,
    lineHeight: 16,
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
  headerSubtitle: {
    lineHeight: 18,
  },
  headerTitle: {
    color: '#10203B',
    fontSize: 31,
    lineHeight: 36,
  },
  headerMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E6EDF7',
  },
  headerMetaItem: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 120,
    borderRadius: 16,
    backgroundColor: '#F6F9FE',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  headerMetaValue: {
    color: '#10203B',
    lineHeight: 18,
  },
  contextCard: {
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
    marginTop: 8,
  },
  contextHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.one,
  },
  phaseSelectWrap: {
    marginBottom: 12,
  },
  contextGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  contextCell: {
    width: '100%',
  },
  contextCellHalf: {
    width: '48.7%',
  },
  contextCellThird: {
    width: '31.8%',
  },
  compactSelectShell: {
    minHeight: 54,
    borderRadius: Radius.medium,
    paddingHorizontal: 6,
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: '#DFE7F2',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  sectionCardCreate: {
    shadowColor: '#12336E',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  sectionToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  sectionToggleCreate: {
    backgroundColor: '#FFFFFF',
  },
  sectionTitleArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
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
  sectionTitleBlock: {
    flex: 1,
    gap: 2,
  },
  sectionTitle: {
    color: '#10203B',
    fontSize: 18,
    lineHeight: 23,
    flexShrink: 1,
  },
  sectionHint: {
    lineHeight: 17,
  },
  sectionHeaderRight: {
    flexShrink: 0,
  },
  sectionToggleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionCountPill: {
    borderRadius: Radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: '#EEF4FF',
  },
  sectionCountText: {
    color: Accent.primary,
    fontSize: 11,
    lineHeight: 14,
  },
  sectionChevron: {
    color: '#6C7A92',
    width: 20,
    textAlign: 'center',
  },
  sectionChevronOpen: {
    color: Accent.primary,
  },
  sectionBody: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#EDF2FB',
  },
  perimetersSectionBody: {
    gap: Spacing.two,
  },
  compositionSectionBody: {
    gap: Spacing.two,
  },
  compositionGuideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.medium,
    borderColor: '#DCE8FB',
    backgroundColor: '#F8FBFF',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  compositionGuideCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  compositionGuideTitle: {
    color: '#10203B',
    lineHeight: 18,
  },
  compositionGuideText: {
    lineHeight: 16,
  },
  formulaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
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
    lineHeight: 17,
  },
  measureGroup: {
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 11,
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
    gap: 8,
  },
  measureGroupHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  measureGroupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  measureGroupTitle: {
    color: '#10203B',
  },
  measureGroupTitleSecondary: {
    color: '#50627E',
  },
  measureGroupHint: {
    lineHeight: 17,
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
  skinfoldSectionBody: {
    gap: 8,
  },
  skinfoldSelectorBlock: {
    gap: 8,
  },
  skinfoldSelectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  skinfoldSelectorTitle: {
    color: Accent.ink,
  },
  skinfoldSelectShell: {
    minHeight: 54,
  },
  skinfoldSelectText: {
    fontSize: 14,
  },
  skinfoldSelectorHint: {
    lineHeight: 17,
  },
  compactSummaryBlock: {
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: '#FCFDFF',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
  },
  compactSummaryTitle: {
    color: Accent.ink,
  },
  compactSummaryMeta: {
    lineHeight: 13,
  },
  compactSummaryMicro: {
    lineHeight: 12,
  },
  autoSummaryCard: {
    borderWidth: 1,
    borderRadius: Radius.medium,
    backgroundColor: '#FBFCFE',
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 8,
  },
  autoSummaryEyebrow: {
    lineHeight: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  autoSummaryTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  autoSummaryCopy: {
    gap: 3,
  },
  autoSummaryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  autoSummaryMiniLabel: {
    color: Accent.primary,
    fontSize: 11,
    lineHeight: 14,
  },
  autoSummaryLabel: {
    lineHeight: 17,
  },
  autoSummaryValue: {
    color: Accent.ink,
    fontSize: 30,
    lineHeight: 34,
  },
  autoSummaryMetaText: {
    lineHeight: 13,
  },
  autoSummaryMetaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  autoSummaryInlineChange: {
    lineHeight: 13,
  },
  optionalsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  optionalsToggleText: {
    color: Accent.primary,
  },
  optionalsToggleIcon: {
    color: Accent.primary,
    width: 18,
    textAlign: 'center',
  },
  compositionSummaryRow: {
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: '#FCFDFF',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  compositionSummaryHeader: {
    gap: 1,
  },
  compositionMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  compositionMetricCard: {
    minWidth: 78,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: '#E9F0FA',
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 5,
    gap: 1,
    backgroundColor: '#FFFFFF',
  },
  compositionMetricLabel: {
    lineHeight: 13,
  },
  compositionMetricValue: {
    color: Accent.ink,
    lineHeight: 17,
  },
  compositionMetricMeta: {
    lineHeight: 12,
  },
  compositionMetricInlineChange: {
    lineHeight: 13,
  },
  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fieldCard: {
    gap: 4,
  },
  fieldCardFull: {
    width: '100%',
  },
  fieldCardHalf: {
    width: '47.9%',
  },
  fieldCardThird: {
    width: '32%',
  },
  contextFieldShell: {
    minHeight: 56,
    borderRadius: Radius.medium,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  compactFieldShell: {
    minHeight: 56,
    borderRadius: Radius.medium,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  compactPrimaryFieldShell: {
    minHeight: 56,
    borderRadius: Radius.medium,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#FCFDFF',
  },
  compactSecondaryFieldShell: {
    minHeight: 56,
    borderRadius: Radius.medium,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#F7F9FC',
  },
  compactInputText: {
    fontSize: 15,
    lineHeight: 21,
    paddingVertical: 4,
  },
  compactPrimaryInputText: {
    fontSize: 15,
    lineHeight: 21,
    paddingVertical: 4,
  },
  compactAffixText: {
    fontSize: 12,
    lineHeight: 14,
    opacity: 0.72,
  },
  compactPickerText: {
    fontSize: 14,
    lineHeight: 20,
  },
  compactDateTimeShell: {
    minHeight: 56,
    borderRadius: Radius.medium,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  compactDateTimeValue: {
    fontSize: 14,
    lineHeight: 20,
  },
  notesShell: {
    minHeight: 98,
    paddingTop: 8,
  },
  textArea: {
    minHeight: 82,
    textAlignVertical: 'top',
  },
  footerCard: {
    gap: 14,
    borderWidth: 1,
    borderRadius: Radius.large,
    backgroundColor: '#F9FCFF',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  footerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  footerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F0FF',
    flexShrink: 0,
  },
  footerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  footerTitle: {
    color: '#10203B',
  },
  footerHint: {
    lineHeight: 17,
  },
  imagesSectionBody: {
    gap: 12,
  },
  imagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  imageTile: {
    width: 76,
    height: 76,
    borderRadius: Radius.medium,
    overflow: 'hidden',
    backgroundColor: '#EEF3FB',
  },
  imageTilePhoto: {
    width: '100%',
    height: '100%',
  },
  imageTileRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 32, 59, 0.68)',
  },
  imagesEmpty: {
    lineHeight: 18,
  },
  imagesAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 46,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#C6D6F2',
    borderRadius: Radius.medium,
    backgroundColor: '#FAFCFF',
  },
  imagesAddButtonText: {
    color: Accent.primary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 32, 59, 0.2)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  modalPanel: {
    borderWidth: 1,
    borderRadius: Radius.large,
    backgroundColor: '#FFFFFF',
    padding: Spacing.three,
    gap: Spacing.three,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  modalCloseButton: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F6FB',
  },
  modalCloseText: {
    color: '#5E6E88',
    fontSize: 16,
    lineHeight: 18,
  },
  modalActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: Spacing.two,
  },
  uploadSourceRow: {
    flexDirection: 'row',
    gap: 10,
  },
  uploadSourceOption: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E1E9F5',
    borderRadius: Radius.medium,
    backgroundColor: '#FAFCFF',
    paddingVertical: 16,
  },
  uploadSourceIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F0FF',
  },
  uploadSourceLabel: {
    color: '#10203B',
  },
  guideModalPanel: {
    borderWidth: 1,
    borderRadius: Radius.large,
    backgroundColor: '#FFFFFF',
    padding: Spacing.three,
    gap: Spacing.three,
    width: '100%',
    alignSelf: 'center',
  },
  guideModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  guideModalTitleBlock: {
    flex: 1,
    gap: 2,
  },
  guideModalTitle: {
    color: '#10203B',
    lineHeight: 20,
  },
  guideModalSubtitle: {
    lineHeight: 17,
  },
  guideModalImage: {
    width: '100%',
    borderRadius: Radius.medium,
    backgroundColor: '#F5F8FD',
  },
  guideImageViewport: {
    position: 'relative',
    width: '100%',
    borderRadius: Radius.medium,
    overflow: 'hidden',
    backgroundColor: '#F5F8FD',
  },
  guidePageDots: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 6,
  },
  guidePageDot: {
    width: 6,
    height: 6,
    borderRadius: Radius.pill,
    backgroundColor: '#D3DEEE',
  },
  guidePageDotActive: {
    width: 16,
    backgroundColor: Accent.primary,
  },
  guideZoomResetButton: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 32, 59, 0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  guideZoomHint: {
    textAlign: 'center',
  },
});

