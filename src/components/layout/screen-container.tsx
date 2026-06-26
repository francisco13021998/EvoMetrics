import React, { ReactNode, useEffect, useState } from 'react';
import {
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleProp,
    StyleSheet,
    View,
    ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ScreenContainerProps = {
  children: ReactNode;
  scrollable?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
};

export function ScreenContainer({
  children,
  scrollable = true,
  contentStyle,
}: ScreenContainerProps) {
  const theme = useTheme();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const shouldAvoidKeyboard = Platform.OS === 'ios';

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return undefined;
    }

    const showEvent = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideEvent = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showEvent.remove();
      hideEvent.remove();
    };
  }, []);

  const content = (
    <View
      style={[
        styles.content,
        { paddingBottom: Spacing.six + keyboardHeight },
        contentStyle,
      ]}>
      {children}
    </View>
  );

  const container = (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {scrollable ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={shouldAvoidKeyboard}
          showsVerticalScrollIndicator={false}>
          {content}
        </ScrollView>
      ) : (
        <View style={styles.staticWrapper}>{content}</View>
      )}
    </SafeAreaView>
  );

  if (shouldAvoidKeyboard) {
    return (
      <KeyboardAvoidingView
        style={[styles.keyboardAvoidingView, { backgroundColor: theme.background }]}
        behavior="padding"
        keyboardVerticalOffset={0}>
        {container}
      </KeyboardAvoidingView>
    );
  }

  return <View style={[styles.keyboardAvoidingView, { backgroundColor: theme.background }]}>{container}</View>;
}

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  staticWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: 0,
  },
});