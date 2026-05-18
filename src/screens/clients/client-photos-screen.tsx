import { File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/feedback/empty-state';
import { StatusBanner } from '@/components/feedback/status-banner';
import { AppButton } from '@/components/forms/app-button';
import { AppDateTimeInput } from '@/components/forms/app-date-time';
import { AppInput } from '@/components/forms/app-input';
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
  const perimeter = calculateBodyFatFromPerimeters(client.sex, {
    neckCm: revision.neckCm,
    bellyCm: revision.bellyCm,
    gluteCm: revision.gluteCm,
    heightCm: client.heightCm,
  });
  const skinfold = calculateBodyFatFromSkinfolds(client.sex, client.age, {
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
    skinfoldBodyFatPct: skinfold?.bodyFatPct ?? null,
  })?.bodyFatPct ?? null;
}

export function ClientPhotosScreen({ clientId, initialRevisionId = null, autoOpenUpload = false }: ClientPhotosScreenProps) {
  const { user, userRole } = useAuth();
  const isAthlete = userRole === 'athlete';
  const theme = useTheme();
  const [client, setClient] = useState<Client | null>(null);
  const [photos, setPhotos] = useState<ClientPhoto[]>([]);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedFilterType, setSelectedFilterType] = useState<'all' | string>('all');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadCapturedAt, setUploadCapturedAt] = useState<Date | null>(new Date());
  const [uploadTypeSelection, setUploadTypeSelection] = useState<'front' | 'back' | 'side' | 'other'>('front');
  const [uploadCustomType, setUploadCustomType] = useState('');
  const [uploadRevisionId, setUploadRevisionId] = useState<string>('none');
  const [previewPhoto, setPreviewPhoto] = useState<ClientPhoto | null>(null);
  const [hasAutoOpenedUpload, setHasAutoOpenedUpload] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [editPhoto, setEditPhoto] = useState<ClientPhoto | null>(null);
  const [editCapturedAt, setEditCapturedAt] = useState<Date | null>(null);
  const [editTypeSelection, setEditTypeSelection] = useState<'front' | 'back' | 'side' | 'other'>('front');
  const [editCustomType, setEditCustomType] = useState('');
  const [editRevisionId, setEditRevisionId] = useState<string>('none');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const showInitialLoading = isLoading && !client;

  const photoTypesForFilter = useMemo(() => {
    const knownOrder = ['front', 'back', 'side'];
    const fromPhotos = Array.from(new Set(
      photos
        .map((photo) => photo.type.trim())
        .filter((type) => Boolean(type) && type.toLowerCase() !== 'all')
    ));
    const ordered = [
      ...knownOrder.filter((type) => fromPhotos.includes(type)),
      ...fromPhotos.filter((type) => !knownOrder.includes(type)).sort((left, right) => left.localeCompare(right, 'es-ES')),
    ];

    return ordered;
  }, [photos]);

  const filteredPhotos = useMemo(() => {
    const base = selectedFilterType === 'all'
      ? photos
      : photos.filter((photo) => photo.type === selectedFilterType);

    return [...base].sort((left, right) => new Date(right.capturedAt).getTime() - new Date(left.capturedAt).getTime());
  }, [photos, selectedFilterType]);

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

  function openEditModal(photo: ClientPhoto) {
    const isKnownType = ['front', 'back', 'side'].includes(photo.type);
    setEditCapturedAt(parseIsoDateOrNow(photo.capturedAt));
    setEditTypeSelection(isKnownType ? (photo.type as 'front' | 'back' | 'side') : 'other');
    setEditCustomType(isKnownType ? '' : photo.type);
    setEditRevisionId(photo.revisionId ?? 'none');
    setEditPhoto(photo);
    setPreviewPhoto(null);
  }

  function closeEditModal() {
    setEditPhoto(null);
  }

  function resolveEditType() {
    if (editTypeSelection !== 'other') {
      return editTypeSelection;
    }
    const normalized = editCustomType.trim();
    return normalized.length > 0 ? normalized : null;
  }

  async function handleSaveEdit() {
    if (!user?.id || !editPhoto || isSavingEdit) {
      return;
    }

    const resolvedType = resolveEditType();

    if (!resolvedType) {
      Alert.alert('Tipo requerido', 'Indica un tipo personalizado para la imagen.');
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
        type: resolvedType,
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

  function getPhotoTypeLabel(type: string) {
    if (type === 'front') return 'Frontal';
    if (type === 'back') return 'Espalda';
    if (type === 'side') return 'Lateral';

    return type;
  }

  function resetUploadForm() {
    const hasDefaultRevision = Boolean(initialRevisionId && revisions.some((revision) => revision.id === initialRevisionId));
    const defaultRevision = hasDefaultRevision ? revisions.find((revision) => revision.id === initialRevisionId) ?? null : null;

    setUploadCapturedAt(defaultRevision ? parseIsoDateOrNow(defaultRevision.reviewedAt) : new Date());
    setUploadTypeSelection('front');
    setUploadCustomType('');
    setUploadRevisionId(hasDefaultRevision ? initialRevisionId! : 'none');
  }

  function openUploadModal() {
    resetUploadForm();
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

      if (selectedFilterType !== 'all') {
        const stillExists = nextPhotos.some((photo) => photo.type === selectedFilterType);

        if (!stillExists) {
          setSelectedFilterType('all');
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cargar la galeria del cliente.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [clientId, selectedFilterType, user?.id]);

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
    setUploadTypeSelection('front');
    setUploadCustomType('');
    setUploadRevisionId(hasDefaultRevision ? initialRevisionId! : 'none');
    setIsUploadModalOpen(true);
    setHasAutoOpenedUpload(true);
  }, [autoOpenUpload, client, hasAutoOpenedUpload, initialRevisionId, isLoading, revisions]);

  async function handleUploadFromModal() {
    if (!user?.id || !client || isUploading) {
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

    setIsUploading(true);

    try {
      const resolvedRevisionId = uploadRevisionId === 'none' ? null : uploadRevisionId;

      const newPhoto = await photosService.uploadFromDevice({
        ownerId: user.id,
        clientId: client.id,
        asset: result.assets[0],
        revisionId: resolvedRevisionId,
        type: resolvedType,
        capturedAt: toDateOnlyIso(uploadCapturedAt),
      });

      setPhotos((prev) => [newPhoto, ...prev].sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()));
      closeUploadModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo subir la imagen.';
      setErrorMessage(message);
    } finally {
      setIsUploading(false);
    }
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
                if (selectedFilterType !== 'all' && next.every((p) => p.type !== selectedFilterType)) {
                  setSelectedFilterType('all');
                }
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

        <View style={styles.filterRow}>
          <Pressable
            onPress={() => setSelectedFilterType('all')}
            style={[
              styles.filterChip,
              {
                backgroundColor: selectedFilterType === 'all' ? Accent.primary : '#FFFFFF',
                borderColor: selectedFilterType === 'all' ? Accent.primary : theme.backgroundSelected,
              },
            ]}>
            <ThemedText type="smallBold" style={{ color: selectedFilterType === 'all' ? '#FFFFFF' : '#10203B' }}>Todos</ThemedText>
          </Pressable>
          {photoTypesForFilter.map((type) => (
            <Pressable
              key={type}
              onPress={() => setSelectedFilterType(type)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: selectedFilterType === type ? Accent.primary : '#FFFFFF',
                  borderColor: selectedFilterType === type ? Accent.primary : theme.backgroundSelected,
                },
              ]}>
              <ThemedText type="smallBold" style={{ color: selectedFilterType === type ? '#FFFFFF' : '#10203B' }}>{getPhotoTypeLabel(type)}</ThemedText>
            </Pressable>
          ))}
        </View>

        {filteredPhotos.length === 0 ? (
          <EmptyState
            title="Galería vacía"
            description={photos.length === 0 ? (isAthlete ? 'Aún no hay imágenes en tu galería.' : 'Sube la primera imagen del cliente.') : 'No hay imágenes para el tipo seleccionado.'}
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
                <View style={styles.tileBadge}>
                  <ThemedText type="smallBold" style={styles.tileBadgeText} numberOfLines={1}>
                    {getPhotoTypeLabel(photo.type)}
                  </ThemedText>
                </View>
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

              <AppSelect
                label="Tipo"
                value={uploadTypeSelection}
                options={UPLOAD_TYPE_OPTIONS}
                onChange={(value) => setUploadTypeSelection(value as 'front' | 'back' | 'side' | 'other')}
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

              {uploadTypeSelection === 'other' ? (
                <AppInput
                  label="Tipo personalizado"
                  placeholder="Ejemplo: Poses, Bikini, Competición..."
                  value={uploadCustomType}
                  onChangeText={setUploadCustomType}
                />
              ) : null}

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
                    <ThemedText type="smallBold" style={styles.viewerHeaderTitle}>
                      {getPhotoTypeLabel(previewPhoto.type)}
                    </ThemedText>
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

              <AppSelect
                label="Tipo"
                value={editTypeSelection}
                options={UPLOAD_TYPE_OPTIONS}
                onChange={(value) => setEditTypeSelection(value as 'front' | 'back' | 'side' | 'other')}
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

              {editTypeSelection === 'other' ? (
                <AppInput
                  label="Tipo personalizado"
                  placeholder="Ejemplo: Poses, Bikini, Competición..."
                  value={editCustomType}
                  onChangeText={setEditCustomType}
                />
              ) : null}

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

const UPLOAD_TYPE_OPTIONS = [
  { value: 'front', label: 'Frontal' },
  { value: 'back', label: 'Espalda' },
  { value: 'side', label: 'Lateral' },
  { value: 'other', label: 'Otro' },
];

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
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
  tileBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(13, 26, 51, 0.58)',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  tileBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    lineHeight: 13,
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
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: '#1C2E50',
  },
});