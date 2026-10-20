import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
} from 'react-native';
import { Text, View } from '@/components/Themed';
import { useAuth } from '@/context/AuthContext';
import { router } from 'expo-router';
import {
  LayoutDashboard,
  ShoppingCart,
  ClipboardList,
  Headset,
  Boxes,
  PackagePlus,
  TrendingUp,
  PieChart,
  FileText,
  UserPlus,
  Wallet,
  Truck,
  Heart,
  ShieldCheck,
  ChevronRight,
  HeartPulse,
} from 'lucide-react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { layout } from '@/constants/theme';
import apiClient from '@/api/client';
import { Badge } from '@/components/ui/Badge';

export default function OperationsScreen() {
  const { user, canAccess } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [refreshing, setRefreshing] = useState(false);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [newInquiriesCount, setNewInquiriesCount] = useState(0);

  const loadOperationalCounts = async () => {
    if (!user) {
      setRefreshing(false);
      return;
    }
    try {
      const [ordersRes, inquiriesRes] = await Promise.allSettled([
        apiClient.get('/api/orders?status=Order Placed&limit=1'),
        apiClient.get('/api/support/inquiries?status=New&limit=1'),
      ]);

      if (ordersRes.status === 'fulfilled') {
        setPendingOrdersCount(ordersRes.value.data?.pagination?.total || 0);
      }
      if (inquiriesRes.status === 'fulfilled') {
        setNewInquiriesCount(inquiriesRes.value.data?.pagination?.total || 0);
      }
    } catch (e) {
      console.warn('Could not load operational counts', e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadOperationalCounts();
    }
  }, [user]);

  if (!user) {
    return (
      <View style={[styles.accessDenied, { backgroundColor: theme.background }]}>
        <View style={[styles.deniedIcon, { backgroundColor: theme.primarySoft }]}>
          <ShieldCheck size={48} color={theme.primary} />
        </View>
        <Text style={[styles.deniedTitle, { color: theme.text }]}>Staff Access Required</Text>
        <Text style={[styles.deniedSubtitle, { color: theme.mutedText }]}>
          Operations command center is only accessible to authenticated pharmacy team members.
        </Text>
        <Pressable
          style={[styles.signInBtn, { backgroundColor: theme.primary }]}
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={styles.signInBtnText}>Sign In to Continue</Text>
        </Pressable>
      </View>
    );
  }

  // Role label shown in the banner
  const roleLabel =
    user.role === 'admin'
      ? 'Administrator'
      : user.role === 'manager'
      ? 'Manager'
      : 'Staff';

  const modules = [
    // ── Staff + Manager + Admin ──────────────────────────────────────────
    {
      id: 'pos',
      title: 'Point of Sale (POS)',
      subtitle: 'Record counter sales, receipts & payments',
      icon: ShoppingCart,
      color: '#10b981',
      bgColor: '#ecfdf5',
      route: '/(tabs)/pos',
      badge: undefined as string | undefined,
      visible: canAccess('pos'),
    },
    {
      id: 'orders',
      title: 'Online Order Management',
      subtitle: 'Review & update online order fulfilment',
      icon: ClipboardList,
      color: '#ff6b35',
      bgColor: '#fff3ee',
      route: '/orders',
      badge: pendingOrdersCount > 0 ? `${pendingOrdersCount} Placed` : undefined,
      visible: canAccess('orders'),
    },
    {
      id: 'support',
      title: 'Pharmacy Support Inquiries',
      subtitle: 'Respond to customer inquiries & support tickets',
      icon: Headset,
      color: '#3b82f6',
      bgColor: '#eff6ff',
      route: '/support-center',
      badge: newInquiriesCount > 0 ? `${newInquiriesCount} New` : undefined,
      visible: canAccess('support-center'),
    },
    {
      id: 'inventory',
      title: 'Stock Control & Batches',
      subtitle: 'Medicine availability, batches & shelf management',
      icon: Boxes,
      color: theme.primary,
      bgColor: theme.primarySoft,
      route: '/(tabs)/inventory',
      badge: undefined as string | undefined,
      visible: canAccess('inventory'),
    },

    // ── Manager + Admin ──────────────────────────────────────────────────
    {
      id: 'dashboard',
      title: 'Dashboard & KPIs',
      subtitle: 'Stock health, alerts & predictive analytics',
      icon: LayoutDashboard,
      color: theme.primary,
      bgColor: theme.primarySoft,
      route: '/dashboard',
      badge: undefined as string | undefined,
      visible: canAccess('dashboard'),
    },
    {
      id: 'add-stock',
      title: 'Restock / Add Stock',
      subtitle: 'Receive batches, update costs & prices',
      icon: PackagePlus,
      color: '#10b981',
      bgColor: '#ecfdf5',
      route: '/add-stock',
      badge: undefined as string | undefined,
      visible: canAccess('add-stock'),
    },
    {
      id: 'customers',
      title: 'Patients Hub',
      subtitle: 'Medical history, allergies & loyalty points',
      icon: Heart,
      color: '#ef4444',
      bgColor: '#fef2f2',
      route: '/customers',
      badge: undefined as string | undefined,
      visible: canAccess('customers'),
    },
    {
      id: 'suppliers',
      title: 'Suppliers Management',
      subtitle: 'Procurement partners, orders & balances',
      icon: Truck,
      color: '#f59e0b',
      bgColor: '#fffbeb',
      route: '/suppliers',
      badge: undefined as string | undefined,
      visible: canAccess('suppliers'),
    },
    {
      id: 'prescriptions',
      title: 'Prescriptions Management',
      subtitle: 'Fill requests, review doctor orders & status',
      icon: FileText,
      color: '#8b5cf6',
      bgColor: '#f5f3ff',
      route: '/prescriptions',
      badge: undefined as string | undefined,
      visible: canAccess('prescriptions'),
    },
    {
      id: 'expenses',
      title: 'Expense Tracking',
      subtitle: 'Payroll, rent, utilities & pharmacy overhead',
      icon: Wallet,
      color: '#8b5cf6',
      bgColor: '#f5f3ff',
      route: '/expenses',
      badge: undefined as string | undefined,
      visible: canAccess('expenses'),
    },

    // ── Admin only ───────────────────────────────────────────────────────
    {
      id: 'profit-loss',
      title: 'Profit & Loss',
      subtitle: 'Monthly revenue, COGS, margins & profit',
      icon: TrendingUp,
      color: '#10b981',
      bgColor: '#ecfdf5',
      route: '/profit-loss',
      badge: undefined as string | undefined,
      visible: canAccess('profit-loss'),
    },
    {
      id: 'reports',
      title: 'Reports & Analytics',
      subtitle: 'Sales ledger, top items & payment trends',
      icon: PieChart,
      color: '#3b82f6',
      bgColor: '#eff6ff',
      route: '/reports',
      badge: undefined as string | undefined,
      visible: canAccess('reports'),
    },
    {
      id: 'team',
      title: 'Team & HR Administration',
      subtitle: 'Manage staff accounts, roles & credentials',
      icon: UserPlus,
      color: theme.navigation,
      bgColor: theme.surfaceMuted,
      route: '/team',
      badge: undefined as string | undefined,
      visible: canAccess('team'),
    },
  ];


  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadOperationalCounts();
          }}
          tintColor={theme.primary}
        />
      }
    >
      {/* Banner */}
      <View style={[styles.banner, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.bannerRow}>
          <View style={[styles.avatarBox, { backgroundColor: theme.primarySoft }]}>
            <HeartPulse size={26} color={theme.primary} />
          </View>
          <View style={styles.bannerCopy}>
            <Text style={[styles.bannerEyebrow, { color: theme.mutedText }]}>
              OPERATIONS MISSION CONTROL
            </Text>
            <Text style={[styles.bannerTitle, { color: theme.navigation }]}>
              Pharmacy Command Center
            </Text>
            <Text style={[styles.bannerStaff, { color: theme.textSecondary }]}>
              Signed in as{' '}
              <Text style={{ fontWeight: '800', color: theme.text }}>{user.username}</Text> —{' '}
              {roleLabel}

            </Text>
          </View>
        </View>
      </View>

      <Text style={[styles.sectionHeading, { color: theme.mutedText }]}>
        OPERATIONAL MODULES
      </Text>

      {/* Modules Grid / Cards */}
      <View style={styles.modulesGrid}>
        {modules
          .filter((m) => m.visible)
          .map((m) => {
            const Icon = m.icon;
            return (
              <Pressable
                key={m.id}
                accessibilityRole="button"
                accessibilityLabel={m.title}
                style={({ pressed }) => [
                  styles.moduleCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    opacity: pressed ? 0.88 : 1,
                  },
                ]}
                onPress={() => router.push(m.route as any)}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.iconBox, { backgroundColor: m.bgColor }]}>
                    <Icon size={22} color={m.color} />
                  </View>
                  {m.badge ? (
                    <Badge label={m.badge} variant="warning" size="sm" />
                  ) : (
                    <ChevronRight size={18} color={theme.mutedText} />
                  )}
                </View>

                <Text style={[styles.moduleTitle, { color: theme.text }]}>{m.title}</Text>
                <Text style={[styles.moduleSubtitle, { color: theme.mutedText }]}>
                  {m.subtitle}
                </Text>
              </Pressable>
            );
          })}
      </View>

      <View style={styles.footerSpacing} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: layout.spacing.lg,
  },
  accessDenied: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: layout.spacing.xl,
  },
  deniedIcon: {
    width: 80,
    height: 80,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: layout.spacing.lg,
  },
  deniedTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  deniedSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    maxWidth: 280,
    marginBottom: layout.spacing.xl,
  },
  signInBtn: {
    paddingHorizontal: layout.spacing.xl,
    paddingVertical: 14,
    borderRadius: layout.radius.md,
  },
  signInBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  banner: {
    borderRadius: layout.radius.xl,
    padding: layout.spacing.lg,
    borderWidth: 1,
    marginBottom: layout.spacing.lg,
    shadowColor: '#0b3156',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  avatarBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerCopy: {
    marginLeft: layout.spacing.md,
    flex: 1,
    backgroundColor: 'transparent',
  },
  bannerEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginTop: 2,
  },
  bannerStaff: {
    fontSize: 12,
    marginTop: 3,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: layout.spacing.md,
    paddingHorizontal: 2,
  },
  modulesGrid: {
    gap: layout.spacing.md,
    backgroundColor: 'transparent',
  },
  moduleCard: {
    borderRadius: layout.radius.lg,
    padding: layout.spacing.lg,
    borderWidth: 1,
    shadowColor: '#0b3156',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: layout.spacing.md,
    backgroundColor: 'transparent',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  moduleSubtitle: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
  },
  footerSpacing: {
    height: 40,
    backgroundColor: 'transparent',
  },
});
