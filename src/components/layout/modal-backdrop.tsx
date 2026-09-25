import React, { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';

type ModalBackdropProps = {
  style: StyleProp<ViewStyle>;
  onPress: () => void;
  children: ReactNode;
};

/**
 * Backdrop for transparent, centered `Modal` panels that contain a `TextInput`/`AppInput`.
 * `KeyboardAvoidingView` here does what `ScreenContainer` does for regular screens: a plain
 * `Modal` sits outside the screen's view hierarchy, so it needs its own keyboard handling to
 * keep the panel above the keyboard instead of letting it cover the focused field.
 */
export function ModalBackdrop({ style, onPress, children }: ModalBackdropProps) {
  return (
    <KeyboardAvoidingView style={style} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onPress} />
      {children}
    </KeyboardAvoidingView>
  );
}
