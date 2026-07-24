import { File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, PanResponder, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { EmptyState } from '@/components/feedback/empty-state';
import { StatusBanner } from '@/components/feedback/status-banner';
import { AppButton } from '@/components/forms/app-button';
import { AppDateTimeInput } from '@/components/forms/app-date-time';
import { AppSelect } from '@/components/forms/app-select';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { ScreenContainer } from '@/components/layout/screen-container';
import { Accent, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { clientsService } from '@/services/clients';
import { CLIENT_IMAGES_BUCKET, photosService } from '@/services/photos';
import { revisionsService } from '@/services/revisions';
import { Client, ClientPhoto, Revision } from '@/types/domain';
import { calculateBodyFatAverage, calculateBodyFatFromPerimeters, calculateBodyFatFromSkinfolds } from '@/utils/calculations';
import { calculateAgeFromBirthDate } from '@/utils/client-age';

import { ThemedText } from '@/components/themed-text';

type ClientPhotosScreenProps = {
  clientId: string;
  initialRevisionId?: string | null;
  autoOpenUpload?: boolean;
};

function formatRevisionDate(value: string) {
  return new Date(value).toLocaleDateString('es-ES');
}

function formatBodyFatAverage(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return 'Grasa no disponible';
  }

  return `${Math.round(value)}% grasa`;
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

function getRevisionAverageBodyFat(client: Client, revision: Revision) {
  if (revision.bodyFatPct !== null) {
    return revision.bodyFatPct;
  }

  const perimeter = calculateBodyFatFromPerimeters(client.sex, {
    neckCm: revision.neckCm,
    bellyCm: revision.bellyCm,
    gluteCm: revision.gluteCm,
    heightCm: client.heightCm,
  });
  const skinfold = calculateBodyFatFromSkinfolds(client.sex, calculateAgeFromBirthDate(client.birthDate, new Date(revision.reviewedAt)), {
    bicepFoldMm: revision.bicepFoldMm,
    tricepFoldMm: revision.tricepFoldMm,
    subscapularFoldMm: revision.subscapularFoldMm,
    suprailiacFoldMm: revision.suprailiacFoldMm,
    abdominalFoldMm: revision.abdominalFoldMm,
    frontThighFoldMm: revision.frontThighFoldMm,
    calfFoldMm: revision.calfFoldMm,
  });

  return calculateBodyFatAverage({
    visualBodyFatPct: revision.bodyFatVisualPct,
    perimeterBodyFatPct: perimeter?.bodyFatPct ?? null,
    skinfoldBodyFatPct: revision.bodyFatSkinfoldsPct ?? skinfold?.bodyFatPct ?? null,
  })?.bodyFatPct ?? null;
}

export function ClientPhotosScreen({ clientId, initialRevisionId = null, autoOpenUpload = false }: ClientPhotosScreenProps) {
  const { user, userRole } = useAuth();
  const isAthlete = userRole === 'athlete';
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const [client, setClient] = useState<Client | null>(null);
  const [photos, setPhotos] = useState<ClientPhoto[]>([]);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadCapturedAt, setUploadCapturedAt] = useState<Date | null>(new Date());
  const [uploadRevisionId, setUploadRevisionId] = useState<string>('none');
  const [previewPhoto, setPreviewPhoto] = useState<ClientPhoto | null>(null);
  const [compareSourcePhoto, setCompareSourcePhoto] = useState<ClientPhoto | null>(null);
  const [compareTargetPhoto, setCompareTargetPhoto] = useState<ClientPhoto | null>(null);
  const [isComparePickerOpen, setIsComparePickerOpen] = useState(false);
  const [compareSourceZoom, setCompareSourceZoom] = useState(1);
  const [compareTargetZoom, setCompareTargetZoom] = useState(1);
  const [compareSourceZoomInput, setCompareSourceZoomInput] = useState('100');
  const [compareTargetZoomInput, setCompareTargetZoomInput] = useState('100');
  const [isCompareSourceZoomEditing, setIsCompareSourceZoomEditing] = useState(false);
  const [isCompareTargetZoomEditing, setIsCompareTargetZoomEditing] = useState(false);
  const [compareSourceOffset, setCompareSourceOffset] = useState({ x: 0, y: 0 });
  const [compareTargetOffset, setCompareTargetOffset] = useState({ x: 0, y: 0 });
  const [hasAutoOpenedUpload, setHasAutoOpenedUpload] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingComparison, setIsDownloadingComparison] = useState(false);
  const [editPhoto, setEditPhoto] = useState<ClientPhoto | null>(null);
  const [editCapturedAt, setEditCapturedAt] = useState<Date | null>(null);
  const [editRevisionId, setEditRevisionId] = useState<string>('none');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const comparisonExportRef = React.useRef<View>(null);
  const compareSourceZoomHoldRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const compareTargetZoomHoldRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const compareSourceZoomHoldStartedAtRef = React.useRef<number | null>(null);
  const compareTargetZoomHoldStartedAtRef = React.useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (compareSourceZoomHoldRef.current) {
        clearTimeout(compareSourceZoomHoldRef.current);
      }

      if (compareTargetZoomHoldRef.current) {
        clearTimeout(compareTargetZoomHoldRef.current);
      }
    };
  }, []);

  const showInitialLoading = isLoading && !client;

  const filteredPhotos = useMemo(() => {
    return [...photos].sort((left, right) => new Date(right.capturedAt).getTime() - new Date(left.capturedAt).getTime());
  }, [photos]);

  const revisionById = useMemo(() => {
    return new Map(revisions.map((revision) => [revision.id, revision]));
  }, [revisions]);

  const revisionBodyFatById = useMemo(() => {
    if (!client) {
      return new Map<string, number | null>();
    }

    return new Map(revisions.map((revision) => [revision.id, getRevisionAverageBodyFat(client, revision)]));
  }, [client, revisions]);

  const revisionOptions = useMemo(() => {
    return [
      { label: 'Sin asociar', value: 'none' },
      ...revisions.map((revision) => ({
        label: formatRevisionDate(revision.reviewedAt),
        value: revision.id,
      })),
    ];
  }, [revisions]);

  const selectedUploadRevision = useMemo(() => {
    if (uploadRevisionId === 'none') {
      return null;
    }

    return revisionById.get(uploadRevisionId) ?? null;
  }, [revisionById, uploadRevisionId]);

  const compareablePhotos = useMemo(() => {
    if (!compareSourcePhoto) {
      return [];
    }

    return filteredPhotos.filter((photo) => photo.id !== compareSourcePhoto.id);
  }, [compareSourcePhoto, filteredPhotos]);

  const compareZoomMin = 0.4;
  const compareZoomMax = 3;
  const compareZoomStep = 0.01;
  const isCompareSideBySide = width >= 780;
  const compareImageHeight = isCompareSideBySide ? 360 : 260;
  const comparePanelWidth = Math.round(Math.min(Math.max(width - Spacing.three * 2, 0), 900));
  const compareExportWidth = Math.max(comparePanelWidth - Spacing.three * 2, 0);
  const compareExportLeftWidth = Math.floor(compareExportWidth / 2);
  const compareExportRightWidth = compareExportWidth - compareExportLeftWidth;
  const sourceZoomPercent = Math.round(compareSourceZoom * 100);
  const targetZoomPercent = Math.round(compareTargetZoom * 100);
  const compareSourcePanStartRef = React.useRef({ x: 0, y: 0 });
  const compareTargetPanStartRef = React.useRef({ x: 0, y: 0 });
  const compareSourceOffsetRef = React.useRef(compareSourceOffset);
  const compareTargetOffsetRef = React.useRef(compareTargetOffset);

  useEffect(() => {
    compareSourceOffsetRef.current = compareSourceOffset;
  }, [compareSourceOffset]);

  useEffect(() => {
    compareTargetOffsetRef.current = compareTargetOffset;
  }, [compareTargetOffset]);

  useEffect(() => {
    if (!isCompareSourceZoomEditing) {
      setCompareSourceZoomInput(String(sourceZoomPercent));
    }
  }, [isCompareSourceZoomEditing, sourceZoomPercent]);

  useEffect(() => {
    if (!isCompareTargetZoomEditing) {
      setCompareTargetZoomInput(String(targetZoomPercent));
    }
  }, [isCompareTargetZoomEditing, targetZoomPercent]);

  const updateCompareSourceOffset = useCallback((nextOffset: { x: number; y: number }) => {
    compareSourceOffsetRef.current = nextOffset;
    setCompareSourceOffset(nextOffset);
  }, []);

  const updateCompareTargetOffset = useCallback((nextOffset: { x: number; y: number }) => {
    compareTargetOffsetRef.current = nextOffset;
    setCompareTargetOffset(nextOffset);
  }, []);

  const compareSourcePanResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: (_event, gestureState) => Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2,
        onPanResponderGrant: () => {
          compareSourcePanStartRef.current = compareSourceOffsetRef.current;
        },
        onPanResponderMove: (_event, gestureState) => {
          updateCompareSourceOffset({
            x: compareSourcePanStartRef.current.x + gestureState.dx,
            y: compareSourcePanStartRef.current.y + gestureState.dy,
          });
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: () => null,
        onPanResponderTerminate: () => null,
      }),
    [updateCompareSourceOffset]
  );

  const compareTargetPanResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: (_event, gestureState) => Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2,
        onPanResponderGrant: () => {
          compareTargetPanStartRef.current = compareTargetOffsetRef.current;
        },
        onPanResponderMove: (_event, gestureState) => {
          updateCompareTargetOffset({
            x: compareTargetPanStartRef.current.x + gestureState.dx,
            y: compareTargetPanStartRef.current.y + gestureState.dy,
          });
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: () => null,
        onPanResponderTerminate: () => null,
      }),
    [updateCompareTargetOffset]
  );

  function clampCompareZoom(value: number) {
    return Math.max(compareZoomMin, Math.min(compareZoomMax, value));
  }

  function setSourceCompareZoom(nextZoom: number) {
    setCompareSourceZoom(clampCompareZoom(nextZoom));
  }

  function setTargetCompareZoom(nextZoom: number) {
    setCompareTargetZoom(clampCompareZoom(nextZoom));
  }

  function resetCompareZoom() {
    setCompareSourceZoom(1);
    setCompareTargetZoom(1);
    setCompareSourceZoomInput('100');
    setCompareTargetZoomInput('100');
  }

  function resetCompareOffsets() {
    updateCompareSourceOffset({ x: 0, y: 0 });
    updateCompareTargetOffset({ x: 0, y: 0 });
  }

  function adjustSourceCompareZoom(delta: number) {
    setCompareSourceZoom((currentZoom) => clampCompareZoom(currentZoom + delta));
  }

  function adjustTargetCompareZoom(delta: number) {
    setCompareTargetZoom((currentZoom) => clampCompareZoom(currentZoom + delta));
  }

  function commitSourceZoomInput(nextValue: string) {
    const trimmedValue = nextValue.trim();

    if (trimmedValue === '') {
      setCompareSourceZoomInput(String(sourceZoomPercent));
      return;
    }

    const parsedZoom = Number(trimmedValue.replace(',', '.'));

    if (Number.isNaN(parsedZoom)) {
      setCompareSourceZoomInput(String(sourceZoomPercent));
      return;
    }

    setSourceCompareZoom(parsedZoom / 100);
  }

  function commitTargetZoomInput(nextValue: string) {
    const trimmedValue = nextValue.trim();

    if (trimmedValue === '') {
      setCompareTargetZoomInput(String(targetZoomPercent));
      return;
    }

    const parsedZoom = Number(trimmedValue.replace(',', '.'));

    if (Number.isNaN(parsedZoom)) {
      setCompareTargetZoomInput(String(targetZoomPercent));
      return;
    }

    setTargetCompareZoom(parsedZoom / 100);
  }

  function handleSourceZoomTextChange(nextValue: string) {
    setCompareSourceZoomInput(nextValue);
  }

  function handleTargetZoomTextChange(nextValue: string) {
    setCompareTargetZoomInput(nextValue);
  }

  function handleSourceZoomInputBlur() {
    setIsCompareSourceZoomEditing(false);
    commitSourceZoomInput(compareSourceZoomInput);
  }

  function handleTargetZoomInputBlur() {
    setIsCompareTargetZoomEditing(false);
    commitTargetZoomInput(compareTargetZoomInput);
  }

  function scheduleCompareZoomHold(direction: 1 | -1, target: 'source' | 'target') {
    const startedAtRef = target === 'source' ? compareSourceZoomHoldStartedAtRef : compareTargetZoomHoldStartedAtRef;
    const holdRef = target === 'source' ? compareSourceZoomHoldRef : compareTargetZoomHoldRef;
    const adjustZoom = target === 'source' ? adjustSourceCompareZoom : adjustTargetCompareZoom;

    if (!startedAtRef.current) {
      return;
    }

    const elapsedMs = Date.now() - startedAtRef.current;

    let delay = 140;

    if (elapsedMs >= 2200) {
      delay = 40;
    } else if (elapsedMs >= 1500) {
      delay = 55;
    } else if (elapsedMs >= 900) {
      delay = 70;
    } else if (elapsedMs >= 450) {
      delay = 95;
    }

    holdRef.current = setTimeout(() => {
      adjustZoom(direction * compareZoomStep);
      scheduleCompareZoomHold(direction, target);
    }, delay);
  }

  function startCompareZoomHold(direction: 1 | -1, target: 'source' | 'target') {
    stopCompareZoomHold(target);

    if (target === 'source') {
      compareSourceZoomHoldStartedAtRef.current = Date.now();
      adjustSourceCompareZoom(direction * compareZoomStep);
      scheduleCompareZoomHold(direction, target);
      return;
    }

    compareTargetZoomHoldStartedAtRef.current = Date.now();
    adjustTargetCompareZoom(direction * compareZoomStep);
    scheduleCompareZoomHold(direction, target);
  }

  function stopCompareZoomHold(target?: 'source' | 'target') {
    if (!target || target === 'source') {
      if (compareSourceZoomHoldRef.current) {
        clearTimeout(compareSourceZoomHoldRef.current);
        compareSourceZoomHoldRef.current = null;
      }

      compareSourceZoomHoldStartedAtRef.current = null;
    }

    if (!target || target === 'target') {
      if (compareTargetZoomHoldRef.current) {
        clearTimeout(compareTargetZoomHoldRef.current);
        compareTargetZoomHoldRef.current = null;
      }

      compareTargetZoomHoldStartedAtRef.current = null;
    }
  }

  async function handleDownloadPhoto(photo: ClientPhoto) {
    try {
      setIsDownloading(true);

      const { status } = await MediaLibrary.requestPermissionsAsync(true);
      if (status !== 'granted' && status !== 'limited') {
        Alert.alert('Permiso denegado', 'Activa el permiso de galería en los ajustes del dispositivo para descargar imágenes.');
        return;
      }

      const { data: urlData, error: urlError } = await supabase.storage
        .from(CLIENT_IMAGES_BUCKET)
        .createSignedUrl(photo.storagePath, 300);

      if (urlError || !urlData) {
        throw new Error('No se pudo generar la URL de descarga.');
      }

      const extension = photo.storagePath.split('.').pop() ?? 'jpg';
      const fileName = `evometrics_${photo.id}.${extension}`;
      const tempFile = new File(Paths.cache, fileName);
      const downloadedFile = await File.downloadFileAsync(urlData.signedUrl, tempFile);

      await MediaLibrary.saveToLibraryAsync(downloadedFile.uri);
      downloadedFile.delete();
      Alert.alert('Descarga completada', 'La imagen se ha guardado en tu galería.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      Alert.alert('Error', `No se pudo descargar la imagen: ${msg}`);
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleDownloadComparison() {
    if (!comparisonExportRef.current || !compareSourcePhoto || !compareTargetPhoto || isDownloadingComparison) {
      return;
    }

    try {
      setIsDownloadingComparison(true);

      const { status } = await MediaLibrary.requestPermissionsAsync(true);
      if (status !== 'granted' && status !== 'limited') {
        Alert.alert('Permiso denegado', 'Activa el permiso de galería en los ajustes del dispositivo para descargar imágenes.');
        return;
      }

      const captureUri = await captureRef(comparisonExportRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      await MediaLibrary.saveToLibraryAsync(captureUri);
      Alert.alert('Descarga completada', 'La comparación se ha guardado en tu galería.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo descargar la comparación.';
      Alert.alert('Error', message);
    } finally {
      setIsDownloadingComparison(false);
    }
  }

  function openEditModal(photo: ClientPhoto) {
    setEditCapturedAt(parseIsoDateOrNow(photo.capturedAt));
    setEditRevisionId(photo.revisionId ?? 'none');
    setEditPhoto(photo);
    setPreviewPhoto(null);
  }

  function openComparePicker(photo: ClientPhoto) {
    setCompareSourcePhoto(photo);
    setCompareTargetPhoto(null);
    setPreviewPhoto(null);
    resetCompareZoom();
    resetCompareOffsets();
    setIsComparePickerOpen(true);
  }

  function closeComparePicker() {
    setIsComparePickerOpen(false);
    setCompareSourcePhoto(null);
    setCompareTargetPhoto(null);
    resetCompareZoom();
    resetCompareOffsets();
  }

  function openCompareView(photo: ClientPhoto) {
    setCompareTargetPhoto(photo);
    setIsComparePickerOpen(false);
    setCompareTargetZoom(1);
    setCompareSourceZoom(1);
    setCompareSourceZoomInput('100');
    setCompareTargetZoomInput('100');
    resetCompareOffsets();
  }

  function closeCompareView() {
    setCompareSourcePhoto(null);
    setCompareTargetPhoto(null);
    resetCompareZoom();
    resetCompareOffsets();
    stopCompareZoomHold();
  }

  function closeEditModal() {
    setEditPhoto(null);
  }

  async function handleSaveEdit() {
    if (!user?.id || !editPhoto || isSavingEdit) {
      return;
    }

    if (!editCapturedAt) {
      Alert.alert('Fecha requerida', 'Selecciona una fecha para la imagen.');
      return;
    }

    setIsSavingEdit(true);

    try {
      const updated = await photosService.updateDetails({
        photoId: editPhoto.id,
        ownerId: user.id,
        capturedAt: toDateOnlyIso(editCapturedAt),
        revisionId: editRevisionId === 'none' ? null : editRevisionId,
      });

      setPhotos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setPreviewPhoto(updated);
      closeEditModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo guardar los cambios.';
      Alert.alert('Error', message);
    } finally {
      setIsSavingEdit(false);
    }
  }

  function resetUploadForm() {
    const hasDefaultRevision = Boolean(initialRevisionId && revisions.some((revision) => revision.id === initialRevisionId));
    const defaultRevision = hasDefaultRevision ? revisions.find((revision) => revision.id === initialRevisionId) ?? null : null;

    setUploadCapturedAt(defaultRevision ? parseIsoDateOrNow(defaultRevision.reviewedAt) : new Date());
    setUploadRevisionId(hasDefaultRevision ? initialRevisionId! : 'none');
  }

  function openUploadModal() {
    resetUploadForm();
    setIsUploadModalOpen(true);
  }

  function closeUploadModal() {
    setIsUploadModalOpen(false);
  }

  const loadContent = useCallback(async () => {
    if (!user?.id || !clientId) {
      setClient(null);
      setPhotos([]);
      setRevisions([]);
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
        setPhotos([]);
        setRevisions([]);
        return;
      }

      const [nextPhotos, nextRevisions] = await Promise.all([
        isAthlete
          ? photosService.listByClientForViewer(nextClient.id)
          : photosService.listByClient(nextClient.id, user.id!),
        revisionsService.listByClient(nextClient.id),
      ]);

      setPhotos(nextPhotos);
      setRevisions(nextRevisions);

    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cargar la galeria del cliente.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [clientId, user?.id]);

  useEffect(() => {
    void loadContent();
  }, [loadContent]);

  useEffect(() => {
    if (!autoOpenUpload || hasAutoOpenedUpload || !client || isLoading) {
      return;
    }

    const hasDefaultRevision = Boolean(initialRevisionId && revisions.some((revision) => revision.id === initialRevisionId));
    const defaultRevision = hasDefaultRevision ? revisions.find((revision) => revision.id === initialRevisionId) ?? null : null;

    setUploadCapturedAt(defaultRevision ? parseIsoDateOrNow(defaultRevision.reviewedAt) : new Date());
    setUploadRevisionId(hasDefaultRevision ? initialRevisionId! : 'none');
    setIsUploadModalOpen(true);
    setHasAutoOpenedUpload(true);
  }, [autoOpenUpload, client, hasAutoOpenedUpload, initialRevisionId, isLoading, revisions]);

  async function handleUploadFromModal() {
    if (!user?.id || !client || isUploading) {
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

    setIsUploading(true);

    try {
      const resolvedRevisionId = uploadRevisionId === 'none' ? null : uploadRevisionId;

      const uploadedPhotos = await photosService.uploadManyFromDevice({
        ownerId: user.id,
        clientId: client.id,
        assets: result.assets,
        revisionId: resolvedRevisionId,
        capturedAt: toDateOnlyIso(uploadCapturedAt),
      });

      setPhotos((prev) => [...uploadedPhotos, ...prev].sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()));
      closeUploadModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo subir la imagen.';
      setErrorMessage(message);
    } finally {
      setIsUploading(false);
    }
  }

  function getPhotoDateLabel(photo: ClientPhoto) {
    return formatRevisionDate(photo.revisionId ? (revisionById.get(photo.revisionId)?.reviewedAt ?? photo.capturedAt) : photo.capturedAt);
  }

  function handleDeletePhoto(photo: ClientPhoto) {
    if (!user?.id || deletingPhotoId) {
      return;
    }

    Alert.alert('Eliminar imagen', 'Esta imagen se eliminara de Storage y de la galeria del cliente.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const isDeletingPreviewPhoto = previewPhoto?.id === photo.id;
            setDeletingPhotoId(photo.id);
            setErrorMessage(null);

            if (isDeletingPreviewPhoto) {
              setPreviewPhoto(null);
            }

            try {
              await photosService.remove(photo.id, user.id);
              setPhotos((prev) => {
                const next = prev.filter((p) => p.id !== photo.id);
                return next;
              });
            } catch (error) {
              const message = error instanceof Error ? error.message : 'No se pudo eliminar la imagen.';
              setErrorMessage(message);
            } finally {
              setDeletingPhotoId(null);
            }
          })();
        },
      },
    ]);
  }

  if (showInitialLoading) {
    return (
      <ScreenContainer>
        <PageHeader title="Fotos" />
        <PageSection first>
          <StatusBanner tone="info" loading message="Sincronizando imagenes del cliente." />
        </PageSection>
      </ScreenContainer>
    );
  }

  if (errorMessage && !client) {
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
          description="Este perfil no existe o no pertenece al usuario autenticado."
          actionLabel="Volver a clientes"
          onAction={() => router.back()}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <PageHeader
        eyebrow={`Cliente: ${client.name}`}
        title="Galería de fotos"
        subtitle={`${photos.length} imagen${photos.length !== 1 ? 'es' : ''}`}
        rightSlot={
          <AppButton label="← Volver" variant="ghost" size="compact" fullWidth={false} onPress={() => router.back()} />
        }
      />

      <PageSection
        first
        label="Imágenes"
        rightSlot={photos.length > 0 && !isAthlete ? <AppButton label="Subir" size="compact" fullWidth={false} onPress={openUploadModal} /> : null}
      >
        {isLoading ? <StatusBanner tone="info" loading message="Actualizando galería..." /> : null}
        {errorMessage ? <StatusBanner tone="danger" message={errorMessage} /> : null}

        {filteredPhotos.length === 0 ? (
          <EmptyState
            title="Galería vacía"
            description={photos.length === 0 ? (isAthlete ? 'Aún no hay imágenes en tu galería.' : 'Sube la primera imagen del cliente.') : 'No hay imágenes disponibles.'}
            actionLabel={isAthlete ? undefined : 'Subir imagen'}
            actionVariant="primary"
            onAction={isAthlete ? undefined : openUploadModal}
          />
        ) : (
          <View style={styles.grid}>
            {filteredPhotos.map((photo) => (
              <Pressable
                key={photo.id}
                onPress={() => setPreviewPhoto(photo)}
                style={({ pressed }) => [styles.tile, { opacity: pressed ? 0.88 : 1 }]}>
                <Image
                  source={{ uri: photo.imageUrl }}
                  style={[styles.preview, { backgroundColor: Accent.primaryMuted }]}
                  contentFit="cover"
                  transition={150}
                />
              </Pressable>
            ))}
          </View>
        )}
      </PageSection>

      <Modal transparent visible={isUploadModalOpen} animationType="fade" onRequestClose={closeUploadModal}>
        <Pressable style={styles.modalBackdrop} onPress={closeUploadModal}>
          <Pressable style={[styles.modalPanel, { borderColor: theme.backgroundSelected }]} onPress={() => null}>
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
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

              <View style={[styles.revisionAssignWrap, { borderColor: theme.backgroundSelected }]}>
                <AppSelect
                  label="Asociar a revisión (opcional)"
                  value={uploadRevisionId}
                  options={revisionOptions}
                  onChange={(value) => {
                    setUploadRevisionId(value);

                    if (value !== 'none') {
                      const selectedRevision = revisionById.get(value);
                      setUploadCapturedAt(parseIsoDateOrNow(selectedRevision?.reviewedAt));
                    }
                  }}
                  helper={revisions.length > 0 ? `${revisions.length} revisión(es) disponibles` : 'No hay revisiones para asociar'}
                />
                <ThemedText type="small" themeColor="textSecondary" style={styles.revisionAssignStatus}>
                  {selectedUploadRevision
                    ? `Asociada: ${formatRevisionDate(selectedUploadRevision.reviewedAt)}`
                    : 'Asociada: sin revisión'}
                </ThemedText>
              </View>

              <View style={styles.modalActions}>
                <AppButton label="Cancelar" variant="ghost" size="compact" fullWidth={false} onPress={closeUploadModal} disabled={isUploading} />
                <AppButton label="Seleccionar y subir" size="compact" fullWidth={false} onPress={() => void handleUploadFromModal()} loading={isUploading} />
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent visible={Boolean(previewPhoto)} animationType="fade" onRequestClose={() => setPreviewPhoto(null)}>
        <Pressable style={styles.viewerBackdrop} onPress={() => setPreviewPhoto(null)}>
          <Pressable style={[styles.viewerPanel, { borderColor: theme.backgroundSelected }]} onPress={() => null}>
            {previewPhoto ? (
              <>
                <View style={styles.viewerHeader}>
                  <View style={styles.viewerHeaderCopy}>
                    <ThemedText type="small" style={styles.viewerHeaderMeta}>
                      {formatRevisionDate(previewPhoto.revisionId ? (revisionById.get(previewPhoto.revisionId)?.reviewedAt ?? previewPhoto.capturedAt) : previewPhoto.capturedAt)}
                      {previewPhoto.revisionId && revisionBodyFatById.get(previewPhoto.revisionId) !== undefined
                        ? `  ·  ${formatBodyFatAverage(revisionBodyFatById.get(previewPhoto.revisionId) ?? null)}`
                        : null}
                    </ThemedText>
                  </View>
                  <Pressable
                    onPress={() => setPreviewPhoto(null)}
                    style={({ pressed }) => [styles.viewerClose, { backgroundColor: pressed ? '#1C2E50' : '#15294D' }]}>
                    <ThemedText type="smallBold" style={styles.viewerCloseText}>×</ThemedText>
                  </Pressable>
                </View>

                <Image source={{ uri: previewPhoto.imageUrl }} style={styles.viewerImage} contentFit="contain" transition={150} />

                <View style={styles.viewerFooter}>
                  <AppButton
                    label="Descargar"
                    variant="surface"
                    size="compact"
                    fullWidth={false}
                    loading={isDownloading}
                    onPress={() => void handleDownloadPhoto(previewPhoto)}
                  />
                  <AppButton
                    label="Comparar"
                    variant="surface"
                    size="compact"
                    fullWidth={false}
                    onPress={() => openComparePicker(previewPhoto)}
                  />
                  {!isAthlete && (
                    <AppButton
                      label="Editar"
                      variant="surface"
                      size="compact"
                      fullWidth={false}
                      onPress={() => openEditModal(previewPhoto)}
                    />
                  )}
                  {!isAthlete && (
                    <AppButton
                      label="Eliminar"
                      variant="danger"
                      size="compact"
                      fullWidth={false}
                      loading={deletingPhotoId === previewPhoto.id}
                      onPress={() => handleDeletePhoto(previewPhoto)}
                    />
                  )}
                </View>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent visible={isComparePickerOpen} animationType="fade" onRequestClose={closeComparePicker}>
        <Pressable style={styles.viewerBackdrop} onPress={closeComparePicker}>
          <Pressable style={[styles.comparePickerPanel, { borderColor: theme.backgroundSelected }]} onPress={() => null}>
            <View style={styles.modalHeader}>
              <View style={styles.viewerHeaderCopy}>
                <ThemedText type="smallBold" style={styles.comparePickerTitle}>Comparar imagen</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.comparePickerSubtitle}>
                  Selecciona otra imagen de la galería para abrir la comparación.
                </ThemedText>
              </View>
              <Pressable onPress={closeComparePicker} style={styles.modalCloseButton}>
                <ThemedText type="smallBold" style={styles.modalCloseText}>×</ThemedText>
              </Pressable>
            </View>

            {compareSourcePhoto ? (
              compareablePhotos.length > 0 ? (
                <ScrollView style={styles.comparePickerScroll} contentContainerStyle={styles.comparePickerGrid} showsVerticalScrollIndicator={false}>
                  {compareablePhotos.map((photo) => (
                    <Pressable
                      key={photo.id}
                      onPress={() => openCompareView(photo)}
                      style={({ pressed }) => [styles.comparePickerTile, { opacity: pressed ? 0.88 : 1 }]}>
                      <Image source={{ uri: photo.imageUrl }} style={styles.comparePickerImage} contentFit="cover" transition={150} />
                      <View style={styles.comparePickerTileCopy}>
                        <ThemedText type="smallBold" numberOfLines={1}>Seleccionar</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                          {getPhotoDateLabel(photo)}
                        </ThemedText>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : (
                <EmptyState
                  title="No hay otra imagen"
                  description="La comparación necesita al menos dos imágenes en la galería de este cliente."
                  actionLabel="Cerrar"
                  onAction={closeComparePicker}
                />
              )
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent visible={Boolean(compareSourcePhoto && compareTargetPhoto)} animationType="fade" onRequestClose={closeCompareView}>
        <Pressable style={styles.viewerBackdrop} onPress={closeCompareView}>
          <View style={[styles.comparePanel, { borderColor: theme.backgroundSelected }]}>
            {compareSourcePhoto && compareTargetPhoto ? (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.viewerHeaderCopy}>
                    <ThemedText type="smallBold" style={styles.comparePickerTitle}>Comparación de imágenes</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.comparePickerSubtitle}>
                      Visualiza ambas imágenes a la vez.
                    </ThemedText>
                  </View>
                  <Pressable onPress={closeCompareView} style={styles.modalCloseButton}>
                    <ThemedText type="smallBold" style={styles.modalCloseText}>×</ThemedText>
                  </Pressable>
                </View>

                <View style={styles.compareCaptureArea}>
                  <View style={styles.compareGrid}>
                  <View style={styles.compareCard}>
                    <ThemedText type="smallBold" style={styles.compareCardLabel}>Imagen original</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.compareCardMeta}>
                      {getPhotoDateLabel(compareSourcePhoto)}
                    </ThemedText>
                    <View style={[styles.compareImageViewport, { height: compareImageHeight }]} {...compareSourcePanResponder.panHandlers}>
                      <View
                        style={[
                          styles.compareImageCanvas,
                          {
                            transform: [
                              { scale: compareSourceZoom },
                              { translateX: compareSourceOffset.x },
                              { translateY: compareSourceOffset.y },
                            ],
                          },
                        ]}>
                        <Image
                          source={{ uri: compareSourcePhoto.imageUrl }}
                          style={styles.compareImage}
                          contentFit="contain"
                          transition={150}
                        />
                      </View>
                    </View>
                    <View style={styles.compareCardControls}>
                      <View style={styles.compareZoomStepper}>
                        <Pressable
                          onPressIn={() => startCompareZoomHold(-1, 'source')}
                          onPressOut={() => stopCompareZoomHold('source')}
                          style={({ pressed }) => [styles.compareZoomButton, pressed && styles.compareZoomButtonPressed]}>
                          <ThemedText type="smallBold" style={styles.compareZoomButtonLabel}>−</ThemedText>
                        </Pressable>
                        <TextInput
                          value={compareSourceZoomInput}
                          onFocus={() => setIsCompareSourceZoomEditing(true)}
                          onChangeText={handleSourceZoomTextChange}
                          onBlur={handleSourceZoomInputBlur}
                          onSubmitEditing={handleSourceZoomInputBlur}
                          keyboardType="numeric"
                          maxLength={3}
                          returnKeyType="done"
                          selectTextOnFocus
                          style={styles.compareZoomControlInput}
                          placeholderTextColor="#7A9CC4"
                        />
                        <ThemedText type="smallBold" style={styles.compareZoomControlUnit}>%</ThemedText>
                        <Pressable
                          onPressIn={() => startCompareZoomHold(1, 'source')}
                          onPressOut={() => stopCompareZoomHold('source')}
                          style={({ pressed }) => [styles.compareZoomButton, pressed && styles.compareZoomButtonPressed]}>
                          <ThemedText type="smallBold" style={styles.compareZoomButtonLabel}>+</ThemedText>
                        </Pressable>
                      </View>
                    </View>
                  </View>

                  <View style={styles.compareCard}>
                    <ThemedText type="smallBold" style={styles.compareCardLabel}>Imagen seleccionada</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.compareCardMeta}>
                      {getPhotoDateLabel(compareTargetPhoto)}
                    </ThemedText>
                    <View style={[styles.compareImageViewport, { height: compareImageHeight }]} {...compareTargetPanResponder.panHandlers}>
                      <View
                        style={[
                          styles.compareImageCanvas,
                          {
                            transform: [
                              { scale: compareTargetZoom },
                              { translateX: compareTargetOffset.x },
                              { translateY: compareTargetOffset.y },
                            ],
                          },
                        ]}>
                        <Image
                          source={{ uri: compareTargetPhoto.imageUrl }}
                          style={styles.compareImage}
                          contentFit="contain"
                          transition={150}
                        />
                      </View>
                    </View>
                    <View style={styles.compareCardControls}>
                      <View style={styles.compareZoomStepper}>
                        <Pressable
                          onPressIn={() => startCompareZoomHold(-1, 'target')}
                          onPressOut={() => stopCompareZoomHold('target')}
                          style={({ pressed }) => [styles.compareZoomButton, pressed && styles.compareZoomButtonPressed]}>
                          <ThemedText type="smallBold" style={styles.compareZoomButtonLabel}>−</ThemedText>
                        </Pressable>
                        <TextInput
                          value={compareTargetZoomInput}
                          onFocus={() => setIsCompareTargetZoomEditing(true)}
                          onChangeText={handleTargetZoomTextChange}
                          onBlur={handleTargetZoomInputBlur}
                          onSubmitEditing={handleTargetZoomInputBlur}
                          keyboardType="numeric"
                          maxLength={3}
                          returnKeyType="done"
                          selectTextOnFocus
                          style={styles.compareZoomControlInput}
                          placeholderTextColor="#7A9CC4"
                        />
                        <ThemedText type="smallBold" style={styles.compareZoomControlUnit}>%</ThemedText>
                        <Pressable
                          onPressIn={() => startCompareZoomHold(1, 'target')}
                          onPressOut={() => stopCompareZoomHold('target')}
                          style={({ pressed }) => [styles.compareZoomButton, pressed && styles.compareZoomButtonPressed]}>
                          <ThemedText type="smallBold" style={styles.compareZoomButtonLabel}>+</ThemedText>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                  </View>

                  <ThemedText type="small" themeColor="textSecondary" style={styles.compareHelpText}>
                    Arrastra cada imagen para centrarla y usa + / - para ajustar el zoom.
                  </ThemedText>
                </View>

                <View style={styles.compareFooter}>
                  <AppButton
                    label="Descargar comparación"
                    variant="surface"
                    size="compact"
                    fullWidth={false}
                    onPress={() => void handleDownloadComparison()}
                    loading={isDownloadingComparison}
                  />
                  <AppButton label="Cerrar" variant="surface" size="compact" fullWidth={false} onPress={closeCompareView} />
                </View>

                <View ref={comparisonExportRef} collapsable={false} pointerEvents="none" style={[styles.comparisonExportHost, { width: compareExportWidth }]}>
                  <View style={styles.compareExportCaptureArea}>
                    <View style={styles.compareExportGrid}>
                      <View style={[styles.compareExportCard, { width: compareExportLeftWidth }]}>
                        <View style={[styles.compareExportImageViewport, { height: compareImageHeight }]}>
                          <View
                            style={[
                              styles.compareExportImageCanvas,
                              {
                                transform: [
                                  { scale: compareSourceZoom },
                                  { translateX: compareSourceOffset.x },
                                  { translateY: compareSourceOffset.y },
                                ],
                              },
                            ]}>
                            <Image
                              source={{ uri: compareSourcePhoto.imageUrl }}
                              style={styles.compareExportImage}
                              contentFit="contain"
                              transition={150}
                            />
                          </View>
                        </View>
                      </View>

                      <View style={[styles.compareExportCard, { width: compareExportRightWidth }]}>
                        <View style={[styles.compareExportImageViewport, { height: compareImageHeight }]}>
                          <View
                            style={[
                              styles.compareExportImageCanvas,
                              {
                                transform: [
                                  { scale: compareTargetZoom },
                                  { translateX: compareTargetOffset.x },
                                  { translateY: compareTargetOffset.y },
                                ],
                              },
                            ]}>
                            <Image
                              source={{ uri: compareTargetPhoto.imageUrl }}
                              style={styles.compareExportImage}
                              contentFit="contain"
                              transition={150}
                            />
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              </>
            ) : null}
          </View>
        </Pressable>
      </Modal>

      <Modal transparent visible={Boolean(editPhoto)} animationType="fade" onRequestClose={closeEditModal}>
        <Pressable style={styles.modalBackdrop} onPress={closeEditModal}>
          <Pressable style={[styles.modalPanel, { borderColor: theme.backgroundSelected }]} onPress={() => null}>
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <ThemedText type="smallBold">Editar imagen</ThemedText>
                <Pressable onPress={closeEditModal} style={styles.modalCloseButton}>
                  <ThemedText type="smallBold" style={styles.modalCloseText}>×</ThemedText>
                </Pressable>
              </View>

              <AppDateTimeInput
                label="Fecha"
                value={editCapturedAt}
                mode="date"
                onChange={(value) => setEditCapturedAt(value)}
              />

              <View style={[styles.revisionAssignWrap, { borderColor: theme.backgroundSelected }]}>
                <AppSelect
                  label="Asociar a revisión (opcional)"
                  value={editRevisionId}
                  options={revisionOptions}
                  onChange={(value) => {
                    setEditRevisionId(value);
                    if (value !== 'none') {
                      const selectedRevision = revisionById.get(value);
                      setEditCapturedAt(parseIsoDateOrNow(selectedRevision?.reviewedAt));
                    }
                  }}
                  helper={revisions.length > 0 ? `${revisions.length} revisión(es) disponibles` : 'No hay revisiones para asociar'}
                />
              </View>

              <View style={styles.modalActions}>
                <AppButton label="Cancelar" variant="ghost" size="compact" fullWidth={false} onPress={closeEditModal} disabled={isSavingEdit} />
                <AppButton label="Guardar cambios" size="compact" fullWidth={false} onPress={() => void handleSaveEdit()} loading={isSavingEdit} />
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tile: {
    width: '32%',
    borderRadius: Radius.small,
    overflow: 'hidden',
    backgroundColor: Accent.primaryMuted,
  },
  preview: {
    aspectRatio: 1,
    width: '100%',
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
  modalScroll: {
    width: '100%',
  },
  modalScrollContent: {
    gap: Spacing.three,
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
  revisionAssignWrap: {
    borderWidth: 1,
    borderRadius: Radius.medium,
    backgroundColor: '#FAFCFF',
    padding: Spacing.two,
    gap: Spacing.one,
  },
  revisionAssignStatus: {
    lineHeight: 18,
  },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(13, 26, 51, 0.82)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  viewerPanel: {
    borderWidth: 1,
    borderRadius: Radius.large,
    backgroundColor: '#0D1A33',
    overflow: 'hidden',
  },
  viewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: '#1C2E50',
  },
  viewerHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  viewerHeaderTitle: {
    color: '#FFFFFF',
  },
  viewerHeaderMeta: {
    color: '#7A9CC4',
  },
  viewerClose: {
    width: 30,
    height: 30,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  viewerCloseText: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 20,
  },
  viewerImage: {
    width: '100%',
    height: 400,
    backgroundColor: '#15294D',
  },
  viewerFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: '#1C2E50',
  },
  comparePickerPanel: {
    borderWidth: 1,
    borderRadius: Radius.large,
    backgroundColor: '#0D1A33',
    padding: Spacing.three,
    gap: Spacing.three,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
  comparePickerTitle: {
    color: '#FFFFFF',
  },
  comparePickerSubtitle: {
    color: '#7A9CC4',
  },
  comparePickerScroll: {
    maxHeight: 520,
  },
  comparePickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  comparePickerTile: {
    width: '48%',
    borderRadius: Radius.medium,
    overflow: 'hidden',
    backgroundColor: '#15294D',
  },
  comparePickerImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#15294D',
  },
  comparePickerTileCopy: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    gap: 2,
  },
  comparePanel: {
    borderWidth: 1,
    borderRadius: Radius.large,
    backgroundColor: '#0D1A33',
    padding: Spacing.three,
    gap: Spacing.three,
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
  },
  compareCaptureArea: {
    gap: Spacing.three,
    overflow: 'hidden',
    borderRadius: Radius.medium,
    backgroundColor: '#0D1A33',
  },
  compareExportCaptureArea: {
    gap: 0,
    overflow: 'hidden',
    borderRadius: 0,
    backgroundColor: '#0D1A33',
    padding: 0,
  },
  compareExportGrid: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 0,
    alignItems: 'stretch',
  },
  compareExportCard: {
    flexShrink: 0,
    minWidth: 0,
    gap: 0,
    padding: 0,
    margin: 0,
    backgroundColor: '#0D1A33',
  },
  compareExportImageViewport: {
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#0D1A33',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  compareExportImageCanvas: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  compareExportImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0D1A33',
  },
  comparisonExportHost: {
    position: 'absolute',
    left: -10000,
    top: 0,
    opacity: 1,
  },
  compareHelpText: {
    color: '#7A9CC4',
    textAlign: 'center',
    paddingHorizontal: Spacing.two,
  },
  compareGrid: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: Spacing.two,
    alignItems: 'stretch',
  },
  compareCard: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.one,
  },
  compareImageViewport: {
    height: 360,
    borderRadius: Radius.medium,
    overflow: 'hidden',
    backgroundColor: '#15294D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compareImageCanvas: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  compareCardLabel: {
    color: '#FFFFFF',
  },
  compareCardMeta: {
    color: '#7A9CC4',
  },
  compareImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#15294D',
  },
  compareCardControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  compareZoomStepper: {
    minWidth: 156,
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 3,
    borderRadius: Radius.small,
    borderWidth: 1,
    borderColor: '#2B4A77',
    backgroundColor: '#15294D',
  },
  compareZoomButton: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#1C3760',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compareZoomButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  compareZoomButtonLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 15,
  },
  compareZoomControlInput: {
    minWidth: 32,
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 0,
    paddingHorizontal: 0,
    includeFontPadding: false,
  },
  compareZoomControlUnit: {
    color: '#7A9CC4',
    fontSize: 11,
    lineHeight: 12,
  },
  compareFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
});