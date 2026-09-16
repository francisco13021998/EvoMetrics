import { File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
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

import { ThemedText } from '@/components/themed-text';

type ClientPhotosScreenProps = {
  clientId: string;
  initialRevisionId?: string | null;
  autoOpenUpload?: boolean;
};

function formatRevisionDate(value: string) {
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

const AnimatedZoomImage = Animated.createAnimatedComponent(Image);
const ZOOM_MIN_SCALE = 0.6;
const ZOOM_MAX_SCALE = 4;

function clampZoomScale(value: number) {
  'worklet';
  return Math.min(Math.max(value, ZOOM_MIN_SCALE), ZOOM_MAX_SCALE);
}

function useZoomTransform(resetKey: string) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  useEffect(() => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    // Nueva foto en este lado de la comparación: se parte siempre de zoom neutro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

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
      scale.value = clampZoomScale(savedScale.value * event.scale);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const panGesture = Gesture.Pan()
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

type ZoomTransform = ReturnType<typeof useZoomTransform>;

type ZoomableCompareImageProps = {
  uri: string;
  height: number;
  gesture: ZoomTransform['gesture'];
  animatedStyle: ZoomTransform['animatedStyle'];
  onReset: ZoomTransform['resetZoom'];
};

function ZoomableCompareImage({ uri, height, gesture, animatedStyle, onReset }: ZoomableCompareImageProps) {
  return (
    <View style={[styles.compareImageViewport, { height }]}>
      <GestureDetector gesture={gesture}>
        <AnimatedZoomImage source={{ uri }} style={[styles.compareImage, animatedStyle]} contentFit="contain" transition={150} />
      </GestureDetector>
      <Pressable
        onPress={onReset}
        accessibilityRole="button"
        accessibilityLabel="Restablecer zoom de la imagen"
        style={({ pressed }) => [styles.compareZoomResetButton, pressed && styles.pressed]}>
        <Ionicons name="scan-outline" size={13} color="#FFFFFF" />
      </Pressable>
    </View>
  );
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
  const [hasAutoOpenedUpload, setHasAutoOpenedUpload] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingComparison, setIsDownloadingComparison] = useState(false);
  const [editPhoto, setEditPhoto] = useState<ClientPhoto | null>(null);
  const [editCapturedAt, setEditCapturedAt] = useState<Date | null>(null);
  const [editRevisionId, setEditRevisionId] = useState<string>('none');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const comparisonExportRef = React.useRef<View>(null);
  const sourceZoom = useZoomTransform(compareSourcePhoto?.id ?? 'none');
  const targetZoom = useZoomTransform(compareTargetPhoto?.id ?? 'none');

  const showInitialLoading = isLoading && !client;

  const sortedPhotos = useMemo(() => {
    return [...photos].sort((left, right) => new Date(right.capturedAt).getTime() - new Date(left.capturedAt).getTime());
  }, [photos]);

  const revisionById = useMemo(() => {
    return new Map(revisions.map((revision) => [revision.id, revision]));
  }, [revisions]);

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

    return sortedPhotos.filter((photo) => photo.id !== compareSourcePhoto.id);
  }, [compareSourcePhoto, sortedPhotos]);

  const compareDaysDiff = compareSourcePhoto && compareTargetPhoto
    ? Math.round((getPhotoDate(compareTargetPhoto).getTime() - getPhotoDate(compareSourcePhoto).getTime()) / (24 * 60 * 60 * 1000))
    : null;

  const compareElapsedLabel = compareDaysDiff === null
    ? ''
    : compareDaysDiff === 0
      ? 'Mismo día'
      : `${Math.abs(compareDaysDiff)} día${Math.abs(compareDaysDiff) === 1 ? '' : 's'} de diferencia`;

  const compareImageHeight = width >= 720 ? 360 : 250;
  const compareExportWidth = Math.max(Math.min(width - Spacing.three * 2, 720), 280);
  const compareExportLeftWidth = Math.floor(compareExportWidth / 2);
  const compareExportRightWidth = compareExportWidth - compareExportLeftWidth;
  async function handleDownloadPhoto(photo: ClientPhoto) {
    try {
      setIsDownloading(true);

      const { status } = await MediaLibrary.requestPermissionsAsync(true);
      if (status !== 'granted') {
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
      if (status !== 'granted') {
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
    setIsComparePickerOpen(true);
  }

  function closeComparePicker() {
    setIsComparePickerOpen(false);
    setCompareSourcePhoto(null);
    setCompareTargetPhoto(null);
  }

  function openCompareView(photo: ClientPhoto) {
    if (!compareSourcePhoto) {
      return;
    }

    if (getPhotoDate(photo).getTime() < getPhotoDate(compareSourcePhoto).getTime()) {
      setCompareTargetPhoto(compareSourcePhoto);
      setCompareSourcePhoto(photo);
    } else {
      setCompareTargetPhoto(photo);
    }

    setIsComparePickerOpen(false);
  }

  function closeCompareView() {
    setCompareSourcePhoto(null);
    setCompareTargetPhoto(null);
  }

  function swapComparePhotos() {
    if (!compareSourcePhoto || !compareTargetPhoto) {
      return;
    }

    setCompareSourcePhoto(compareTargetPhoto);
    setCompareTargetPhoto(compareSourcePhoto);
  }

  function handleChangeComparisonTarget() {
    setCompareTargetPhoto(null);
    setIsComparePickerOpen(true);
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
  }, [clientId, isAthlete, user?.id]);

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

  function getPhotoDateIso(photo: ClientPhoto) {
    return photo.revisionId ? (revisionById.get(photo.revisionId)?.reviewedAt ?? photo.capturedAt) : photo.capturedAt;
  }

  function getPhotoDateLabel(photo: ClientPhoto) {
    return formatRevisionDate(getPhotoDateIso(photo));
  }

  function getPhotoDate(photo: ClientPhoto) {
    return parseIsoDateOrNow(getPhotoDateIso(photo));
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
    <ScreenContainer contentStyle={styles.screenContent}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver al cliente"
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={18} color={Accent.primary} />
          <ThemedText type="smallBold" style={styles.backButtonText}>Cliente</ThemedText>
        </Pressable>
        {!isAthlete ? (
          <Pressable
            onPress={openUploadModal}
            accessibilityRole="button"
            accessibilityLabel="Subir imágenes"
            style={({ pressed }) => [styles.uploadButton, pressed && styles.pressed]}>
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.galleryHero, { borderColor: theme.backgroundSelected }]}>
        <View style={styles.galleryHeroIcon}><Ionicons name="images-outline" size={25} color={Accent.primary} /></View>
        <View style={styles.galleryHeroCopy}>
          <ThemedText type="label" style={styles.galleryEyebrow}>Progreso visual</ThemedText>
          <ThemedText type="headline" style={styles.galleryTitle}>Galería de fotos</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.gallerySubtitle}>{client.name}</ThemedText>
        </View>
        <View style={styles.galleryCount}>
          <ThemedText type="smallBold" style={styles.galleryCountValue}>{photos.length}</ThemedText>
          <ThemedText type="small" style={styles.galleryCountLabel}>fotos</ThemedText>
        </View>
      </View>

      {isLoading ? <StatusBanner tone="info" loading message="Actualizando galería..." /> : null}
      {errorMessage ? <StatusBanner tone="danger" message={errorMessage} /> : null}

      <View style={styles.gallerySectionHeader}>
        <View>
          <ThemedText type="headline" style={styles.gallerySectionTitle}>Todas las fotos</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Ordenadas de la más reciente a la más antigua.</ThemedText>
        </View>
        {sortedPhotos.length > 0 ? <ThemedText type="smallBold" style={styles.gallerySectionCount}>{sortedPhotos.length}</ThemedText> : null}
      </View>

      {sortedPhotos.length === 0 ? (
        <View style={[styles.emptyGallery, { borderColor: theme.backgroundSelected }]}>
          <View style={styles.emptyGalleryIcon}><Ionicons name="images-outline" size={26} color={Accent.primary} /></View>
          <ThemedText type="smallBold" style={styles.emptyGalleryTitle}>La galería está vacía</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.emptyGalleryDescription}>
            {isAthlete ? 'Aún no hay imágenes compartidas.' : 'Añade la primera imagen para documentar el progreso.'}
          </ThemedText>
          {!isAthlete ? <AppButton label="Subir imágenes" size="compact" fullWidth={false} onPress={openUploadModal} /> : null}
        </View>
      ) : (
        <View style={styles.grid}>
          {sortedPhotos.map((photo) => (
            <Pressable
              key={photo.id}
              onPress={() => setPreviewPhoto(photo)}
              accessibilityRole="button"
              accessibilityLabel={`Abrir foto del ${getPhotoDateLabel(photo)}`}
              style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}>
              <Image source={{ uri: photo.imageUrl }} style={[styles.preview, { backgroundColor: Accent.primaryMuted }]} contentFit="cover" transition={150} />
              <View style={styles.tileCaption}>
                <ThemedText type="smallBold" style={styles.tileDate} numberOfLines={1}>{getPhotoDateLabel(photo)}</ThemedText>
                {photo.revisionId ? <Ionicons name="checkmark-circle" size={14} color={Accent.primary} /> : null}
              </View>
            </Pressable>
          ))}
        </View>
      )}

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
                  <Pressable
                    onPress={() => setPreviewPhoto(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Cerrar foto"
                    style={({ pressed }) => [styles.viewerClose, pressed && styles.pressed]}>
                    <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
                  </Pressable>
                  <View style={styles.viewerHeaderCopy}>
                    <ThemedText type="smallBold" style={styles.viewerHeaderTitle}>
                      {getPhotoDateLabel(previewPhoto)}
                    </ThemedText>
                    <ThemedText type="small" style={styles.viewerHeaderMeta}>
                      {previewPhoto.revisionId ? 'Asociada a una revisión' : 'Foto de progreso'}
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.viewerImageStage}>
                  <Image source={{ uri: previewPhoto.imageUrl }} style={styles.viewerImage} contentFit="contain" transition={150} />
                </View>

                <View style={styles.viewerFooter}>
                  <View style={styles.viewerActionRow}>
                    <Pressable onPress={() => void handleDownloadPhoto(previewPhoto)} style={({ pressed }) => [styles.viewerAction, pressed && styles.pressed]}>
                      <Ionicons name="download-outline" size={20} color="#FFFFFF" />
                      <ThemedText type="smallBold" style={styles.viewerActionLabel}>{isDownloading ? 'Guardando...' : 'Guardar'}</ThemedText>
                    </Pressable>
                    <Pressable onPress={() => openComparePicker(previewPhoto)} style={({ pressed }) => [styles.viewerAction, styles.viewerActionSecondary, pressed && styles.pressed]}>
                      <Ionicons name="git-compare-outline" size={20} color="#FFFFFF" />
                      <ThemedText type="smallBold" style={styles.viewerActionLabel}>Comparar</ThemedText>
                    </Pressable>
                  </View>
                  {!isAthlete && (
                    <View style={styles.viewerActionRow}>
                      <Pressable onPress={() => openEditModal(previewPhoto)} style={({ pressed }) => [styles.viewerTextAction, pressed && styles.pressed]}>
                        <Ionicons name="create-outline" size={17} color="#9FB4D4" />
                        <ThemedText type="smallBold" style={styles.viewerTextActionLabel}>Editar detalles</ThemedText>
                      </Pressable>
                      <Pressable onPress={() => handleDeletePhoto(previewPhoto)} style={({ pressed }) => [styles.viewerTextAction, pressed && styles.pressed]}>
                        <Ionicons name="trash-outline" size={17} color="#FF9C9C" />
                        <ThemedText type="smallBold" style={styles.viewerDeleteActionLabel}>{deletingPhotoId === previewPhoto.id ? 'Eliminando...' : 'Eliminar'}</ThemedText>
                      </Pressable>
                    </View>
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
                <ThemedText type="smallBold" style={styles.comparePickerTitle}>Elige otra foto</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.comparePickerSubtitle}>
                  Se ordenarán automáticamente por fecha como antes/después.
                </ThemedText>
              </View>
              <Pressable onPress={closeComparePicker} style={styles.modalCloseButton}>
                <ThemedText type="smallBold" style={styles.modalCloseText}>×</ThemedText>
              </Pressable>
            </View>

            {compareSourcePhoto ? (
              compareablePhotos.length > 0 ? (
                <>
                  <View style={styles.compareSourceSummary}>
                    <Image source={{ uri: compareSourcePhoto.imageUrl }} style={styles.compareSourceThumbnail} contentFit="cover" />
                    <View style={styles.compareSourceCopy}>
                      <ThemedText type="small" style={styles.compareSourceLabel}>Foto actual</ThemedText>
                      <ThemedText type="smallBold" style={styles.compareSourceDate}>{getPhotoDateLabel(compareSourcePhoto)}</ThemedText>
                    </View>
                  </View>
                  <ScrollView style={styles.comparePickerScroll} contentContainerStyle={styles.comparePickerGrid} showsVerticalScrollIndicator={false}>
                    {compareablePhotos.map((photo) => {
                      const diffDays = Math.round((getPhotoDate(photo).getTime() - getPhotoDate(compareSourcePhoto).getTime()) / (24 * 60 * 60 * 1000));
                      const diffLabel = diffDays === 0 ? 'Mismo día' : `${diffDays > 0 ? '+' : ''}${diffDays} d`;

                      return (
                        <Pressable
                          key={photo.id}
                          onPress={() => openCompareView(photo)}
                          style={({ pressed }) => [styles.comparePickerTile, { opacity: pressed ? 0.88 : 1 }]}>
                          <Image source={{ uri: photo.imageUrl }} style={styles.comparePickerImage} contentFit="cover" transition={150} />
                          <View style={styles.comparePickerTileCopy}>
                            <ThemedText type="smallBold" style={styles.compareCardLabel} numberOfLines={1}>{getPhotoDateLabel(photo)}</ThemedText>
                            <View style={styles.comparePickerDiffBadge}>
                              <ThemedText type="small" style={styles.comparePickerDiffBadgeText}>{diffLabel}</ThemedText>
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </>
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
          <Pressable style={[styles.comparePanel, { borderColor: theme.backgroundSelected }]} onPress={() => null}>
            {compareSourcePhoto && compareTargetPhoto ? (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.compareHeaderIconWrap}>
                    <Ionicons name="git-compare" size={20} color={Accent.primary} />
                  </View>
                  <View style={styles.viewerHeaderCopy}>
                    <ThemedText type="smallBold" style={styles.comparePickerTitle}>Comparación de progreso</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.comparePickerSubtitle}>
                      {client.name}
                    </ThemedText>
                  </View>
                  <Pressable onPress={closeCompareView} style={styles.modalCloseButton} accessibilityRole="button" accessibilityLabel="Cerrar comparación">
                    <ThemedText type="smallBold" style={styles.modalCloseText}>×</ThemedText>
                  </Pressable>
                </View>

                <View style={styles.compareMetaRow}>
                  <View style={styles.compareMetaBadge}>
                    <Ionicons name="time-outline" size={14} color={Accent.primary} />
                    <ThemedText type="small" style={styles.compareMetaBadgeText}>{compareElapsedLabel}</ThemedText>
                  </View>
                  <Pressable
                    onPress={swapComparePhotos}
                    accessibilityRole="button"
                    accessibilityLabel="Invertir orden de las fotos"
                    style={({ pressed }) => [styles.compareSwapButton, pressed && styles.pressed]}>
                    <Ionicons name="swap-horizontal" size={15} color="#FFFFFF" />
                    <ThemedText type="small" style={styles.compareSwapButtonText}>Invertir</ThemedText>
                  </Pressable>
                </View>

                <View style={styles.compareCaptureArea}>
                  <GestureHandlerRootView style={styles.compareGrid}>
                    <View style={styles.compareCard}>
                      <View style={styles.compareImageFrame}>
                        <ZoomableCompareImage
                          uri={compareSourcePhoto.imageUrl}
                          height={compareImageHeight}
                          gesture={sourceZoom.gesture}
                          animatedStyle={sourceZoom.animatedStyle}
                          onReset={sourceZoom.resetZoom}
                        />
                        <View style={[styles.compareChip, styles.compareChipBefore]}>
                          <ThemedText type="small" style={styles.compareChipTextBefore}>ANTES</ThemedText>
                        </View>
                      </View>
                      <View style={styles.compareCardFooter}>
                        <ThemedText type="smallBold" style={styles.compareCardMeta}>{getPhotoDateLabel(compareSourcePhoto)}</ThemedText>
                        {compareSourcePhoto.revisionId ? <Ionicons name="checkmark-circle" size={13} color="#7A9CC4" /> : null}
                      </View>
                    </View>

                    <View style={styles.compareCard}>
                      <View style={styles.compareImageFrame}>
                        <ZoomableCompareImage
                          uri={compareTargetPhoto.imageUrl}
                          height={compareImageHeight}
                          gesture={targetZoom.gesture}
                          animatedStyle={targetZoom.animatedStyle}
                          onReset={targetZoom.resetZoom}
                        />
                        <View style={[styles.compareChip, styles.compareChipAfter]}>
                          <ThemedText type="small" style={styles.compareChipTextAfter}>DESPUÉS</ThemedText>
                        </View>
                      </View>
                      <View style={styles.compareCardFooter}>
                        <ThemedText type="smallBold" style={styles.compareCardMeta}>{getPhotoDateLabel(compareTargetPhoto)}</ThemedText>
                        {compareTargetPhoto.revisionId ? <Ionicons name="checkmark-circle" size={13} color={Accent.primary} /> : null}
                      </View>
                    </View>
                  </GestureHandlerRootView>

                  <ThemedText type="small" style={styles.compareZoomHint}>
                    Pellizca o desliza cada foto para ajustar el tamaño del físico. El ajuste se aplicará también al guardar la comparación.
                  </ThemedText>
                </View>

                <Pressable
                  onPress={handleChangeComparisonTarget}
                  accessibilityRole="button"
                  accessibilityLabel="Cambiar la foto de comparación"
                  style={({ pressed }) => [styles.compareLinkButton, pressed && styles.pressed]}>
                  <Ionicons name="image-outline" size={15} color="#9FB4D4" />
                  <ThemedText type="small" style={styles.compareLinkButtonText}>Cambiar foto de comparación</ThemedText>
                </Pressable>

                <View style={styles.compareFooter}>
                  <AppButton
                    label="Guardar comparación"
                    variant="primary"
                    size="compact"
                    fullWidth={false}
                    onPress={() => void handleDownloadComparison()}
                    loading={isDownloadingComparison}
                  />
                  <AppButton label="Cerrar" variant="surface" size="compact" fullWidth={false} onPress={closeCompareView} />
                </View>

                <View ref={comparisonExportRef} collapsable={false} pointerEvents="none" style={[styles.comparisonExportHost, { width: compareExportWidth }]}>
                  <View style={styles.compareExportCaptureArea}>
                    <View style={styles.compareExportHeader}>
                      <ThemedText type="smallBold" style={styles.compareExportHeaderTitle}>{client.name}</ThemedText>
                      <ThemedText type="small" style={styles.compareExportHeaderMeta}>{compareElapsedLabel} · EvoMetrics</ThemedText>
                    </View>
                    <View style={styles.compareExportGrid}>
                      <View style={[styles.compareExportCard, styles.compareExportCardDivider, { width: compareExportLeftWidth }]}>
                        <View style={[styles.compareExportImageViewport, { height: compareImageHeight }]}>
                          <AnimatedZoomImage source={{ uri: compareSourcePhoto.imageUrl }} style={[styles.compareExportImage, sourceZoom.animatedStyle]} contentFit="contain" transition={150} />
                        </View>
                        <View style={styles.compareExportCaption}>
                          <ThemedText type="small" style={styles.compareExportCaptionLabel}>ANTES</ThemedText>
                          <ThemedText type="small" style={styles.compareExportCaptionDate}>{getPhotoDateLabel(compareSourcePhoto)}</ThemedText>
                        </View>
                      </View>

                      <View style={[styles.compareExportCard, { width: compareExportRightWidth }]}>
                        <View style={[styles.compareExportImageViewport, { height: compareImageHeight }]}>
                          <AnimatedZoomImage source={{ uri: compareTargetPhoto.imageUrl }} style={[styles.compareExportImage, targetZoom.animatedStyle]} contentFit="contain" transition={150} />
                        </View>
                        <View style={styles.compareExportCaption}>
                          <ThemedText type="small" style={styles.compareExportCaptionLabel}>DESPUÉS</ThemedText>
                          <ThemedText type="small" style={styles.compareExportCaptionDate}>{getPhotoDateLabel(compareTargetPhoto)}</ThemedText>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              </>
            ) : null}
          </Pressable>
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
  screenContent: {
    gap: 14,
    paddingTop: 14,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#DFE7F2',
    borderRadius: Radius.pill,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
  },
  backButtonText: {
    color: '#10203B',
  },
  uploadButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: Accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.74,
    transform: [{ scale: 0.98 }],
  },
  galleryHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    padding: 16,
    shadowColor: '#12336E',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  galleryHeroIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F0FF',
  },
  galleryHeroCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  galleryEyebrow: {
    color: Accent.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  galleryTitle: {
    color: '#10203B',
    fontSize: 24,
    lineHeight: 29,
  },
  gallerySubtitle: {
    lineHeight: 18,
  },
  galleryCount: {
    minWidth: 48,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#F3F7FD',
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  galleryCountValue: {
    color: Accent.primary,
    fontSize: 18,
    lineHeight: 21,
  },
  galleryCountLabel: {
    color: '#6D7E98',
    fontSize: 10,
    lineHeight: 12,
  },
  gallerySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  gallerySectionTitle: {
    color: '#10203B',
    fontSize: 21,
    lineHeight: 26,
  },
  gallerySectionCount: {
    minWidth: 28,
    height: 28,
    borderRadius: Radius.pill,
    backgroundColor: '#E8F0FF',
    color: Accent.primary,
    textAlign: 'center',
    paddingTop: 5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tile: {
    width: '48.3%',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E9F5',
    padding: 4,
  },
  tilePressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  preview: {
    aspectRatio: 0.78,
    borderRadius: 14,
    width: '100%',
  },
  tileCaption: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    paddingHorizontal: 8,
    paddingTop: 7,
    paddingBottom: 4,
  },
  tileDate: {
    flex: 1,
    color: '#334B6D',
    fontSize: 11,
    lineHeight: 14,
  },
  emptyGallery: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  emptyGalleryIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F0FF',
  },
  emptyGalleryTitle: {
    color: '#10203B',
  },
  emptyGalleryDescription: {
    maxWidth: 280,
    textAlign: 'center',
    lineHeight: 19,
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
    backgroundColor: '#0D1A33',
  },
  viewerPanel: {
    flex: 1,
    backgroundColor: '#0D1A33',
  },
  viewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 14,
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
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1B345E',
  },
  viewerCloseText: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 20,
  },
  viewerImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#15294D',
  },
  viewerImageStage: {
    flex: 1,
    minHeight: 260,
    paddingHorizontal: 12,
  },
  viewerFooter: {
    gap: Spacing.two,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 30,
  },
  viewerActionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  viewerAction: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    backgroundColor: Accent.primary,
  },
  viewerActionSecondary: {
    backgroundColor: '#1B345E',
  },
  viewerActionLabel: {
    color: '#FFFFFF',
  },
  viewerTextAction: {
    flex: 1,
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  viewerTextActionLabel: {
    color: '#B8CAE3',
  },
  viewerDeleteActionLabel: {
    color: '#FFB1B1',
  },
  compareHeaderIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(31, 87, 214, 0.16)',
  },
  comparePickerPanel: {
    borderWidth: 1,
    borderRadius: Radius.large,
    backgroundColor: '#0D1A33',
    padding: Spacing.three,
    gap: Spacing.three,
    maxWidth: 560,
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
    maxHeight: 500,
  },
  compareSourceSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#2B4A77',
    borderRadius: 14,
    backgroundColor: '#15294D',
    padding: 8,
  },
  compareSourceThumbnail: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: '#20385F',
  },
  compareSourceCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  compareSourceLabel: {
    color: '#7A9CC4',
  },
  compareSourceDate: {
    color: '#FFFFFF',
  },
  comparePickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  comparePickerTile: {
    width: '48%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#15294D',
    borderWidth: 1,
    borderColor: '#274975',
  },
  comparePickerImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#15294D',
  },
  comparePickerTileCopy: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    paddingHorizontal: Spacing.one,
    paddingVertical: 5,
  },
  comparePickerDiffBadge: {
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(31, 87, 214, 0.22)',
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  comparePickerDiffBadgeText: {
    color: '#BFD3F7',
    fontSize: 10,
    lineHeight: 13,
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
    gap: 14,
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
  compareExportCardDivider: {
    borderRightWidth: 2,
    borderRightColor: '#1B345E',
  },
  compareExportHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
  },
  compareExportHeaderTitle: {
    color: '#FFFFFF',
  },
  compareExportHeaderMeta: {
    color: '#7A9CC4',
  },
  compareExportCaption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  compareExportCaptionLabel: {
    color: '#BFD3F7',
    fontSize: 11,
    letterSpacing: 0.6,
  },
  compareExportCaptionDate: {
    color: '#7A9CC4',
    fontSize: 11,
  },
  compareExportImageViewport: {
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#0D1A33',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
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
  compareMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  compareMetaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(31, 87, 214, 0.16)',
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  compareMetaBadgeText: {
    color: '#BFD3F7',
  },
  compareSwapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.pill,
    backgroundColor: '#1B345E',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  compareSwapButtonText: {
    color: '#FFFFFF',
  },
  compareGrid: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 10,
    alignItems: 'stretch',
  },
  compareCard: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  compareImageFrame: {
    position: 'relative',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#274975',
  },
  compareImageViewport: {
    height: 250,
    backgroundColor: '#15294D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compareChip: {
    position: 'absolute',
    top: 10,
    left: 10,
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  compareChipBefore: {
    backgroundColor: 'rgba(13, 26, 51, 0.8)',
    borderColor: '#3A557F',
  },
  compareChipAfter: {
    backgroundColor: Accent.primary,
    borderColor: Accent.primary,
  },
  compareChipTextBefore: {
    color: '#E3ECFB',
    fontSize: 10,
    letterSpacing: 0.6,
  },
  compareChipTextAfter: {
    color: '#FFFFFF',
    fontSize: 10,
    letterSpacing: 0.6,
  },
  compareCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  compareZoomResetButton: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(13, 26, 51, 0.72)',
    borderWidth: 1,
    borderColor: '#3A557F',
  },
  compareZoomHint: {
    color: '#7A9CC4',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  compareCardLabel: {
    color: '#FFFFFF',
  },
  compareCardMeta: {
    color: '#D6E1F5',
  },
  compareImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#15294D',
  },
  compareLinkButton: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 6,
    minHeight: 30,
  },
  compareLinkButtonText: {
    color: '#9FB4D4',
  },
  compareFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
});
