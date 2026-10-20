import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  FlatList,
} from 'react-native';
import { Text, View } from '@/components/Themed';
import apiClient from '@/api/client';
import { router } from 'expo-router';
import {
  ArrowLeft,
  PieChart,
  DollarSign,
  TrendingUp,
  Receipt,
  Calendar,
  CreditCard,
  Banknote,
  Smartphone,
  Package,
} from 'lucide-react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { layout } from '@/constants/theme';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { RoleGuard } from '@/components/ui/RoleGuard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | '7d' | '30d' | 'all'>('30d');

  const loadSales = useCallback(async () => {
    try {
      const response = await apiClient.get('/api/sales?limit=100');
      const data = response.data?.data || (Array.isArray(response.data) ? response.data : []);
      setSales(data);
    } catch (err) {
      console.warn('Failed to load sales data', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  // Filter sales by selected period
  const filteredSales = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return sales.filter((s) => {
      if (!s.date && !s.createdAt) return true;
      const d = new Date(s.date || s.createdAt);
      if (selectedPeriod === 'today') {
        return d.toISOString().split('T')[0] === todayStr;
      }
      if (selectedPeriod === '7d') {
        return d >= sevenDaysAgo;
      }
      if (selectedPeriod === '30d') {
        return d >= thirtyDaysAgo;
      }
      return true;
    });
  }, [sales, selectedPeriod]);

  // Aggregate statistics
  const summary = useMemo(() => {
    const totalRevenue = filteredSales.reduce((acc, s) => acc + Number(s.totalPrice || 0), 0);
    const totalTransactions = filteredSales.length;
    const avgSale = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    // Payment distribution
    const payments: Record<string, { count: number; total: number }> = {};
    filteredSales.forEach((s) => {
      const method = s.paymentMethod || 'Cash';
      if (!payments[method]) payments[method] = { count: 0, total: 0 };
      payments[method].count += 1;
      payments[method].total += Number(s.totalPrice || 0);
    });

    // Top selling items
    const products: Record<string, { name: string; quantity: number; revenue: number }> = {};
    filteredSales.forEach((s) => {
      const name = s.name || s.Medicine?.name || 'Item';
      if (!products[name]) products[name] = { name, quantity: 0, revenue: 0 };
      products[name].quantity += Number(s.quantity || 1);
      products[name].revenue += Number(s.totalPrice || 0);
    });

    const topItems = Object.values(products)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return { totalRevenue, totalTransactions, avgSale, payments, topItems };
  }, [filteredSales]);

  return (
    <RoleGuard page="reports">
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 24, 32) }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadSales();
            }}
            tintColor={theme.primary}
          />
        }
      >
        {/* Top Header */}
        <View style={styles.topHeader}>
          <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
            <ArrowLeft size={22} color={theme.text} />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { color: theme.navigation }]}>
              Reports & Analytics
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.mutedText }]}>
              Sales ledger, payment distribution & top performers
            </Text>
          </View>
        </View>
  
        {/* Time Range Pills */}
        <View style={styles.periodRow}>
          {(['today', '7d', '30d', 'all'] as const).map((period) => {
            const active = selectedPeriod === period;
            const labels = { today: 'Today', '7d': 'Last 7 Days', '30d': 'Last 30 Days', all: 'All Time' };
            return (
              <Pressable
                key={period}
                style={[
                  styles.periodPill,
                  {
                    backgroundColor: active ? theme.navigation : theme.surface,
                    borderColor: active ? theme.navigation : theme.border,
                  },
                ]}
                onPress={() => setSelectedPeriod(period)}
              >
                <Text
                  style={[
                    styles.periodPillText,
                    { color: active ? '#ffffff' : theme.textSecondary },
                  ]}
                >
                  {labels[period]}
                </Text>
              </Pressable>
            );
          })}
        </View>
  
        {/* KPI Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <StatCard
              style={styles.statCard}
              label="Recorded Sales"
              value={`K ${Math.round(summary.totalRevenue).toLocaleString()}`}
              icon={<DollarSign size={20} color={theme.primary} />}
              iconBg={theme.primarySoft}
            />
            <StatCard
              style={styles.statCard}
              label="Total Transactions"
              value={summary.totalTransactions}
              subValue={`Avg: K ${summary.avgSale.toFixed(1)}`}
              icon={<Receipt size={20} color="#10b981" />}
              iconBg="#ecfdf5"
            />
          </View>
        </View>
  
        {/* Payment Methods Breakdown */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.navigation }]}>
            Payment Method Distribution
          </Text>
          <Text style={[styles.cardSubtitle, { color: theme.mutedText }]}>
            Revenue split by tender type
          </Text>
  
          <View style={styles.paymentList}>
            {Object.entries(summary.payments).map(([method, val]) => (
              <View
                key={method}
                style={[styles.paymentRow, { borderBottomColor: theme.borderLight }]}
              >
                <View style={styles.paymentLeft}>
                  {method.toLowerCase().includes('card') ? (
                    <CreditCard size={18} color={theme.primary} />
                  ) : method.toLowerCase().includes('money') ? (
                    <Smartphone size={18} color="#10b981" />
                  ) : (
                    <Banknote size={18} color="#f59e0b" />
                  )}
                  <Text style={[styles.paymentMethodName, { color: theme.text }]}>{method}</Text>
                </View>
                <View style={styles.paymentRight}>
                  <Text style={[styles.paymentTotal, { color: theme.navigation }]}>
                    K {val.total.toFixed(2)}
                  </Text>
                  <Text style={[styles.paymentCount, { color: theme.mutedText }]}>
                    {val.count} transaction{val.count === 1 ? '' : 's'}
                  </Text>
                </View>
              </View>
            ))}
            {Object.keys(summary.payments).length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.mutedText }]}>
                No sales records in this timeframe.
              </Text>
            ) : null}
          </View>
        </View>
  
        {/* Top Selling Products */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, marginTop: 14 }]}>
          <Text style={[styles.cardTitle, { color: theme.navigation }]}>
            Top Selling Medicines
          </Text>
          <Text style={[styles.cardSubtitle, { color: theme.mutedText }]}>
            Ranked by revenue contribution
          </Text>
  
          {summary.topItems.map((item, idx) => (
            <View
              key={idx}
              style={[styles.itemRow, { borderBottomColor: theme.borderLight }]}
            >
              <View style={[styles.rankBadge, { backgroundColor: theme.primarySoft }]}>
                <Text style={[styles.rankText, { color: theme.primary }]}>#{idx + 1}</Text>
              </View>
              <View style={styles.itemCopy}>
                <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.itemUnits, { color: theme.mutedText }]}>
                  {item.quantity} units sold
                </Text>
              </View>
              <Text style={[styles.itemRevenue, { color: theme.navigation }]}>
                K {item.revenue.toFixed(2)}
              </Text>
            </View>
          ))}
  
          {summary.topItems.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.mutedText }]}>
              No product sales recorded in this timeframe.
            </Text>
          ) : null}
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
    gap: 10,
    marginBottom: layout.spacing.md,
  },
  backBtn: { padding: 4 },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  headerSubtitle: { fontSize: 11, marginTop: 2 },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: layout.spacing.lg,
  },
  periodPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: layout.radius.sm,
    borderWidth: 1,
  },
  periodPillText: { fontSize: 12, fontWeight: '700' },
  statsGrid: { gap: layout.spacing.md, marginBottom: layout.spacing.lg },
  statsRow: { flexDirection: 'row', gap: layout.spacing.md },
  statCard: { flex: 1 },
  card: {
    borderRadius: layout.radius.xl,
    padding: layout.spacing.lg,
    borderWidth: 1,
  },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  cardSubtitle: { fontSize: 12, marginTop: 2, marginBottom: layout.spacing.md },
  paymentList: { gap: 6 },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  paymentLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  paymentMethodName: { fontSize: 14, fontWeight: '700' },
  paymentRight: { alignItems: 'flex-end' },
  paymentTotal: { fontSize: 14, fontWeight: '800' },
  paymentCount: { fontSize: 11, marginTop: 2 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  rankText: { fontSize: 11, fontWeight: '800' },
  itemCopy: { flex: 1, paddingRight: 8 },
  itemName: { fontSize: 13, fontWeight: '700' },
  itemUnits: { fontSize: 11, marginTop: 2 },
  itemRevenue: { fontSize: 14, fontWeight: '800' },
  emptyText: { fontStyle: 'italic', fontSize: 12, paddingVertical: 8 },
});
