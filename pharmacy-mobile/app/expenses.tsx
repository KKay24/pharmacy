import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  Modal,
  ScrollView,
  TextInput,
  RefreshControl,
} from 'react-native';
import { Text, View } from '@/components/Themed';
import apiClient from '@/api/client';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Wallet,
  Plus,
  Trash2,
  Calendar,
  Tag,
  DollarSign,
  TrendingDown,
  X,
} from 'lucide-react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { layout } from '@/constants/theme';
import { SearchInput } from '@/components/ui/SearchInput';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

const EXPENSE_CATEGORIES = [
  'Operating',
  'Payroll',
  'Rent',
  'Utilities',
  'Other',
] as const;

export default function ExpensesScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Add Expense modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [category, setCategory] = useState<string>('Operating');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);

  const loadExpenses = useCallback(async () => {
    try {
      const response = await apiClient.get('/api/expenses');
      const data = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setExpenses(data);
    } catch (err) {
      console.warn('Failed to load expenses', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonthExpenses = expenses.filter((e) => {
      if (!e.date) return false;
      const d = new Date(e.date);
      return (
        d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      );
    });

    const total = currentMonthExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const count = currentMonthExpenses.length;

    // Top Category
    const cats: Record<string, number> = {};
    currentMonthExpenses.forEach((e) => {
      cats[e.category] = (cats[e.category] || 0) + Number(e.amount || 0);
    });
    const topCat =
      Object.entries(cats).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

    return { total, count, topCat };
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    if (!search.trim()) return expenses;
    const q = search.toLowerCase().trim();
    return expenses.filter(
      (e) =>
        e.category?.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q)
    );
  }, [expenses, search]);

  const handleCreateExpense = async () => {
    const numAmount = parseFloat(amount);
    if (Number.isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid expense amount.');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post('/api/expenses', {
        category,
        amount: numAmount,
        description: description.trim() || null,
        date: date || new Date().toISOString().split('T')[0],
      });
      setShowAddModal(false);
      setAmount('');
      setDescription('');
      Alert.alert('Expense Recorded', 'Operational expense has been logged.');
      loadExpenses();
    } catch (err: unknown) {
      const reqErr = err as { response?: { data?: { error?: string } } };
      Alert.alert('Error', reqErr.response?.data?.error || 'Failed to record expense.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = (id: number) => {
    Alert.alert('Delete Expense', 'Are you sure you want to remove this expense record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`/api/expenses/${id}`);
            Alert.alert('Deleted', 'Expense record removed.');
            loadExpenses();
          } catch (err: unknown) {
            const reqErr = err as { response?: { data?: { error?: string } } };
            Alert.alert('Error', reqErr.response?.data?.error || 'Failed to delete expense.');
          }
        },
      },
    ]);
  };

  const getCategoryBadgeVariant = (cat: string) => {
    switch (cat) {
      case 'Payroll':
        return 'primary';
      case 'Rent':
        return 'info';
      case 'Utilities':
        return 'warning';
      case 'Operating':
        return 'accent';
      default:
        return 'neutral';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <View style={styles.topRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
            <ArrowLeft size={22} color={theme.text} />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { color: theme.navigation }]}>
              Expense Tracking
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.mutedText }]}>
              Audit & record operational pharmacy overhead
            </Text>
          </View>
          <Button
            title="Add Expense"
            onPress={() => setShowAddModal(true)}
            variant="primary"
            size="sm"
            leftIcon={<Plus size={16} color="#ffffff" />}
          />
        </View>

        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by category or description..."
          style={{ marginTop: 8 }}
        />
      </View>

      {/* Expense List */}
      <FlatList
        data={filteredExpenses}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadExpenses();
            }}
            tintColor={theme.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.statsRow}>
            <StatCard
              style={styles.statCard}
              label="Month Total"
              value={`K ${Math.round(stats.total).toLocaleString()}`}
              icon={<Wallet size={18} color={theme.primary} />}
              iconBg={theme.primarySoft}
            />
            <StatCard
              style={styles.statCard}
              label="Entries"
              value={stats.count}
              icon={<DollarSign size={18} color="#f59e0b" />}
              iconBg="#fffbeb"
            />
            <StatCard
              style={styles.statCard}
              label="Top Category"
              value={stats.topCat}
              icon={<Tag size={18} color="#8b5cf6" />}
              iconBg="#f5f3ff"
            />
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.cardTopRow}>
              <View style={styles.categoryWrap}>
                <Badge
                  label={item.category || 'Operating'}
                  variant={getCategoryBadgeVariant(item.category)}
                  size="md"
                />
                <Text style={[styles.expenseDate, { color: theme.mutedText }]}>
                  {item.date ? new Date(item.date).toLocaleDateString() : 'Today'}
                </Text>
              </View>
              <Text style={[styles.expenseAmount, { color: theme.navigation }]}>
                K {Number(item.amount || 0).toFixed(2)}
              </Text>
            </View>

            {item.description ? (
              <Text style={[styles.expenseDesc, { color: theme.textSecondary }]}>
                {item.description}
              </Text>
            ) : null}

            <View style={[styles.actionsRow, { borderTopColor: theme.borderLight }]}>
              <Text style={[styles.loggedBy, { color: theme.mutedText }]}>
                Ref #{item.id}
              </Text>
              <Pressable
                accessibilityLabel="Delete expense record"
                hitSlop={8}
                onPress={() => handleDeleteExpense(item.id)}
              >
                <Trash2 size={16} color={theme.danger} />
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon={<Wallet size={32} color={theme.mutedText} />}
              title="No expenses logged"
              description="Tap 'Add Expense' above to log operational or overhead expenditures."
            />
          ) : null
        }
      />

      {/* Add Expense Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.navigation }]}>
                Record Operational Expense
              </Text>
              <Pressable hitSlop={8} onPress={() => setShowAddModal(false)}>
                <X size={20} color={theme.mutedText} />
              </Pressable>
            </View>

            <ScrollView style={{ marginTop: 12 }}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Category</Text>
              <View style={styles.catChipsGrid}>
                {EXPENSE_CATEGORIES.map((cat) => {
                  const active = category === cat;
                  return (
                    <Pressable
                      key={cat}
                      style={[
                        styles.catChip,
                        {
                          backgroundColor: active ? theme.primary : theme.surfaceMuted,
                          borderColor: active ? theme.primary : theme.border,
                        },
                      ]}
                      onPress={() => setCategory(cat)}
                    >
                      <Text
                        style={[
                          styles.catChipText,
                          { color: active ? '#ffffff' : theme.textSecondary },
                        ]}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Amount (ZMW / K) *</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="e.g. 450.00"
                keyboardType="decimal-pad"
                placeholderTextColor={theme.mutedText}
                style={[styles.input, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }]}
              />

              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Description</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="e.g. Generator fuel, packaging bags, cleaning"
                placeholderTextColor={theme.mutedText}
                style={[styles.input, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }]}
              />

              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Date (YYYY-MM-DD)</Text>
              <TextInput
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.mutedText}
                style={[styles.input, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }]}
              />

              <View style={{ marginTop: 16 }}>
                <Button
                  title={submitting ? 'Recording...' : 'Record Expense'}
                  onPress={handleCreateExpense}
                  loading={submitting}
                  variant="primary"
                  fullWidth
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: layout.spacing.lg,
    paddingTop: layout.spacing.md,
    paddingBottom: layout.spacing.sm,
    borderBottomWidth: 1,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { padding: 4 },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  headerSubtitle: { fontSize: 11, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: layout.spacing.md },
  statCard: { flex: 1, padding: 10 },
  listContent: { padding: layout.spacing.lg, paddingBottom: 60 },
  card: {
    borderRadius: layout.radius.lg,
    padding: layout.spacing.lg,
    borderWidth: 1,
    marginBottom: layout.spacing.md,
    shadowColor: '#0b3156',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  expenseDate: { fontSize: 11 },
  expenseAmount: { fontSize: 16, fontWeight: '900' },
  expenseDesc: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    marginTop: 8,
  },
  loggedBy: { fontSize: 11 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 49, 86, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: layout.radius.xxl,
    borderTopRightRadius: layout.radius.xxl,
    padding: layout.spacing.xl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  fieldLabel: { fontSize: 11, fontWeight: '700', marginTop: 10, marginBottom: 4 },
  input: {
    height: 46,
    borderRadius: layout.radius.sm,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  catChipsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: layout.radius.full,
    borderWidth: 1,
  },
  catChipText: { fontSize: 12, fontWeight: '700' },
});
