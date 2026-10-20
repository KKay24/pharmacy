import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { useFonts } from 'expo-font';
import { Stack, router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function InitialLayout() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, segments, isLoading]);

  if (!loaded || isLoading) {
    return null;
  }

  const screenHeaderOptions = {
    headerStyle: {
      backgroundColor: theme.navigationBar.card,
    },
    headerTintColor: theme.navigationBar.tint,
    headerTitleStyle: {
      fontWeight: '800' as const,
      color: theme.navigationBar.text,
      fontSize: 17,
    },
    headerShadowVisible: false,
    headerBackTitle: 'Back',
  };

  return (
    <Stack screenOptions={screenHeaderOptions}>
      {/* Tab Navigator */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'System Information' }} />

      {/* Staff & Operations Screens */}
      <Stack.Screen name="dashboard" options={{ title: 'Executive Dashboard' }} />
      <Stack.Screen name="orders" options={{ title: 'Online Orders' }} />
      <Stack.Screen name="support-center" options={{ title: 'Customer Support' }} />
      <Stack.Screen name="prescriptions" options={{ title: 'Prescription Queue' }} />
      <Stack.Screen name="add-stock" options={{ title: 'Restock Inventory' }} />
      <Stack.Screen name="profit-loss" options={{ title: 'Profit & Loss' }} />
      <Stack.Screen name="reports" options={{ title: 'Sales Analytics' }} />
      <Stack.Screen name="customers" options={{ title: 'Patient Directory' }} />
      <Stack.Screen name="suppliers" options={{ title: 'Suppliers' }} />
      <Stack.Screen name="expenses" options={{ title: 'Expenses' }} />
      <Stack.Screen name="team" options={{ title: 'Team & HR Hub' }} />

      {/* Customer Storefront Screens */}
      <Stack.Screen name="product/[id]" options={{ title: 'Medication Info' }} />
      <Stack.Screen name="track-order" options={{ title: 'Track Order' }} />
      <Stack.Screen name="prescription-upload" options={{ title: 'Prescription Services' }} />
      <Stack.Screen name="contact" options={{ title: 'Contact Us' }} />
      <Stack.Screen name="health-wellness" options={{ title: 'Health & Wellness' }} />
      <Stack.Screen name="about" options={{ title: 'About MediQuick' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <CartProvider>
          <InitialLayout />
        </CartProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
