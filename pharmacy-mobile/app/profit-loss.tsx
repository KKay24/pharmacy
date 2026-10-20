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
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Wallet,
  Activity,
  Layers,
} from 'lucide-react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { layout } from '@/constants/theme';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { RoleGuard } from '@/components/ui/RoleGuard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfitLossScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const response = await apiClient.get('/api/analytics/profit-loss');
      const rows = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setData(rows);
    } catch (err) {
      console.warn('Failed to load profit loss data', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Current Month Data
  const currentMonth = useMemo(() => {
    if (data.length === 0) {
      return { revenue: 0, cogs: 0, grossProfit: 0, operatingExpenses: 0, netProfit: 0, month: 'N/A' };
    }
    return data[data.length - 1];
  }, [data]);

  const calcChange = (key: string) => {
    if (data.length < 2) return null;
    const curr = Number(data[data.length - 1][key] || 0);
    const prev = Number(data[data.length - 2][key] || 0);
    if (prev === 0) return null;
    const diff = ((curr - prev) / prev) * 100;
    return {
      direction: (diff >= 0 ? 'up' : 'down') as 'up' | 'down',
      value: `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`,
    };
  };

  const revenueTrend = calcChange('revenue');
  const netProfitTrend = calcChange('netProfit');

  return (
    <RoleGuard page="profit-loss">
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 24, 32) }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
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
              Profit & Loss Summary
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.mutedText }]}>
              Compare revenue, cost of goods & profit performance
            </Text>
          </View>
        </View>
  
        {/* KPI Cards */}
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <StatCard
              style={styles.statCard}
              label="Gross Revenue"
              value={`K ${Number(currentMonth.revenue || 0).toLocaleString()}`}
              icon={<DollarSign size={20} color={theme.primary} />}
              iconBg={theme.primarySoft}
              trend={revenueTrend || undefined}
            />
            <StatCard
              style={styles.statCard}
              label="Cost of Goods (COGS)"
              value={`K ${Number(currentMonth.cogs || 0).toLocaleString()}`}
              icon={<Wallet size={20} color="#f59e0b" />}
              iconBg="#fffbeb"
            />
          </View>
  
          <View style={styles.statsRow}>
            <StatCard
              style={styles.statCard}
              label="Gross Margin Profit"
              value={`K ${Number(currentMonth.grossProfit || 0).toLocaleString()}`}
              subValue={`Margin: ${
                currentMonth.revenue
                  ? Math.round((currentMonth.grossProfit / currentMonth.revenue) * 100)
                  : 0
              }%`}
              icon={<TrendingUp size={20} color="#10b981" />}
              iconBg="#ecfdf5"
            />
            <StatCard
              style={styles.statCard}
              label="Net Operating Profit"
              value={`K ${Number(currentMonth.netProfit || 0).toLocaleString()}`}
              icon={<Activity size={20} color={currentMonth.netProfit >= 0 ? '#10b981' : '#ef4444'} />}
              iconBg={currentMonth.netProfit >= 0 ? '#ecfdf5' : '#fef2f2'}
              trend={netProfitTrend || undefined}
            />
          </View>
        </View>
  
        {/* Monthly Financial Breakdown */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.navigation }]}>
            Monthly Breakdown History
          </Text>
          <Text style={[styles.cardSubtitle, { color: theme.mutedText }]}>
            Financial records sorted by reporting month
          </Text>
  
          {data.length > 0 ? (
            data
              .slice()
              .reverse()
              .map((row, idx) => (
                <View
                  key={idx}
                  style={[styles.historyRow, { borderBottomColor: theme.borderLight }]}
                >
                  <View style={styles.historyLeft}>
                    <Text style={[styles.historyMonth, { color: theme.text }]}>
                      {row.month}
                    </Text>
                    <Text style={[styles.historySub, { color: theme.mutedText }]}>
                      Rev: K {Number(row.revenue || 0).toLocaleString()} · COGS: K{' '}
                      {Number(row.cogs || 0).toLocaleString()}
                    </Text>
                  </View>
  
                  <View style={styles.historyRight}>
                    <Text
                      style={[
                        styles.historyProfit,
                        { color: row.netProfit >= 0 ? theme.primary : theme.danger },
                      ]}
                    >
                      K {Number(row.netProfit || 0).toLocaleString()}
                    </Text>
                    <Badge
                      label={row.netProfit >= 0 ? 'Profitable' : 'Deficit'}
                      variant={row.netProfit >= 0 ? 'success' : 'danger'}
                      size="sm"
                    />
                  </View>
                </View>
              ))
          ) : (
            <EmptyState
              icon={<TrendingUp size={32} color={theme.mutedText} />}
              title="No financial records"
              description="Monthly sales and recorded expenses will populate financial reports here."
            />
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
    gap: 10,
    marginBottom: layout.spacing.lg,
  },
  backBtn: { padding: 4 },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  headerSubtitle: { fontSize: 11, marginTop: 2 },
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
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  historyLeft: { flex: 1 },
  historyMonth: { fontSize: 14, fontWeight: '800' },
  historySub: { fontSize: 11, marginTop: 3 },
  historyRight: { alignItems: 'flex-end', gap: 4 },
  historyProfit: { fontSize: 14, fontWeight: '800' },
});
