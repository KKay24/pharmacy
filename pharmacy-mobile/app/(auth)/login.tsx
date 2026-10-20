import React, { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Text, View } from '@/components/Themed';
import { useAuth } from '@/context/AuthContext';
import apiClient, { API_URL } from '@/api/client';
import { router } from 'expo-router';
import { Lock, User, ArrowLeft } from 'lucide-react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { layout } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandLogo } from '@/components/ui/BrandLogo';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!usernameInput || !passwordInput) {
      setError('Please enter both username and password.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await apiClient.post('/api/auth/login', {
        username: usernameInput.trim(),
        password: passwordInput,
      });

      if (response.data.success) {
        await login({
          token: response.data.token,
          user: response.data.user,
        });
        router.replace('/(tabs)');
      } else {
        setError(response.data.error || 'Login failed. Please check credentials.');
      }
    } catch (err: unknown) {
      console.error('Login error:', err);
      const requestError = err as { response?: { data?: { error?: string; message?: string } } };
      const errorMessage =
        requestError.response?.data?.error ||
        requestError.response?.data?.message ||
        `Connection error. Backend not reachable at ${API_URL}.`;
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top + 16, 24),
            paddingBottom: Math.max(insets.bottom + 24, 32),
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to store"
          onPress={() => router.replace('/(tabs)')}
          style={styles.backButton}
        >
          <ArrowLeft size={20} color={theme.text} />
          <Text style={[styles.backText, { color: theme.text }]}>Back to Store</Text>
        </Pressable>

        <View style={styles.header}>
          <BrandLogo size="xl" style={{ alignSelf: 'center', marginBottom: 12 }} />
          <Text style={[styles.subtitle, { color: theme.mutedText }]}>
            Staff & Operations Sign-in
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Welcome Back</Text>
          <Text style={[styles.cardSubtitle, { color: theme.mutedText }]}>
            Enter your credentials to access operations, POS, and inventory.
          </Text>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: theme.dangerSoft, borderColor: theme.danger }]}>
              <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.formGroup}>
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Username</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
              <User size={19} color={theme.mutedText} style={styles.icon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Username or staff ID"
                placeholderTextColor={theme.mutedText}
                value={usernameInput}
                onChangeText={setUsernameInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Password</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
              <Lock size={19} color={theme.mutedText} style={styles.icon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Enter password"
                placeholderTextColor={theme.mutedText}
                value={passwordInput}
                onChangeText={setPasswordInput}
                secureTextEntry
              />
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign in"
            style={({ pressed }) => [
              styles.button,
              {
                backgroundColor: theme.primary,
                opacity: pressed || loading ? 0.85 : 1,
              },
            ]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Sign In to Workspace</Text>
            )}
          </Pressable>

          <View style={styles.securityNote}>
            <Text style={[styles.securityText, { color: theme.mutedText }]}>
              Secured MediQuick Operations Gateway · v1.0.0
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: layout.spacing.xl,
    justifyContent: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: layout.spacing.lg,
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    marginBottom: layout.spacing.xxl,
    backgroundColor: 'transparent',
  },
  logoMark: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: layout.spacing.md,
    shadowColor: '#039d83',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  brand: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  card: {
    borderRadius: layout.radius.xl,
    padding: layout.spacing.xl,
    borderWidth: 1,
    shadowColor: '#0b3156',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: layout.spacing.lg,
    lineHeight: 18,
  },
  errorBox: {
    padding: layout.spacing.md,
    borderRadius: layout.radius.sm,
    borderWidth: 1,
    marginBottom: layout.spacing.lg,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
  },
  formGroup: {
    marginBottom: layout.spacing.md,
    backgroundColor: 'transparent',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: layout.radius.md,
    paddingHorizontal: layout.spacing.md,
    height: 52,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    height: '100%',
  },
  button: {
    height: 52,
    borderRadius: layout.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: layout.spacing.sm,
    shadowColor: '#039d83',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  securityNote: {
    marginTop: layout.spacing.xl,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  securityText: {
    fontSize: 11,
    fontWeight: '500',
  },
});
