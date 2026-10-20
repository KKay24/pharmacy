import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ViewStyle,
} from 'react-native';
import { Text, View } from '@/components/Themed';
import apiClient from '@/api/client';
import { router } from 'expo-router';
import {
  ArrowLeft,
  LayoutDashboard,
  Boxes,
  AlertTriangle,
  Clock,
  TrendingUp,
  DollarSign,
  Package,
  ShieldAlert,
  ChevronRight,
  ShoppingCart,
  PackagePlus,
  ClipboardList,
  ShieldCheck,
} from 'lucide-react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { layout } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getMedicineBatches, getMedicineTotalQuantity } from '@/utils/inventory';
import { RoleGuard } from '@/components/ui/RoleGuard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [profitLossData, setProfitLossData] = useState<any[]>([]);
  const [reorderInsights, setReorderInsights] = useState<{ items?: any[] }>({});
  const [riskInsights, setRiskInsights] = useState<{
    stockoutRisk?: any[];
    expiryRisk?: any[];
    deadStock?: any[];
  }>({});

  const loadDashboardData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const [invRes, plRes, reorderRes, riskRes] = await Promise.allSettled([
        apiClient.get('/api/inventory?limit=100'),
        apiClient.get('/api/analytics/profit-loss'),
        apiClient.get('/api/analytics/reorder-suggestions'),
        apiClient.get('/api/analytics/risks'),
      ]);

      if (invRes.status === 'fulfilled') {
        const rows = Array.isArray(invRes.value.data)
          ? invRes.value.data
          : invRes.value.data?.data || [];
        setMedicines(rows);
      }
      if (plRes.status === 'fulfilled') {
        const rows = Array.isArray(plRes.value.data)
          ? plRes.value.data
          : plRes.value.data?.data || [];
        setProfitLossData(rows);
      }
      if (reorderRes.status === 'fulfilled') {
        setReorderInsights(reorderRes.value.data || {});
      }
      if (riskRes.status === 'fulfilled') {
        setRiskInsights(riskRes.value.data || {});
      }
    } catch (err) {
      console.warn('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    } else {
      setLoading(false);
    }
  }, [user, loadDashboardData]);

  // Compute stock health metrics
  const kpis = useMemo(() => {
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    let stockValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let expiringCount = 0;

    medicines.forEach((med) => {
      const batches = getMedicineBatches(med.Batches);
      const totalQty = getMedicineTotalQuantity(batches);
      const threshold = med.lowStockThreshold || 10;

      if (totalQty === 0) outOfStockCount++;
      else if (totalQty <= threshold) lowStockCount++;

      batches.forEach((b: any) => {
        const qty = Number(b.quantity || 0);
        const cost = Number(b.costPrice || 0);
        stockValue += qty * cost;

        if (
          b.expiryDate &&
          new Date(b.expiryDate) >= now &&
          new Date(b.expiryDate) <= thirtyDays &&
          qty > 0
        ) {
          expiringCount++;
        }
      });
    });

    const currentMonthRevenue =
      profitLossData.length > 0
        ? profitLossData[profitLossData.length - 1]?.revenue || 0
        : 0;

    return {
      totalMedicines: medicines.length,
      stockValue,
      lowStockCount,
      outOfStockCount,
      expiringCount,
      currentMonthRevenue,
    };
  }, [medicines, profitLossData]);

  const reorderList = reorderInsights.items || [];
  const stockoutRiskList = riskInsights.stockoutRisk || [];

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.topHeader}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
            hitSlop={8}
          >
            <ArrowLeft size={22} color={theme.text} />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { color: theme.navigation }]}>
              Executive Dashboard
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.mutedText }]}>
              Staff operations and metrics
            </Text>
          </View>
        </View>

        <View style={styles.accessDeniedContent}>
          <View style={[styles.deniedIcon, { backgroundColor: theme.surfaceMuted }]}>
            <ShieldCheck size={52} color={theme.primary} />
          </View>
          <Text style={[styles.deniedTitle, { color: theme.text }]}>
            Staff Access Required
          </Text>
          <Text style={[styles.deniedSubtitle, { color: theme.mutedText }]}>
            Executive metrics, inventory valuation, and profit/loss insights are only available to authenticated pharmacy staff members.
          </Text>

          <View style={styles.deniedActions}>
            <Button
              title="Sign In to Dashboard"
              onPress={() => router.push('/(auth)/login')}
              style={{ width: '100%' }}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <RoleGuard page="dashboard">
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 24, 32) }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadDashboardData();
            }}
            tintColor={theme.primary}
          />
        }
      >
        {/* Top Header */}
        <View style={styles.topHeader}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
            hitSlop={8}
          >
            <ArrowLeft size={22} color={theme.text} />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { color: theme.navigation }]}>
              Executive Dashboard
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.mutedText }]}>
              Stock health, urgent restocks & performance
            </Text>
          </View>
        </View>
  
        {/* KPI Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <StatCard
              style={styles.statCard}
              label="Total Stock Value"
              value={`K ${Math.round(kpis.stockValue).toLocaleString()}`}
              icon={<DollarSign size={20} color={theme.primary} />}
              iconBg={theme.primarySoft}
              trend={{ direction: 'up', value: 'Active assets' }}
            />
            <StatCard
              style={styles.statCard}
              label="Monthly Revenue"
              value={`K ${Math.round(kpis.currentMonthRevenue).toLocaleString()}`}
              icon={<TrendingUp size={20} color="#10b981" />}
              iconBg="#ecfdf5"
              trend={{ direction: 'up', value: 'Current month' }}
            />
          </View>
  
          <View style={styles.statsRow}>
            <StatCard
              style={styles.statCard}
              label="Low Stock Alert"
              value={kpis.lowStockCount}
              subValue="Needs reordering"
              icon={<AlertTriangle size={20} color="#f59e0b" />}
              iconBg="#fffbeb"
            />
            <StatCard
              style={styles.statCard}
              label="Expiring (30 days)"
              value={kpis.expiringCount}
              subValue="Monitor batches"
              icon={<Clock size={20} color="#ef4444" />}
              iconBg="#fef2f2"
            />
          </View>
        </View>
  
        {/* Quick Action Shortcuts */}
        <View style={[styles.quickActionsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardHeading, { color: theme.text }]}>Quick Actions</Text>
          <View style={styles.actionsRow}>
            <Pressable
              style={[styles.actionTile, { backgroundColor: theme.primarySoft }]}
              onPress={() => router.push('/(tabs)/pos')}
            >
              <ShoppingCart size={22} color={theme.primary} />
              <Text style={[styles.actionTileText, { color: theme.primary }]}>New Sale</Text>
            </Pressable>
            <Pressable
              style={[styles.actionTile, { backgroundColor: '#ecfdf5' }]}
              onPress={() => router.push('/add-stock' as any)}
            >
              <PackagePlus size={22} color="#10b981" />
              <Text style={[styles.actionTileText, { color: '#059669' }]}>Add Stock</Text>
            </Pressable>
            <Pressable
              style={[styles.actionTile, { backgroundColor: '#fff3ee' }]}
              onPress={() => router.push('/orders' as any)}
            >
              <ClipboardList size={22} color="#ff6b35" />
              <Text style={[styles.actionTileText, { color: '#ff6b35' }]}>Orders</Text>
            </Pressable>
            <Pressable
              style={[styles.actionTile, { backgroundColor: '#eff6ff' }]}
              onPress={() => router.push('/(tabs)/inventory')}
            >
              <Boxes size={22} color="#3b82f6" />
              <Text style={[styles.actionTileText, { color: '#2563eb' }]}>Inventory</Text>
            </Pressable>
          </View>
        </View>
  
        {/* Reorder Insights */}
        <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={[styles.cardHeading, { color: theme.text }]}>Urgent Restock Suggestions</Text>
              <Text style={[styles.cardSubheading, { color: theme.mutedText }]}>
                Items based on velocity & lead time
              </Text>
            </View>
            <Badge label={`${reorderList.length} items`} variant="warning" size="sm" />
          </View>
  
          {reorderList.length > 0 ? (
            reorderList.slice(0, 5).map((item, idx) => (
              <View
                key={idx}
                style={[styles.listItem, { borderBottomColor: theme.borderLight }]}
              >
                <View style={styles.itemCopy}>
                  <Text style={[styles.itemName, { color: theme.text }]}>
                    {item.medicineName || item.name}
                  </Text>
                  <Text style={[styles.itemSub, { color: theme.mutedText }]}>
                    Stock: {item.currentStock || item.totalQuantity || 0} · Reorder point: {item.reorderPoint || 10}
                  </Text>
                </View>
                <Badge
                  label={`+${item.suggestedQuantity || 50} units`}
                  variant="primary"
                  size="sm"
                />
              </View>
            ))
          ) : (
            <Text style={[styles.emptySectionText, { color: theme.mutedText }]}>
              All inventory levels are currently within safe thresholds.
            </Text>
          )}
        </View>
  
        {/* Stockout Risk Warnings */}
        <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={[styles.cardHeading, { color: theme.text }]}>Stockout Risk Alerts</Text>
              <Text style={[styles.cardSubheading, { color: theme.mutedText }]}>
                High-velocity medicines near zero
              </Text>
            </View>
            <Badge
              label={`${stockoutRiskList.length} alerts`}
              variant="danger"
              size="sm"
            />
          </View>
  
          {stockoutRiskList.length > 0 ? (
            stockoutRiskList.slice(0, 5).map((item, idx) => (
              <View
                key={idx}
                style={[styles.listItem, { borderBottomColor: theme.borderLight }]}
              >
                <View style={styles.itemCopy}>
                  <Text style={[styles.itemName, { color: theme.text }]}>
                    {item.medicineName || item.name}
                  </Text>
                  <Text style={[styles.itemSub, { color: theme.mutedText }]}>
                    Days until stockout: ~{item.daysUntilStockout || 2} days
                  </Text>
                </View>
                <Badge label="High Risk" variant="danger" size="sm" />
              </View>
            ))
          ) : (
            <Text style={[styles.emptySectionText, { color: theme.mutedText }]}>
              No high-priority stockout risks identified right now.
            </Text>
          )}
        </View>
  
        <View style={{ height: 40 }} />
      </ScrollView>
    </RoleGuard>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: layout.spacing.lg },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: layout.spacing.lg,
  },
  backButton: {
    padding: 6,
  },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 12, marginTop: 2 },
  statsGrid: { gap: layout.spacing.md, marginBottom: layout.spacing.lg },
  statsRow: { flexDirection: 'row', gap: layout.spacing.md },
  statCard: { flex: 1 },
  quickActionsCard: {
    borderRadius: layout.radius.xl,
    padding: layout.spacing.lg,
    borderWidth: 1,
    marginBottom: layout.spacing.lg,
  },
  cardHeading: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  cardSubheading: { fontSize: 11, marginTop: 2 },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: layout.spacing.md,
  },
  actionTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: layout.radius.md,
    gap: 6,
  },
  actionTileText: { fontSize: 12, fontWeight: '800' },
  sectionCard: {
    borderRadius: layout.radius.xl,
    padding: layout.spacing.lg,
    borderWidth: 1,
    marginBottom: layout.spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: layout.spacing.md,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  itemCopy: { flex: 1, paddingRight: 8 },
  itemName: { fontSize: 14, fontWeight: '700' },
  itemSub: { fontSize: 11, marginTop: 2 },
  emptySectionText: {
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: 10,
  },
  accessDeniedContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 40,
  },
  deniedIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  deniedTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  deniedSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
  },
  deniedActions: {
    width: '100%',
    maxWidth: 320,
  },
});
