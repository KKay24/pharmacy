import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  Modal,
  ScrollView,
  TextInput,
  RefreshControl,
  ViewStyle,
} from 'react-native';
import { Text, View } from '@/components/Themed';
import { useAuth } from '@/context/AuthContext';
import apiClient from '@/api/client';
import { router } from 'expo-router';
import {
  Boxes,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  Clock,
  Trash2,
  Edit2,
  Package,
  Layers,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle2,
  ShieldAlert,
  Calendar,
} from 'lucide-react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { layout } from '@/constants/theme';
import { SearchInput } from '@/components/ui/SearchInput';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { getMedicineBatches, getMedicineCurrentPrice, getMedicineTotalQuantity } from '@/utils/inventory';
import { RoleGuard } from '@/components/ui/RoleGuard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Batch {
  id?: number;
  batchNumber?: string;
  quantity?: number;
  costPrice?: number;
  sellingPrice?: number;
  expiryDate?: string;
  receivedDate?: string;
}

interface MedicineItem {
  id: number;
  name: string;
  genericName?: string;
  brandName?: string;
  strength?: string;
  dosage?: string;
  totalQuantity: number;
  price: number;
  lowStockThreshold?: number;
  mainCategoryId?: number;
  subcategoryId?: number;
  productFormId?: number;
  isCustomerVisible?: boolean;
  Batches?: Batch[];
  MainCategory?: { id: number; name: string };
  Subcategory?: { id: number; name: string };
  ProductForm?: { id: number; name: string };
}

export default function InventoryScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [medicines, setMedicines] = useState<MedicineItem[]>([]);
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'in' | 'low' | 'out'>('all');
  const [expiryStatusFilter, setExpiryStatusFilter] = useState<'all' | 'valid' | 'expiring' | 'expired'>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Edit medicine modal
  const [editingItem, setEditingItem] = useState<MedicineItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editGeneric, setEditGeneric] = useState('');
  const [editStrength, setEditStrength] = useState('');
  const [editThreshold, setEditThreshold] = useState('10');
  const [savingEdit, setSavingEdit] = useState(false);

  const loadInventory = useCallback(async () => {
    try {
      const [invRes, catRes] = await Promise.allSettled([
        apiClient.get('/api/inventory?limit=100'),
        apiClient.get('/api/inventory/categories'),
      ]);

      if (invRes.status === 'fulfilled') {
        const rows = Array.isArray(invRes.value.data)
          ? invRes.value.data
          : invRes.value.data?.data || [];
        const formatted = rows.map((med: any) => {
          const batches = getMedicineBatches(med.Batches) as Batch[];
          return {
            ...med,
            Batches: batches,
            totalQuantity: getMedicineTotalQuantity(batches),
            price: getMedicineCurrentPrice(batches),
          };
        });
        setMedicines(formatted);
      }

      if (catRes.status === 'fulfilled') {
        setCategories(Array.isArray(catRes.value.data) ? catRes.value.data : []);
      }
    } catch (err) {
      console.error('Failed to load inventory', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  // Statistics
  const stats = useMemo(() => {
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    let lowStock = 0;
    let outOfStock = 0;
    let expiringSoon = 0;
    let expired = 0;

    medicines.forEach((med) => {
      const threshold = med.lowStockThreshold || 10;
      if (med.totalQuantity <= 0) outOfStock++;
      else if (med.totalQuantity <= threshold) lowStock++;

      const batches = med.Batches || [];
      if (
        batches.some(
          (b) => b.expiryDate && new Date(b.expiryDate) < now && (b.quantity || 0) > 0
        )
      ) {
        expired++;
      } else if (
        batches.some(
          (b) =>
            b.expiryDate &&
            new Date(b.expiryDate) >= now &&
            new Date(b.expiryDate) <= thirtyDays &&
            (b.quantity || 0) > 0
        )
      ) {
        expiringSoon++;
      }
    });

    return {
      total: medicines.length,
      lowStock,
      outOfStock,
      expiringSoon,
      expired,
    };
  }, [medicines]);

  // Filtering
  const filtered = useMemo(() => {
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return medicines.filter((med) => {
      if (selectedCategoryId && med.mainCategoryId !== selectedCategoryId) return false;

      // Stock status
      const threshold = med.lowStockThreshold || 10;
      if (stockStatusFilter === 'out' && med.totalQuantity > 0) return false;
      if (stockStatusFilter === 'low' && (med.totalQuantity <= 0 || med.totalQuantity > threshold))
        return false;
      if (stockStatusFilter === 'in' && med.totalQuantity <= threshold) return false;

      // Expiry status
      const batches = med.Batches || [];
      if (expiryStatusFilter === 'expired') {
        const hasExpired = batches.some(
          (b) => b.expiryDate && new Date(b.expiryDate) < now && (b.quantity || 0) > 0
        );
        if (!hasExpired) return false;
      } else if (expiryStatusFilter === 'expiring') {
        const hasExpiring = batches.some(
          (b) =>
            b.expiryDate &&
            new Date(b.expiryDate) >= now &&
            new Date(b.expiryDate) <= thirtyDays &&
            (b.quantity || 0) > 0
        );
        if (!hasExpiring) return false;
      }

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matches =
          med.name.toLowerCase().includes(q) ||
          med.genericName?.toLowerCase().includes(q) ||
          med.brandName?.toLowerCase().includes(q) ||
          med.strength?.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [medicines, selectedCategoryId, stockStatusFilter, expiryStatusFilter, search]);

  const handleDelete = (med: MedicineItem) => {
    Alert.alert(
      'Delete Medicine',
      `Are you sure you want to delete ${med.name}? This will remove all batch records.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(`/api/inventory/${med.id}`);
              Alert.alert('Deleted', `${med.name} removed from inventory.`);
              loadInventory();
            } catch (err: unknown) {
              const reqErr = err as { response?: { data?: { error?: string } } };
              Alert.alert('Error', reqErr.response?.data?.error || 'Failed to delete medicine.');
            }
          },
        },
      ]
    );
  };

  const openEditModal = (med: MedicineItem) => {
    setEditingItem(med);
    setEditName(med.name);
    setEditGeneric(med.genericName || '');
    setEditStrength(med.strength || '');
    setEditThreshold(String(med.lowStockThreshold || 10));
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    if (!editName.trim()) {
      Alert.alert('Validation Error', 'Medicine name cannot be empty.');
      return;
    }

    setSavingEdit(true);
    try {
      await apiClient.put(`/api/inventory/${editingItem.id}`, {
        name: editName.trim(),
        genericName: editGeneric.trim() || null,
        strength: editStrength.trim() || null,
        lowStockThreshold: parseInt(editThreshold, 10) || 10,
      });
      setEditingItem(null);
      Alert.alert('Updated', 'Medicine details saved.');
      loadInventory();
    } catch (err: unknown) {
      const reqErr = err as { response?: { data?: { error?: string } } };
      Alert.alert('Error', reqErr.response?.data?.error || 'Failed to update medicine.');
    } finally {
      setSavingEdit(false);
    }
  };

  if (!user) {
    return (
      <View style={[styles.accessDenied, { backgroundColor: theme.background }]}>
        <Boxes size={48} color={theme.primary} />
        <Text style={[styles.deniedTitle, { color: theme.text }]}>Staff Access Required</Text>
        <Text style={[styles.deniedSubtitle, { color: theme.mutedText }]}>
          Inventory control is available to authorized pharmacy personnel.
        </Text>
      </View>
    );
  }

  return (
    <RoleGuard page="inventory">
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Top Header & Search */}
        <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <View style={styles.topRow}>
            <View>
              <Text style={[styles.headerTitle, { color: theme.navigation }]}>
                Inventory Control
              </Text>
              <Text style={[styles.headerSubtitle, { color: theme.mutedText }]}>
                {stats.total} medicines · {stats.lowStock} low stock · {stats.outOfStock} out
              </Text>
            </View>
            <Button
              title="Add Stock"
              onPress={() => router.push('/add-stock' as any)}
              variant="primary"
              size="sm"
              leftIcon={<Plus size={16} color="#ffffff" />}
            />
          </View>
  
          <SearchInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by brand, generic, strength..."
            style={{ marginTop: 8 }}
          />
  
          {/* Categories Bar */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            <Pressable
              style={[
                styles.filterChip,
                {
                  backgroundColor: selectedCategoryId === null ? theme.primary : theme.surfaceMuted,
                  borderColor: selectedCategoryId === null ? theme.primary : theme.border,
                },
              ]}
              onPress={() => setSelectedCategoryId(null)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: selectedCategoryId === null ? '#ffffff' : theme.textSecondary },
                ]}
              >
                All Categories
              </Text>
            </Pressable>
            {categories.map((c) => {
              const active = selectedCategoryId === c.id;
              return (
                <Pressable
                  key={c.id}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: active ? theme.primary : theme.surfaceMuted,
                      borderColor: active ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => setSelectedCategoryId(active ? null : c.id)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: active ? '#ffffff' : theme.textSecondary },
                    ]}
                  >
                    {c.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
  
          {/* Stock Status Pills */}
          <View style={styles.statusFilters}>
            {(['all', 'in', 'low', 'out'] as const).map((s) => {
              const active = stockStatusFilter === s;
              const labels = { all: 'All', in: 'In Stock', low: `Low (${stats.lowStock})`, out: `Out (${stats.outOfStock})` };
              return (
                <Pressable
                  key={s}
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor: active ? theme.navigation : theme.surfaceMuted,
                      borderColor: active ? theme.navigation : theme.borderLight,
                    },
                  ]}
                  onPress={() => setStockStatusFilter(s)}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      { color: active ? '#ffffff' : theme.mutedText },
                    ]}
                  >
                    {labels[s]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
  
        {/* Medicines List */}
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(insets.bottom + 24, 32) }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadInventory();
              }}
              tintColor={theme.primary}
            />
          }
          renderItem={({ item }) => {
            const isExpanded = expandedId === item.id;
            const batches = item.Batches || [];
            const outOfStock = item.totalQuantity <= 0;
            const lowStock = !outOfStock && item.totalQuantity <= (item.lowStockThreshold || 10);
  
            return (
              <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Pressable
                  style={styles.cardHeader}
                  onPress={() => setExpandedId(isExpanded ? null : item.id)}
                >
                  <View style={styles.cardTitleBlock}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.medName, { color: theme.text }]}>{item.name}</Text>
                      {item.isCustomerVisible !== false ? (
                        <Badge label="Store" variant="info" size="sm" />
                      ) : null}
                    </View>
                    <Text style={[styles.medGeneric, { color: theme.mutedText }]}>
                      {[item.genericName, item.strength || item.dosage].filter(Boolean).join(' · ') ||
                        'Pharmacy Item'}
                    </Text>
                  </View>
  
                  <View style={styles.cardRightCol}>
                    <Text style={[styles.priceTag, { color: theme.navigation }]}>
                      K {item.price.toFixed(2)}
                    </Text>
                    <View style={styles.stockStatusBadge}>
                      {outOfStock ? (
                        <Badge label="Out of Stock" variant="danger" size="sm" />
                      ) : lowStock ? (
                        <Badge label={`Low: ${item.totalQuantity}`} variant="warning" size="sm" />
                      ) : (
                        <Badge label={`In Stock: ${item.totalQuantity}`} variant="success" size="sm" />
                      )}
                    </View>
                  </View>
                </Pressable>
  
                {/* Expansion Details */}
                {isExpanded ? (
                  <View style={[styles.expandedArea, { borderTopColor: theme.borderLight }]}>
                    <View style={styles.batchSectionHeader}>
                      <Text style={[styles.batchSectionTitle, { color: theme.textSecondary }]}>
                        Batches & Shelf Details ({batches.length})
                      </Text>
                      <View style={styles.itemActionButtons}>
                        <Pressable
                          style={[styles.smallActionBtn, { backgroundColor: theme.surfaceMuted }]}
                          onPress={() => openEditModal(item)}
                        >
                          <Edit2 size={14} color={theme.text} />
                          <Text style={[styles.smallActionText, { color: theme.text }]}>Edit</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.smallActionBtn, { backgroundColor: theme.dangerSoft }]}
                          onPress={() => handleDelete(item)}
                        >
                          <Trash2 size={14} color={theme.danger} />
                          <Text style={[styles.smallActionText, { color: theme.danger }]}>Delete</Text>
                        </Pressable>
                      </View>
                    </View>
  
                    {batches.length > 0 ? (
                      batches.map((b, idx) => (
                        <View
                          key={idx}
                          style={[styles.batchRow, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderLight }]}
                        >
                          <View style={styles.batchLeft}>
                            <Text style={[styles.batchNumber, { color: theme.text }]}>
                              Batch #{b.batchNumber || 'N/A'}
                            </Text>
                            <View style={styles.batchDates}>
                              <Clock size={12} color={theme.mutedText} />
                              <Text style={[styles.batchExpText, { color: theme.mutedText }]}>
                                Exp: {b.expiryDate ? new Date(b.expiryDate).toLocaleDateString() : 'N/A'}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.batchRight}>
                            <Text style={[styles.batchQty, { color: theme.navigation }]}>
                              {b.quantity} units
                            </Text>
                            {b.sellingPrice ? (
                              <Text style={[styles.batchPrice, { color: theme.mutedText }]}>
                                K {Number(b.sellingPrice).toFixed(2)}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      ))
                    ) : (
                      <Text style={[styles.noBatchesText, { color: theme.mutedText }]}>
                        No active stock batches recorded for this medicine.
                      </Text>
                    )}
                  </View>
                ) : null}
              </View>
            );
          }}
          ListEmptyComponent={
            !loading ? (
              <EmptyState
                icon={<Boxes size={32} color={theme.mutedText} />}
                title="No medicines match filters"
                description="Clear filters or tap 'Add Stock' to record new batches."
              />
            ) : null
          }
        />
  
        {/* Edit Modal */}
        <Modal visible={!!editingItem} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: theme.surface }]}>
              <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                <Text style={[styles.modalSheetTitle, { color: theme.text }]}>
                  Edit Medicine Details
                </Text>
                <Pressable hitSlop={8} onPress={() => setEditingItem(null)}>
                  <X size={20} color={theme.mutedText} />
                </Pressable>
              </View>
  
              <ScrollView style={{ marginTop: 12 }}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Medicine Name</Text>
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  style={[styles.input, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }]}
                />
  
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Generic Name</Text>
                <TextInput
                  value={editGeneric}
                  onChangeText={setEditGeneric}
                  style={[styles.input, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }]}
                />
  
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Strength / Dosage</Text>
                <TextInput
                  value={editStrength}
                  onChangeText={setEditStrength}
                  style={[styles.input, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }]}
                />
  
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Low Stock Alert Threshold</Text>
                <TextInput
                  value={editThreshold}
                  onChangeText={setEditThreshold}
                  keyboardType="numeric"
                  style={[styles.input, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }]}
                />
  
                <View style={{ marginTop: 16 }}>
                  <Button
                    title={savingEdit ? 'Saving...' : 'Save Changes'}
                    onPress={handleSaveEdit}
                    loading={savingEdit}
                    variant="primary"
                    fullWidth
                  />
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </RoleGuard>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  accessDenied: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: layout.spacing.xl,
  },
  deniedTitle: { fontSize: 20, fontWeight: '800', marginTop: 14 },
  deniedSubtitle: { textAlign: 'center', marginTop: 8, maxWidth: 280 },
  header: {
    paddingHorizontal: layout.spacing.lg,
    paddingTop: layout.spacing.md,
    paddingBottom: layout.spacing.sm,
    borderBottomWidth: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  headerTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  headerSubtitle: { fontSize: 11, marginTop: 2 },
  filterRow: { gap: 8, paddingVertical: 10 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: layout.radius.full,
    borderWidth: 1,
  },
  filterChipText: { fontSize: 11, fontWeight: '700' },
  statusFilters: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 6,
    backgroundColor: 'transparent',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: layout.radius.sm,
    borderWidth: 1,
  },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  listContent: {
    padding: layout.spacing.lg,
    paddingBottom: 110,
  },
  card: {
    borderRadius: layout.radius.md,
    borderWidth: 1,
    marginBottom: layout.spacing.md,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: layout.spacing.md,
  },
  cardTitleBlock: { flex: 1, paddingRight: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  medName: { fontSize: 15, fontWeight: '800' },
  medGeneric: { fontSize: 12, marginTop: 2 },
  cardRightCol: { alignItems: 'flex-end' },
  priceTag: { fontSize: 15, fontWeight: '800' },
  stockStatusBadge: { marginTop: 4 },
  expandedArea: {
    borderTopWidth: 1,
    padding: layout.spacing.md,
  },
  batchSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  batchSectionTitle: { fontSize: 12, fontWeight: '700' },
  itemActionButtons: { flexDirection: 'row', gap: 8 },
  smallActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  smallActionText: { fontSize: 11, fontWeight: '700' },
  batchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginVertical: 4,
  },
  batchLeft: { backgroundColor: 'transparent' },
  batchNumber: { fontSize: 12, fontWeight: '700' },
  batchDates: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  batchExpText: { fontSize: 10 },
  batchRight: { alignItems: 'flex-end', backgroundColor: 'transparent' },
  batchQty: { fontSize: 12, fontWeight: '800' },
  batchPrice: { fontSize: 10, marginTop: 1 },
  noBatchesText: { fontSize: 12, fontStyle: 'italic', paddingVertical: 6 },
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
  modalSheetTitle: { fontSize: 18, fontWeight: '800' },
  fieldLabel: { fontSize: 12, fontWeight: '700', marginTop: 10, marginBottom: 4 },
  input: {
    height: 46,
    borderRadius: layout.radius.sm,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
});
