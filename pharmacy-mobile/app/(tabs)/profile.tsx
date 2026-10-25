import React from 'react';
import { StyleSheet, Pressable, Alert, ScrollView } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useAuth } from '@/context/AuthContext';
import {
  User,
  LogOut,
  ShieldCheck,
  Mail,
  LogIn,
  HeartPulse,
  Package,
  FileText,
  Heart,
  Phone,
  Info,
  Server,
  Layers,
  ChevronRight,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { layout } from '@/constants/theme';
import { API_URL } from '@/api/client';
import { Badge } from '@/components/ui/Badge';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandLogo } from '@/components/ui/BrandLogo';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of MediQuick?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        onPress: async () => {
          await logout();
          router.replace('/(tabs)');
        },
        style: 'destructive',
      },
    ]);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={{ paddingBottom: 24 }}
    >
      {/* Header Profile Card */}
      <View style={[styles.headerCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.headerRow}>
          <View style={[styles.avatar, { backgroundColor: user ? theme.primarySoft : '#ffffff', borderColor: theme.primary, overflow: 'hidden' }]}>
            {user ? (
              <Text style={[styles.avatarText, { color: theme.primary }]}>
                {user.username.charAt(0).toUpperCase()}
              </Text>
            ) : (
              <BrandLogo size="icon" width={52} height={52} />
            )}
          </View>
          <View style={styles.userCopy}>
            <Text style={[styles.username, { color: theme.text }]}>
              {user ? user.username : 'Guest Customer'}
            </Text>
            {user ? (
              <View style={styles.badgeRow}>
                <Badge
                  label={user.role ? user.role.toUpperCase() : 'STAFF'}
                  variant="primary"
                  icon={<ShieldCheck size={12} color={theme.primary} />}
                />
              </View>
            ) : (
              <Text style={[styles.guestSubtitle, { color: theme.mutedText }]}>
                Sign in with a staff account for operations access
              </Text>
            )}
          </View>
        </View>

        {user?.email ? (
          <View style={[styles.emailRow, { borderTopColor: theme.borderLight }]}>
            <Mail size={16} color={theme.mutedText} />
            <Text style={[styles.emailText, { color: theme.textSecondary }]}>{user.email}</Text>
          </View>
        ) : null}

        {user ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            style={({ pressed }) => [
              styles.signOutBtn,
              { backgroundColor: theme.dangerSoft, borderColor: theme.danger, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={handleLogout}
          >
            <LogOut size={16} color={theme.danger} />
            <Text style={[styles.signOutText, { color: theme.danger }]}>Sign Out</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Staff Sign In"
            style={({ pressed }) => [
              styles.signInBtn,
              { backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={() => router.push('/(auth)/login')}
          >
            <LogIn size={18} color="#ffffff" />
            <Text style={styles.signInBtnText}>Staff Sign In</Text>
          </Pressable>
        )}
      </View>

      {/* Customer Quick Links */}
      <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionHeading, { color: theme.mutedText }]}>CUSTOMER SERVICES</Text>

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.menuItem, pressed && styles.itemPressed]}
          onPress={() => router.push('/track-order')}
        >
          <View style={[styles.menuIconWrap, { backgroundColor: theme.infoSoft }]}>
            <Package size={18} color={theme.info} />
          </View>
          <View style={styles.menuCopy}>
            <Text style={[styles.menuTitle, { color: theme.text }]}>Track Order</Text>
            <Text style={[styles.menuSub, { color: theme.mutedText }]}>
              Check status with order & phone number
            </Text>
          </View>
          <ChevronRight size={18} color={theme.mutedText} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.menuItem, pressed && styles.itemPressed]}
          onPress={() => router.push('/prescription-upload')}
        >
          <View style={[styles.menuIconWrap, { backgroundColor: theme.primarySoft }]}>
            <FileText size={18} color={theme.primary} />
          </View>
          <View style={styles.menuCopy}>
            <Text style={[styles.menuTitle, { color: theme.text }]}>Prescription Upload & Track</Text>
            <Text style={[styles.menuSub, { color: theme.mutedText }]}>
              Upload doctor scripts for pharmacy review
            </Text>
          </View>
          <ChevronRight size={18} color={theme.mutedText} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.menuItem, pressed && styles.itemPressed]}
          onPress={() => router.push('/health-wellness')}
        >
          <View style={[styles.menuIconWrap, { backgroundColor: theme.accentSoft }]}>
            <Heart size={18} color={theme.accent} />
          </View>
          <View style={styles.menuCopy}>
            <Text style={[styles.menuTitle, { color: theme.text }]}>Health & Wellness Guide</Text>
            <Text style={[styles.menuSub, { color: theme.mutedText }]}>
              Nutrition, OTC guidance & wellness tips
            </Text>
          </View>
          <ChevronRight size={18} color={theme.mutedText} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.menuItem, pressed && styles.itemPressed]}
          onPress={() => router.push('/contact')}
        >
          <View style={[styles.menuIconWrap, { backgroundColor: theme.successSoft }]}>
            <Phone size={18} color={theme.success} />
          </View>
          <View style={styles.menuCopy}>
            <Text style={[styles.menuTitle, { color: theme.text }]}>Contact Pharmacy & Support</Text>
            <Text style={[styles.menuSub, { color: theme.mutedText }]}>
              Send inquiry, phone & store location
            </Text>
          </View>
          <ChevronRight size={18} color={theme.mutedText} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.menuItem, pressed && styles.itemPressed]}
          onPress={() => router.push('/about')}
        >
          <View style={[styles.menuIconWrap, { backgroundColor: theme.surfaceMuted }]}>
            <Info size={18} color={theme.textSecondary} />
          </View>
          <View style={styles.menuCopy}>
            <Text style={[styles.menuTitle, { color: theme.text }]}>About MediQuick</Text>
            <Text style={[styles.menuSub, { color: theme.mutedText }]}>
              Hours, licensed premises & pharmacy info
            </Text>
          </View>
          <ChevronRight size={18} color={theme.mutedText} />
        </Pressable>
      </View>

      {/* Staff Operations Shortcut */}
      {user ? (
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionHeading, { color: theme.mutedText }]}>STAFF WORKSPACE</Text>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.menuItem, pressed && styles.itemPressed]}
            onPress={() => router.push('/(tabs)/operations')}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: theme.primarySoft }]}>
              <Layers size={18} color={theme.primary} />
            </View>
            <View style={styles.menuCopy}>
              <Text style={[styles.menuTitle, { color: theme.text }]}>Operations Command Center</Text>
              <Text style={[styles.menuSub, { color: theme.mutedText }]}>
                Dashboard, Orders, Prescriptions, Reports & Admin
              </Text>
            </View>
            <ChevronRight size={18} color={theme.mutedText} />
          </Pressable>
        </View>
      ) : null}

      {/* System & Connection Info */}
      <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionHeading, { color: theme.mutedText }]}>SYSTEM INFORMATION</Text>
        <View style={styles.infoRow}>
          <Server size={16} color={theme.mutedText} />
          <Text style={[styles.infoLabel, { color: theme.mutedText }]}>Connected API Server:</Text>
          <Text style={[styles.infoValue, { color: theme.text }]} numberOfLines={1}>
            {API_URL}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <ShieldCheck size={16} color={theme.mutedText} />
          <Text style={[styles.infoLabel, { color: theme.mutedText }]}>App Build:</Text>
          <Text style={[styles.infoValue, { color: theme.text }]}>MediQuick Mobile v1.0.0</Text>
        </View>
      </View>

      <View style={styles.footerSpace} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: layout.spacing.lg,
  },
  headerCard: {
    borderRadius: layout.radius.xl,
    padding: layout.spacing.lg,
    borderWidth: 1,
    marginBottom: layout.spacing.lg,
    shadowColor: '#0b3156',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '900',
  },
  userCopy: {
    marginLeft: layout.spacing.md,
    flex: 1,
    backgroundColor: 'transparent',
  },
  username: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  badgeRow: {
    marginTop: 4,
    backgroundColor: 'transparent',
  },
  guestSubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: layout.spacing.md,
    paddingTop: layout.spacing.md,
    borderTopWidth: 1,
    backgroundColor: 'transparent',
  },
  emailText: {
    fontSize: 13,
    fontWeight: '500',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: layout.spacing.md,
    paddingVertical: 10,
    borderRadius: layout.radius.md,
    borderWidth: 1,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '700',
  },
  signInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: layout.spacing.md,
    paddingVertical: 12,
    borderRadius: layout.radius.md,
  },
  signInBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  section: {
    borderRadius: layout.radius.lg,
    borderWidth: 1,
    padding: layout.spacing.md,
    marginBottom: layout.spacing.lg,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: layout.spacing.sm,
    paddingHorizontal: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: layout.radius.sm,
  },
  itemPressed: {
    opacity: 0.7,
  },
  menuIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: layout.spacing.md,
  },
  menuCopy: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  menuSub: {
    fontSize: 11,
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: 'transparent',
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  footerSpace: {
    height: 40,
    backgroundColor: 'transparent',
  },
});
