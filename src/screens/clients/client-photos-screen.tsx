import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/feedback/empty-state';
import { StatusBanner } from '@/components/feedback/status-banner';
import { AppButton } from '@/components/forms/app-button';
import { AppSelect } from '@/components/forms/app-select';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { ScreenContainer } from '@/components/layout/screen-container';
import { Accent, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { clientsService } from '@/services/clients';
import { photosService } from '@/services/photos';
import { Client, ClientPhoto } from '@/types/domain';

import { ThemedText } from '@/components/themed-text';

type ClientPhotosScreenProps = {
  clientId: string;
};

export function ClientPhotosScreen({ clientId }: ClientPhotosScreenProps) {
  const { user } = useAuth();
  const theme = useTheme();
  const [client, setClient] = useState<Client | null>(null);
  const [photos, setPhotos] = useState<ClientPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<ClientPhoto['type']>('progress');

  const showInitialLoading = isLoading && !client;

  async function loadContent() {
    if (!user?.id || !clientId) {
      setClient(null);
      setPhotos([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const nextClient = await clientsService.getById(clientId, user.id);
      setClient(nextClient);

      if (!nextClient) {
        setPhotos([]);
        return;
      }

      const nextPhotos = await photosService.listByClient(nextClient.id, user.id);
      setPhotos(nextPhotos);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cargar la galeria del cliente.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadContent();
  }, [clientId, user?.id]);

  async function handlePickImage() {
    if (!user?.id || !client || isUploading) {
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
      await photosService.uploadFromDevice({
        ownerId: user.id,
        clientId: client.id,
        asset: result.assets[0],
        type: selectedType,
      });

      await loadContent();
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
            setDeletingPhotoId(photo.id);
            setErrorMessage(null);

            try {
              await photosService.remove(photo.id, user.id);
              await loadContent();
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

      <PageSection first>
        {isLoading ? <StatusBanner tone="info" loading message="Actualizando galeria..." /> : null}
        {errorMessage ? <StatusBanner tone="danger" message={errorMessage} /> : null}

        <AppSelect
          label="Tipo de foto"
          value={selectedType}
          options={PHOTO_TYPES.map((photoType) => ({
            label: photoType.label,
            value: photoType.value,
          }))}
          placeholder="Selecciona el tipo"
          onChange={(value) => setSelectedType(value as ClientPhoto['type'])}
        />

        <AppButton label="Subir imagen" onPress={() => void handlePickImage()} loading={isUploading} />
      </PageSection>

      <PageSection label="Imágenes">
        {photos.length === 0 ? (
          <EmptyState
            title="Galeria vacia"
            description="Selecciona y sube la primera imagen del cliente."
            actionLabel="Subir imagen"
            actionVariant="primary"
            onAction={() => void handlePickImage()}
          />
        ) : (
          <View style={styles.grid}>
            {photos.map((photo) => (
              <View key={photo.id} style={[styles.tile, { borderBottomColor: theme.backgroundSelected }]}>
                <Image source={{ uri: photo.imageUrl }} style={[styles.preview, { backgroundColor: Accent.primaryMuted }]} contentFit="cover" transition={150} />
                <View style={styles.tileFooter}>
                  <View>
                    <ThemedText type="smallBold">{PHOTO_TYPE_LABELS[photo.type]}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {new Date(photo.capturedAt).toLocaleDateString('es-ES')}
                    </ThemedText>
                  </View>
                  <AppButton
                    label="Borrar"
                    variant="danger"
                    size="compact"
                    fullWidth={false}
                    loading={deletingPhotoId === photo.id}
                    onPress={() => handleDeletePhoto(photo)}
                  />
                </View>
              </View>
            ))}
          </View>
        )}
      </PageSection>
    </ScreenContainer>
  );
}

const PHOTO_TYPES: Array<{ value: ClientPhoto['type']; label: string }> = [
  { value: 'progress', label: 'Progreso' },
  { value: 'front', label: 'Frontal' },
  { value: 'side', label: 'Lateral' },
  { value: 'back', label: 'Espalda' },
];

const PHOTO_TYPE_LABELS: Record<ClientPhoto['type'], string> = {
  progress: 'Progreso',
  front: 'Frontal',
  side: 'Lateral',
  back: 'Espalda',
};

const styles = StyleSheet.create({
  grid: {
    gap: Spacing.three,
  },
  tile: {
    width: '100%',
    paddingBottom: Spacing.three,
    borderBottomWidth: 1,
  },
  preview: {
    height: 240,
    width: '100%',
  },
  tileFooter: {
    padding: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
});