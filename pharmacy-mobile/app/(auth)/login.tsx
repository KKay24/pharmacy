import React, { useState } from 'react';
import { StyleSheet, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useAuth } from '@/context/AuthContext';
import apiClient, { API_URL } from '@/api/client';
import { router } from 'expo-router';
import { Lock, User } from 'lucide-react-native';

export default function LoginScreen() {
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!usernameInput || !passwordInput) {
      setError('Please enter both username and password');
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
        setError(response.data.error || 'Login failed');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      const errorMessage =
        err.response?.data?.error ||
        `Connection error. Backend not reachable at ${API_URL}.`;
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>MediQuick Mobile</Text>
        <Text style={styles.subtitle}>Pharmacy Management</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <User size={20} color="#64748b" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="#94a3b8"
            value={usernameInput}
            onChangeText={setUsernameInput}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer}>
          <Lock size={20} color="#64748b" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#94a3b8"
            value={passwordInput}
            onChangeText={setPasswordInput}
            secureTextEntry
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable 
          style={({ pressed }) => [
            styles.button,
            { opacity: pressed || loading ? 0.8 : 1 }
          ]} 
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 5,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    marginBottom: 15,
    paddingHorizontal: 15,
    height: 55,
    backgroundColor: '#f8fafc',
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#0f172a',
  },
  button: {
    backgroundColor: '#2563eb',
    height: 55,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  errorText: {
    color: '#ef4444',
    marginBottom: 15,
    fontSize: 14,
    textAlign: 'center',
  },
});
