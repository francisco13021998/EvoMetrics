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
import { Accent, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { clientsService } from '@/services/clients';
import { revisionsService } from '@/services/revisions';
import { Client, Revision } from '@/types/domain';
import {
    REVISION_PHASE_OPTIONS,
    formatRevisionPhase,
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
  tricepFoldMm: string;
  subscapularFoldMm: string;
  abdominalFoldMm: string;
  suprailiacFoldMm: string;
  frontThighFoldMm: string;
  calfFoldMm: string;
  bodyFatVisualPct: string;
  maintenanceKcal: string;
  targetKcal: string;
  notes: string;
};

type FieldKey = Exclude<keyof RevisionFormState, 'phase' | 'reviewedAt' | 'notes'>;

type RevisionFieldConfig = {
  key: FieldKey;
  label: string;
  placeholder: string;
};

const PERIMETER_FIELDS: RevisionFieldConfig[] = [
  { key: 'weightKg', label: 'Peso (kg)', placeholder: '61.2' },
  { key: 'neckCm', label: 'Cuello (cm)', placeholder: '31' },
  { key: 'armCm', label: 'Brazo (cm)', placeholder: '28' },
  { key: 'waistCm', label: 'Cintura (cm)', placeholder: '73' },
  { key: 'bellyCm', label: 'Abdomen (cm)', placeholder: '76' },
  { key: 'pelvisCm', label: 'Pelvis (cm)', placeholder: '92' },
  { key: 'gluteCm', label: 'Gluteo (cm)', placeholder: '96' },
  { key: 'thighCm', label: 'Muslo (cm)', placeholder: '55' },
];

const SKINFOLD_FIELDS: RevisionFieldConfig[] = [
  { key: 'tricepFoldMm', label: 'Tricipital (mm)', placeholder: '12' },
  { key: 'subscapularFoldMm', label: 'Subescapular (mm)', placeholder: '10' },
  { key: 'abdominalFoldMm', label: 'Abdominal (mm)', placeholder: '14' },
  { key: 'suprailiacFoldMm', label: 'Suprailiaco (mm)', placeholder: '13' },
  { key: 'frontThighFoldMm', label: 'Muslo frontal (mm)', placeholder: '17' },
  { key: 'calfFoldMm', label: 'Pantorrilla (mm)', placeholder: '11' },
];

const COMPOSITION_FIELDS: RevisionFieldConfig[] = [
  { key: 'bodyFatVisualPct', label: 'Grasa visual (%)', placeholder: '21.4' },
  { key: 'maintenanceKcal', label: 'Mantenimiento (kcal)', placeholder: '2100' },
  { key: 'targetKcal', label: 'Objetivo (kcal)', placeholder: '1800' },
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
  tricepFoldMm: '',
  subscapularFoldMm: '',
  abdominalFoldMm: '',
  suprailiacFoldMm: '',
  frontThighFoldMm: '',
  calfFoldMm: '',
  bodyFatVisualPct: '',
  maintenanceKcal: '',
  targetKcal: '',
  notes: '',
};

function toInputValue(value: number | string | null | undefined) {
  return value === null || value === undefined ? '' : String(value);
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

function formatDateTimeForInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseDateTimeInputToIso(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const normalizedValue = trimmedValue.includes('T') ? trimmedValue : trimmedValue.replace(' ', 'T');
  const dateValue = new Date(normalizedValue);

  if (Number.isNaN(dateValue.getTime())) {
    throw new Error('La fecha y hora de la revision no son validas. Usa un formato tipo 2026-04-21T07:23.');
  }

  return dateValue.toISOString();
}

function mapRevisionToForm(revision: Revision): RevisionFormState {
  return {
    phase: normalizeRevisionPhase(revision.phase),
    reviewedAt: revision.reviewedAt ? formatDateTimeForInput(new Date(revision.reviewedAt)) : '',
    weightKg: toInputValue(revision.weightKg),
    neckCm: toInputValue(revision.neckCm),
    armCm: toInputValue(revision.armCm),
    waistCm: toInputValue(revision.waistCm),
    bellyCm: toInputValue(revision.bellyCm),
    pelvisCm: toInputValue(revision.pelvisCm),
    gluteCm: toInputValue(revision.gluteCm),
    thighCm: toInputValue(revision.thighCm),
    tricepFoldMm: toInputValue(revision.tricepFoldMm),
    subscapularFoldMm: toInputValue(revision.subscapularFoldMm),
    abdominalFoldMm: toInputValue(revision.abdominalFoldMm),
    suprailiacFoldMm: toInputValue(revision.suprailiacFoldMm),
    frontThighFoldMm: toInputValue(revision.frontThighFoldMm),
    calfFoldMm: toInputValue(revision.calfFoldMm),
    bodyFatVisualPct: toInputValue(revision.bodyFatVisualPct),
    maintenanceKcal: toInputValue(revision.maintenanceKcal),
    targetKcal: toInputValue(revision.targetKcal),
    notes: revision.notes ?? '',
  };
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

export function RevisionFormScreen({ mode, clientId, revisionId }: RevisionFormScreenProps) {
  const { user } = useAuth();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [client, setClient] = useState<Client | null>(null);

  const [form, setForm] = useState<RevisionFormState>(initialForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

        if (mode === 'create') {
          setForm((currentForm) => ({
            ...currentForm,
            phase: currentForm.phase || REVISION_PHASE_OPTIONS[0].value,
            reviewedAt: formatDateTimeForInput(new Date()),
          }));
        }

        if (mode === 'edit' && revisionId) {
          const revision = await revisionsService.getById(revisionId);

          if (!revision || revision.clientId !== nextClient.id) {
            throw new Error('La revision no existe o no pertenece a este cliente.');
          }

          setForm(mapRevisionToForm(revision));
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

    if (!isRevisionPhase(form.phase)) {
      setErrorMessage('Selecciona una fase valida para la revision.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const payload = {
        clientId: client.id,
        phase: form.phase,
        reviewedAt: parseDateTimeInputToIso(form.reviewedAt),
        weightKg: parseNullableNumber(form.weightKg),
        neckCm: parseNullableNumber(form.neckCm),
        armCm: parseNullableNumber(form.armCm),
        waistCm: parseNullableNumber(form.waistCm),
        bellyCm: parseNullableNumber(form.bellyCm),
        pelvisCm: parseNullableNumber(form.pelvisCm),
        gluteCm: parseNullableNumber(form.gluteCm),
        thighCm: parseNullableNumber(form.thighCm),
        tricepFoldMm: parseNullableNumber(form.tricepFoldMm),
        subscapularFoldMm: parseNullableNumber(form.subscapularFoldMm),
        abdominalFoldMm: parseNullableNumber(form.abdominalFoldMm),
        suprailiacFoldMm: parseNullableNumber(form.suprailiacFoldMm),
        frontThighFoldMm: parseNullableNumber(form.frontThighFoldMm),
        calfFoldMm: parseNullableNumber(form.calfFoldMm),
        bodyFatVisualPct: parseNullableNumber(form.bodyFatVisualPct),
        maintenanceKcal: parseNullableNumber(form.maintenanceKcal),
        targetKcal: parseNullableNumber(form.targetKcal),
        notes: form.notes.trim() || null,
      };

      if (mode === 'create') {
        const createdRevision = await revisionsService.create({
          ...payload,
          ownerId: user.id,
        });
        router.replace(`/revisions/${createdRevision.id}`);
        return;
      }

      if (!revisionId) {
        throw new Error('No se ha encontrado la revision a editar.');
      }

      const updatedRevision = await revisionsService.update(revisionId, {
        ...payload,
        ownerId: user.id,
      });
      router.replace(`/revisions/${updatedRevision.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo guardar la revision.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const { setField } = sectionFields(form, setForm);
  const isWide = width >= 960;
  const isMedium = width >= 720;
  const reviewedAtDate = form.reviewedAt ? new Date(form.reviewedAt) : null;
  const completedPerimeters = countCompletedFields(form, PERIMETER_FIELDS);
  const completedSkinfolds = countCompletedFields(form, SKINFOLD_FIELDS);
  const completedComposition = countCompletedFields(form, COMPOSITION_FIELDS);

  function renderFieldGrid(fields: RevisionFieldConfig[]) {
    return (
      <View style={styles.fieldGrid}>
        {fields.map((field) => (
          <View
            key={field.key}
            style={[
              styles.fieldCard,
              isWide ? styles.fieldCardThird : styles.fieldCardHalf,
            ]}>
            <AppInput
              label={field.label}
              placeholder={field.placeholder}
              keyboardType="decimal-pad"
              unit={field.label.includes('(kg)') ? 'kg' : field.label.includes('(cm)') ? 'cm' : field.label.includes('(mm)') ? 'mm' : field.label.includes('(%)') ? '%' : field.label.includes('(kcal)') ? 'kcal' : undefined}
              value={form[field.key]}
              onChangeText={(value) => setField(field.key, value)}
            />
          </View>
        ))}
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
    <ScreenContainer>
      <PageHeader
        eyebrow={`Cliente: ${client.name}`}
        title={mode === 'create' ? 'Nueva revision' : 'Editar revision'}
        subtitle={mode === 'create' ? 'Registra medidas, pliegues y objetivo nutricional en una sola ficha.' : 'Ajusta la revision y deja una trazabilidad mas clara para el seguimiento.'}
        rightSlot={
          <AppButton label="← Cancelar" variant="ghost" size="compact" fullWidth={false} onPress={() => router.back()} disabled={isSubmitting} />
        }
      />

      <PageSection label="Resumen" title="Contexto de revision" first>
        {isSubmitting ? <StatusBanner tone="info" loading message="Guardando revision..." /> : null}
        {errorMessage ? <StatusBanner tone="danger" message={errorMessage} /> : null}
        <View style={styles.sectionIntro}>
          <ThemedText type="small" themeColor="textSecondary">
            Cliente {client.name} · fase {formatRevisionPhase(form.phase || REVISION_PHASE_OPTIONS[0].value)}
          </ThemedText>
        </View>

        <View style={styles.inlineRow}>
          <View style={[styles.inlineCell, isWide && styles.inlineCellWide]}>
            <AppSelect
              label="Fase"
              value={form.phase || ''}
              options={REVISION_PHASE_OPTIONS.map((option) => ({
                label: option.label,
                value: option.value,
              }))}
              placeholder="Selecciona la fase"
              onChange={(value) => setField('phase', value)}
              helper="Selector cerrado"
            />
          </View>
          <View style={[styles.inlineCell, isWide && styles.inlineCellWide]}>
            <AppDateTimeInput
              label="Fecha y hora"
              value={reviewedAtDate}
              onChange={(nextDate) => setField('reviewedAt', formatDateTimeForInput(nextDate))}
              helper="Auto-rellenado, editable"
              mode="datetime"
            />
          </View>
        </View>
      </PageSection>

      <PageSection
        label="Perimetros"
        title="Medidas corporales"
        rightSlot={<View style={[styles.counterPill, { backgroundColor: Accent.primaryMuted }]}><ThemedText type="smallBold">{completedPerimeters}/{PERIMETER_FIELDS.length}</ThemedText></View>}>
        <ThemedText type="small" themeColor="textSecondary">
          Referencias base para comparar volumen, cintura y peso con mas rapidez.
        </ThemedText>
        {renderFieldGrid(PERIMETER_FIELDS)}
      </PageSection>

      <PageSection
        label="Pliegues cutaneos"
        title="Control adiposo"
        rightSlot={<View style={[styles.counterPill, { backgroundColor: Accent.primaryMuted }]}><ThemedText type="smallBold">{completedSkinfolds}/{SKINFOLD_FIELDS.length}</ThemedText></View>}>
        <ThemedText type="small" themeColor="textSecondary">
          Pliegues clave para lectura ordenada del tejido adiposo.
        </ThemedText>
        {renderFieldGrid(SKINFOLD_FIELDS)}
      </PageSection>

      <PageSection
        label="Composicion y calorias"
        title="Lectura metabolica"
        rightSlot={<View style={[styles.counterPill, { backgroundColor: Accent.primaryMuted }]}><ThemedText type="smallBold">{completedComposition}/{COMPOSITION_FIELDS.length}</ThemedText></View>}>
        <ThemedText type="small" themeColor="textSecondary">
          Estimacion de grasa visual, mantenimiento y objetivo calorico.
        </ThemedText>
        {renderFieldGrid(COMPOSITION_FIELDS)}
      </PageSection>

      <PageSection label="Notas" title="Observaciones profesionales">
        <ThemedText type="small" themeColor="textSecondary">
          Contexto clinico, adherencia o decisiones de ajuste para la siguiente consulta.
        </ThemedText>
        <AppInput
          label="Observaciones"
          placeholder="Notas de la revision"
          multiline
          numberOfLines={6}
          style={styles.textArea}
          value={form.notes}
          onChangeText={(value) => setField('notes', value)}
        />
      </PageSection>

      <PageSection label="Cierre" title="Guardar ficha">
        <View style={[styles.actions, isMedium && styles.actionsWide]}>
          <View style={styles.actionPrimary}>
            <AppButton label={mode === 'create' ? 'Guardar revision' : 'Guardar cambios'} onPress={handleSubmit} loading={isSubmitting} />
          </View>
          <View style={styles.actionSecondary}>
            <AppButton label="Cancelar" variant="secondary" onPress={() => router.back()} disabled={isSubmitting} />
          </View>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          Los calculos derivados se actualizan automaticamente al guardar y quedan asociados al cliente autenticado.
        </ThemedText>
      </PageSection>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  sectionIntro: {
    gap: Spacing.one,
  },
  inlineRow: {
    gap: Spacing.three,
  },
  inlineCell: {
    width: '100%',
  },
  inlineCellWide: {
    width: '48%',
  },
  counterPill: {
    minWidth: 58,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  fieldCard: {
    width: '100%',
    paddingVertical: Spacing.one,
  },
  fieldCardHalf: {
    width: '48%',
  },
  fieldCardThird: {
    width: '31.8%',
  },
  textArea: {
    minHeight: 140,
    textAlignVertical: 'top',
  },
  actions: {
    gap: Spacing.two,
  },
  actionsWide: {
    flexDirection: 'row',
  },
  actionPrimary: {
    flex: 1.35,
  },
  actionSecondary: {
    flex: 0.85,
  },
});