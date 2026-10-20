/**
 * ScreenSafeArea
 * ──────────────
 * Wraps a screen's root element to ensure content never overlaps
 * the device status bar, camera notch, or bottom home-indicator /
 * gesture navigation bar on both iOS and Android.
 *
 * Usage variants
 * ──────────────
 * 1. Scrollable screens (default):
 *    <ScreenSafeArea>
 *      <ScrollView>…</ScrollView>
 *    </ScreenSafeArea>
 *
 * 2. Full-height non-scrollable screens (e.g. POS, Login):
 *    <ScreenSafeArea flex>…</ScreenSafeArea>
 *
 * 3. Only protect the bottom inset (screens inside Stack with a header):
 *    <ScreenSafeArea edges={['bottom']}>…</ScreenSafeArea>
 *
 * 4. Custom background colour:
 *    <ScreenSafeArea backgroundColor={theme.background}>…</ScreenSafeArea>
 */

import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

interface ScreenSafeAreaProps {
  children: React.ReactNode;
  /** Extra style applied to the outer SafeAreaView */
  style?: ViewStyle;
  /** Override background color (defaults to theme.background) */
  backgroundColor?: string;
  /** Which edges to protect. Default: ['top', 'bottom'] for headerless screens,
   *  or ['bottom'] for screens that live inside expo-router Stack (which already
   *  handles the top inset via the header). Pass [] to disable completely. */
  edges?: Edge[];
  /** If true, sets flex: 1 on the container */
  flex?: boolean;
}

export function ScreenSafeArea({
  children,
  style,
  backgroundColor,
  edges = ['top', 'left', 'right', 'bottom'],
  flex = true,
}: ScreenSafeAreaProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const bg = backgroundColor ?? theme.background;

  return (
    <SafeAreaView
      edges={edges}
      style={[
        styles.base,
        flex && styles.flex,
        { backgroundColor: bg },
        style,
      ]}
    >
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
  },
  flex: {
    flex: 1,
  },
});

export default ScreenSafeArea;
