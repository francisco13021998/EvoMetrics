import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

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
import { Client, Revision } from '@/types/domain';
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
type SectionKey = 'context' | 'perimeters' | 'skinfolds' | 'composition' | 'notes';

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
  const [uploadTypeSelection, setUploadTypeSelection] = useState<'front' | 'back' | 'side' | 'other'>('front');
  const [uploadCustomType, setUploadCustomType] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [pendingRevisionPhotoIds, setPendingRevisionPhotoIds] = useState<string[]>([]);
  const [isCompositionGuideOpen, setIsCompositionGuideOpen] = useState(false);

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
        const createdRevision = await revisionsService.create({
          ...payload,
          ownerId: user.id,
        });

        if (pendingRevisionPhotoIds.length > 0) {
          await Promise.all(
            pendingRevisionPhotoIds.map((photoId) =>
              photosService.updateRevision({
                photoId,
                ownerId: user.id,
                revisionId: createdRevision.id,
              })
            )
          );
          setPendingRevisionPhotoIds([]);
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
    setUploadTypeSelection('front');
    setUploadCustomType('');
    setIsUploadModalOpen(true);
  }

  function closeUploadModal() {
    setIsUploadModalOpen(false);
  }

  function resolveUploadType() {
    if (uploadTypeSelection !== 'other') {
      return uploadTypeSelection;
    }

    const normalized = uploadCustomType.trim();
    return normalized.length > 0 ? normalized : null;
  }

  async function handleUploadPhotoFromForm() {
    if (!user?.id || !client || isUploadingPhoto) {
      return;
    }

    const resolvedType = resolveUploadType();

    if (!resolvedType) {
      setErrorMessage('Indica un tipo personalizado para la imagen.');
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
      allowsEditing: true,
      quality: 0.9,
      selectionLimit: 1,
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    setIsUploadingPhoto(true);

    try {
      const uploadedPhoto = await photosService.uploadFromDevice({
        ownerId: user.id,
        clientId: client.id,
        revisionId: mode === 'edit' ? revisionId ?? null : null,
        asset: result.assets[0],
        type: resolvedType,
        capturedAt: toDateOnlyIso(uploadCapturedAt),
      });

      if (mode === 'create') {
        setPendingRevisionPhotoIds((currentPhotoIds) => [...currentPhotoIds, uploadedPhoto.id]);
      }

      closeUploadModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo subir la imagen.';
      setErrorMessage(message);
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  const { setField } = sectionFields(form, setForm);
  const isCreateMode = mode === 'create';
  const isWide = width >= 960;
  const isMedium = width >= 720;
  const compositionGuidePanelWidth = Math.min(width - 24, 920);
  const compositionGuideImageHeight = Math.min(height * 0.72, 760);
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
      <View style={[styles.contextCell, isMedium && styles.contextCellThird]}>
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

  function renderSectionCard(
    sectionKey: SectionKey,
    title: string,
    children: React.ReactNode
  ) {
    const isOpen = activeSections.includes(sectionKey);
    const sectionHint =
      sectionKey === 'context'
        ? 'Cliente, fecha, fase y peso'
        : sectionKey === 'composition'
          ? 'Composición visual y energía'
          : sectionKey === 'perimeters'
            ? 'Perímetros y análisis automático'
            : sectionKey === 'skinfolds'
              ? 'Pliegues y comparación'
              : 'Observaciones de la sesión';

    function toggleSection() {
      setActiveSections((currentSections) =>
        currentSections.includes(sectionKey)
          ? []
          : [sectionKey]
      );
    }

    return (
      <View style={[styles.sectionCard, styles.sectionCardCreate, { borderColor: theme.backgroundSelected }]}>
        <Pressable onPress={toggleSection} style={[styles.sectionToggle, styles.sectionToggleCreate]}>
          <View style={styles.sectionTitleArea}>
            <View style={[styles.sectionMarker, isOpen && styles.sectionMarkerActive]} />
            <View style={styles.sectionTitleBlock}>
              <ThemedText type="smallBold" style={styles.sectionTitle}>{title}</ThemedText>
              {isCreateMode ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.sectionHint}>
                  {sectionHint}
                </ThemedText>
              ) : null}
            </View>
          </View>
          <ThemedText type="smallBold" style={[styles.sectionChevron, isOpen && styles.sectionChevronOpen]}>{isOpen ? '−' : '+'}</ThemedText>
        </Pressable>
        {isOpen ? <View style={styles.sectionBody}>{children}</View> : null}
      </View>
    );
  }

  function renderContextSectionBody() {
    return (
      <View style={styles.contextGrid}>
        <View style={[styles.contextCell, isMedium && styles.contextCellThird]}>
          <View style={styles.contextClientRow}> 
            <ThemedText type="small" themeColor="textSecondary" style={styles.contextClientLabel}>Cliente</ThemedText>
            <View style={styles.contextClientValueWrap}> 
              <ThemedText type="smallBold" style={styles.clientPillText}>{client?.name ?? '--'}</ThemedText>
            </View>
          </View>
        </View>
        <View style={[styles.contextCell, isMedium && styles.contextCellThird]}>
          <AppSelect
            label="Fase"
            value={form.phase || ''}
            options={REVISION_PHASE_OPTIONS.map((option) => ({
              label: option.label,
              value: option.value,
            }))}
            placeholder="Selecciona la fase"
            onChange={(value) => setField('phase', normalizeRevisionPhase(value))}
            helper={referencePlaceholders?.phase ? `Anterior: ${referencePlaceholders.phase}` : undefined}
            containerStyle={styles.compactSelectShell}
            pickerTextStyle={styles.compactPickerText}
          />
        </View>
        <View style={[styles.contextCell, isMedium && styles.contextCellThird]}>
          <AppDateTimeInput
            label="Fecha"
            value={reviewedAtDate}
            onChange={(nextDate) => setField('reviewedAt', formatDateForInput(nextDate))}
            mode="date"
            helper={referencePlaceholders?.reviewedAt ? `Anterior: ${referencePlaceholders.reviewedAt}` : undefined}
            shellStyle={styles.compactDateTimeShell}
            valueStyle={styles.compactDateTimeValue}
          />
        </View>
        {renderWeightField()}
      </View>
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
      <View style={[styles.headerCard, styles.headerCardCreate, { borderColor: theme.backgroundSelected }]}>
        <View style={styles.headerCardTopAccent} />
        <View style={styles.headerRow}>
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
            <ThemedText type="smallBold" style={styles.backIcon}>←</ThemedText>
          </Pressable>
          <View style={styles.headerCopy}>
            <ThemedText type="label" style={styles.headerEyebrow}>{mode === 'create' ? 'Revision' : 'Actualizacion'}</ThemedText>
            <ThemedText type="headline">{mode === 'create' ? 'Nueva revision' : 'Editar revision'}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.headerSubtitle}>
              {mode === 'create'
                ? 'Registro guiado para una evaluación clara y fiable.'
                : 'Actualiza la revisión y mantén un historial consistente y fiable.'}
            </ThemedText>
            {isCreateMode ? (
              <View style={styles.clientTag}>
                <ThemedText type="smallBold" style={styles.clientTagText}>Cliente: {client.name}</ThemedText>
              </View>
            ) : null}
          </View>
          <AppButton label="Cancelar" variant="ghost" size="compact" fullWidth={false} onPress={() => router.back()} disabled={isSubmitting} />
        </View>
      </View>

      {isCreateMode ? (
        <View style={[styles.createGuide, { borderColor: theme.backgroundSelected }]}>
          <View style={styles.guideStep}>
            <ThemedText type="smallBold" style={styles.guideText}>1. Contexto</ThemedText>
          </View>
          <View style={styles.guideStep}>
            <ThemedText type="smallBold" style={styles.guideText}>2. Medidas</ThemedText>
          </View>
          <View style={styles.guideStep}>
            <ThemedText type="smallBold" style={styles.guideText}>3. Guardar</ThemedText>
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
          {isCreateMode ? (
            <View style={styles.compositionGuideRow}>
              <View style={styles.compositionGuideCopy}>
                <ThemedText type="smallBold" style={styles.compositionGuideTitle}>
                  Apoyo visual para estimar la grasa
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.compositionGuideText}>
                  Abre la guía rápida sin salir del formulario.
                </ThemedText>
              </View>
              <AppButton
                label="Guia composición"
                variant="surface"
                size="compact"
                fullWidth={false}
                onPress={() => setIsCompositionGuideOpen(true)}
              />
            </View>
          ) : null}
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

      <View style={[styles.footerCard, isCreateMode && styles.footerCardCreate, { borderColor: theme.backgroundSelected }]}>
        {isCreateMode ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.footerHint}>
            Revisa los datos clave y guarda para generar la revisión completa del cliente.
          </ThemedText>
        ) : null}
        <View style={[styles.actions, isMedium && styles.actionsWide]}>
          <View style={styles.actionPrimary}>
            <AppButton label={mode === 'create' ? 'Guardar revision' : 'Guardar cambios'} onPress={handleSubmit} loading={isSubmitting} />
          </View>
        </View>
        <AppButton
          label={mode === 'edit' ? 'Subir imagen asociada' : 'Subir imagen'}
          variant="surface"
          onPress={openUploadModal}
        />
        {mode === 'create' ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.footerHint}>
            En creación, la imagen se sube y se enlaza al guardar la revisión. En edición se asocia de inmediato.
          </ThemedText>
        ) : null}
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

            <AppSelect
              label="Tipo"
              value={uploadTypeSelection}
              options={UPLOAD_TYPE_OPTIONS}
              onChange={(value) => setUploadTypeSelection(value as 'front' | 'back' | 'side' | 'other')}
            />

            {uploadTypeSelection === 'other' ? (
              <AppInput
                label="Tipo personalizado"
                placeholder="Ejemplo: Poses, Bikini, Competición..."
                value={uploadCustomType}
                onChangeText={setUploadCustomType}
              />
            ) : null}

            <View style={styles.modalActions}>
              <AppButton label="Cancelar" variant="ghost" size="compact" fullWidth={false} onPress={closeUploadModal} disabled={isUploadingPhoto} />
              <AppButton label="Seleccionar y subir" size="compact" fullWidth={false} onPress={() => void handleUploadPhotoFromForm()} loading={isUploadingPhoto} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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

            <Image
              source={require('../../../assets/images/guia-composicion/porcentaje-graso.jpg')}
              style={[styles.guideModalImage, { height: compositionGuideImageHeight }]}
              contentFit="contain"
              transition={150}
            />

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
    gap: 12,
  },
  formCanvas: {
    gap: 10,
  },
  headerCard: {
    borderWidth: 1,
    borderRadius: Radius.large,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    shadowColor: '#12336E',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  headerCardCreate: {
    backgroundColor: '#F8FBFF',
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
    borderRadius: Radius.medium,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  guideStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  guideText: {
    color: '#355079',
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
    alignItems: 'flex-start',
    gap: 8,
  },
  backButton: {
    width: 38,
    height: 38,
    borderWidth: 1,
    borderRadius: Radius.pill,
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
    gap: 2,
  },
  headerEyebrow: {
    color: Accent.primary,
  },
  headerSubtitle: {
    lineHeight: 18,
  },
  headerTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
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
  contextClientRow: {
    minHeight: 36,
    borderRadius: 8,
    paddingHorizontal: 2,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  contextClientValueWrap: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#F7FAFF',
  },
  contextClientLabel: {
    lineHeight: 14,
  },
  contextEyebrow: {
    color: Accent.primary,
    fontSize: 12,
    lineHeight: 16,
  },
  clientPill: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: '#FAFCFF',
  },
  clientPillText: {
    color: '#10203B',
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
    borderRadius: Radius.large,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  sectionCardCreate: {
    shadowColor: '#12336E',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  sectionToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  sectionToggleCreate: {
    backgroundColor: '#F9FCFF',
    paddingVertical: 12,
  },
  sectionTitleArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    minWidth: 0,
  },
  sectionMarker: {
    marginTop: 6,
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: '#C4D6F4',
  },
  sectionMarkerActive: {
    backgroundColor: Accent.primary,
  },
  sectionTitleBlock: {
    flex: 1,
    gap: 1,
  },
  sectionTitle: {
    color: '#10203B',
    fontSize: 14,
    lineHeight: 20,
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
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
    backgroundColor: '#F3F7FC',
  },
  sectionCountText: {
    color: Accent.primary,
    fontSize: 10,
    lineHeight: 12,
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
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
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
  compositionSectionBody: {
    gap: 6,
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
    borderWidth: 1,
    borderRadius: Radius.large,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 4,
  },
  footerCardCreate: {
    backgroundColor: '#F9FCFF',
  },
  footerHint: {
    lineHeight: 18,
    paddingBottom: 6,
  },
  actions: {
    gap: 0,
  },
  actionsWide: {
    flexDirection: 'row',
  },
  actionPrimary: {
    flex: 1,
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
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: Spacing.two,
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
});

const UPLOAD_TYPE_OPTIONS = [
  { value: 'front', label: 'Frontal' },
  { value: 'back', label: 'Espalda' },
  { value: 'side', label: 'Lateral' },
  { value: 'other', label: 'Otro' },
];