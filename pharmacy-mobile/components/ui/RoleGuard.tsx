import React from 'react';
import { StyleSheet, Pressable } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useAuth, ProtectedPage } from '@/context/AuthContext';
import { ShieldAlert, LogIn } from 'lucide-react-native';
import { router } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { layout } from '@/constants/theme';
import { BrandLogo } from '@/components/ui/BrandLogo';

interface RoleGuardProps {
  /** The page key to check against canAccess() */
  page: ProtectedPage;
  children: React.ReactNode;
}

/**
 * Wraps a screen and shows an access-denied state if the current user
 * doesn't have permission for the given page.
 *
 * Usage:
 *   <RoleGuard page="dashboard">
 *     <DashboardContent />
 *   </RoleGuard>
 */
export function RoleGuard({ page, children }: RoleGuardProps) {
  const { user, canAccess } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  if (!user) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <BrandLogo size="md" width={150} height={50} style={{ marginBottom: 20 }} />
        <View style={[styles.iconWrap, { backgroundColor: theme.primarySoft }]}>
          <LogIn size={36} color={theme.primary} />
        </View>
        <Text style={[styles.title, { color: theme.text }]}>Sign In Required</Text>
        <Text style={[styles.subtitle, { color: theme.mutedText }]}>
          Please sign in with your staff account to access this page.
        </Text>
        <Pressable
          style={[styles.btn, { backgroundColor: theme.primary }]}
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={styles.btnText}>Staff Sign In</Text>
        </Pressable>
      </View>
    );
  }

  if (!canAccess(page)) {
    const roleLabel =
      user.role === 'admin'
        ? 'Administrator'
        : user.role === 'manager'
        ? 'Manager'
        : 'Staff';

    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <View style={[styles.iconWrap, { backgroundColor: theme.dangerSoft }]}>
          <ShieldAlert size={40} color={theme.danger} />
        </View>
        <Text style={[styles.title, { color: theme.text }]}>Access Denied</Text>
        <Text style={[styles.subtitle, { color: theme.mutedText }]}>
          Your role ({roleLabel}) does not have permission to access this page.
          {'\n'}Please contact your administrator.
        </Text>
        <Pressable
          style={[styles.btn, { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.btnText, { color: theme.text }]}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: layout.spacing.xl,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: layout.spacing.lg,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    maxWidth: 300,
    marginBottom: layout.spacing.xl,
  },
  btn: {
    paddingHorizontal: layout.spacing.xl,
    paddingVertical: 14,
    borderRadius: layout.radius.md,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
