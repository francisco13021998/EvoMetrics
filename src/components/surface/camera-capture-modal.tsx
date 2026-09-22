import { Ionicons } from '@expo/vector-icons';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/forms/app-button';
import { ThemedText } from '@/components/themed-text';
import { Accent, Radius } from '@/constants/theme';

export type CameraCaptureShot = {
  uri: string;
  width: number;
  height: number;
};

type CameraCaptureModalProps = {
  visible: boolean;
  onClose: () => void;
  onFinish: (shots: CameraCaptureShot[]) => void;
};

// Cámara continua: la vista de cámara permanece montada mientras el usuario dispara varias fotos
// seguidas (sin cerrarse entre una y otra) y solo se cierra cuando él mismo pulsa "Listo" o "Cancelar".
export function CameraCaptureModal({ visible, onClose, onFinish }: CameraCaptureModalProps) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [shots, setShots] = useState<CameraCaptureShot[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  function resetAndClose() {
    setShots([]);
    setIsCameraReady(false);
    onClose();
  }

  function handleFinish() {
    if (shots.length === 0) {
      resetAndClose();
      return;
    }

    const finishedShots = shots;
    setShots([]);
    setIsCameraReady(false);
    onFinish(finishedShots);
  }

  async function handleShutterPress() {
    if (!cameraRef.current || isCapturing || !isCameraReady) {
      return;
    }

    setIsCapturing(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9, skipProcessing: true });

      if (photo) {
        setShots((current) => [...current, { uri: photo.uri, width: photo.width, height: photo.height }]);
      }
    } catch {
      // Un fallo puntual al capturar no debe tumbar la sesión: el usuario puede volver a intentarlo.
    } finally {
      setIsCapturing(false);
    }
  }

  if (!visible) {
    return null;
  }

  if (!permission || !permission.granted) {
    return (
      <Modal visible animationType="slide" onRequestClose={resetAndClose}>
        <View style={[styles.permissionScreen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.permissionIcon}>
            <Ionicons name="camera-outline" size={28} color={Accent.primary} />
          </View>
          <ThemedText type="headline" style={styles.permissionTitle}>Permiso de cámara</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.permissionCopy}>
            {permission?.canAskAgain === false
              ? 'Has bloqueado el acceso a la cámara. Actívalo desde los ajustes del dispositivo para poder hacer fotos.'
              : 'Necesitamos acceso a la cámara para poder hacer fotos de progreso.'}
          </ThemedText>
          <View style={styles.permissionActions}>
            {permission?.canAskAgain !== false ? (
              <AppButton label="Dar permiso" onPress={() => void requestPermission()} />
            ) : null}
            <AppButton label="Cancelar" variant="ghost" onPress={resetAndClose} />
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" onRequestClose={resetAndClose}>
      <View style={styles.cameraScreen}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          onCameraReady={() => setIsCameraReady(true)}
        />

        <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
          <Pressable onPress={resetAndClose} accessibilityRole="button" accessibilityLabel="Cerrar cámara" style={styles.iconButton}>
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </Pressable>
          <View style={styles.counterPill}>
            <ThemedText type="smallBold" style={styles.counterPillText}>
              {shots.length === 0 ? 'Sin fotos' : `${shots.length} ${shots.length === 1 ? 'foto' : 'fotos'}`}
            </ThemedText>
          </View>
          <Pressable
            onPress={() => setFacing((current) => (current === 'back' ? 'front' : 'back'))}
            accessibilityRole="button"
            accessibilityLabel="Cambiar de cámara"
            style={styles.iconButton}>
            <Ionicons name="camera-reverse-outline" size={22} color="#FFFFFF" />
          </Pressable>
        </View>

        {!isCameraReady ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color="#FFFFFF" size="large" />
          </View>
        ) : null}

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          {shots.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbStrip}>
              {shots.map((shot, index) => (
                <Image key={`${shot.uri}-${index}`} source={{ uri: shot.uri }} style={styles.thumb} contentFit="cover" />
              ))}
            </ScrollView>
          ) : (
            <ThemedText type="small" style={styles.hintText}>Haz todas las fotos que necesites y pulsa Listo al terminar.</ThemedText>
          )}

          <View style={styles.shutterRow}>
            <View style={styles.shutterSideSlot}>
              <AppButton
                label={`Listo${shots.length > 0 ? ` (${shots.length})` : ''}`}
                variant="surface"
                size="compact"
                fullWidth={false}
                onPress={handleFinish}
                disabled={shots.length === 0}
              />
            </View>

            <Pressable
              onPress={() => void handleShutterPress()}
              disabled={isCapturing || !isCameraReady}
              accessibilityRole="button"
              accessibilityLabel="Hacer foto"
              style={({ pressed }) => [styles.shutterButton, pressed && styles.shutterButtonPressed]}>
              {isCapturing ? <ActivityIndicator color="#FFFFFF" /> : <View style={styles.shutterInner} />}
            </Pressable>

            <View style={styles.shutterSideSlot} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  cameraScreen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  counterPill: {
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  counterPillText: {
    color: '#FFFFFF',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  hintText: {
    color: '#E7ECF5',
    textAlign: 'center',
  },
  thumbStrip: {
    gap: 8,
    paddingBottom: 2,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: '#1B1B1B',
  },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shutterSideSlot: {
    width: 96,
  },
  shutterButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterButtonPressed: {
    opacity: 0.8,
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
  },
  permissionScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  permissionIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F0FF',
    marginBottom: 4,
  },
  permissionTitle: {
    color: '#10203B',
    textAlign: 'center',
  },
  permissionCopy: {
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 320,
  },
  permissionActions: {
    width: '100%',
    maxWidth: 320,
    gap: 10,
    marginTop: 8,
  },
});
