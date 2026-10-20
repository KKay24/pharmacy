import React, { useEffect, useState, useMemo } from 'react';
import {
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  TextInput,
  ViewStyle,
} from 'react-native';
import { Text, View } from '@/components/Themed';
import apiClient from '@/api/client';
import { router } from 'expo-router';
import {
  ArrowLeft,
  PackagePlus,
  Plus,
  Trash2,
  Truck,
  Building,
  FileText,
  Calendar,
  CheckCircle2,
  DollarSign,
} from 'lucide-react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { layout } from '@/constants/theme';
import { Button } from '@/components/ui/Button';
import { RoleGuard } from '@/components/ui/RoleGuard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Supplier {
  id: number;
  name: string;
}

interface MedicineOption {
  id: number;
  name: string;
  genericName?: string;
  strength?: string;
}

interface RestockItem {
  id: string;
  name: string;
  genericName: string;
  strength: string;
  batchNumber: string;
  costPrice: string;
  sellingPrice: string;
  quantity: string;
  expiryDate: string;
}

export default function AddStockScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [warehouse, setWarehouse] = useState('Main Pharmacy');
  const [invoiceNumber, setInvoiceNumber] = useState(
    () => `INV-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
  );
  const [receivedDate, setReceivedDate] = useState(
    () => new Date().toISOString().split('T')[0]
  );

  // Staged Restock Line Items
  const [items, setItems] = useState<RestockItem[]>([
    {
      id: 'item_1',
      name: '',
      genericName: '',
      strength: '',
      batchNumber: '',
      costPrice: '',
      sellingPrice: '',
      quantity: '',
      expiryDate: '',
    },
  ]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiClient
      .get('/api/suppliers')
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setSuppliers(list);
        if (list.length > 0) {
          setSelectedSupplier(list[0].name);
        }
      })
      .catch((err) => console.warn('Could not load suppliers', err));
  }, []);

  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item_${Date.now()}`,
        name: '',
        genericName: '',
        strength: '',
        batchNumber: '',
        costPrice: '',
        sellingPrice: '',
        quantity: '',
        expiryDate: '',
      },
    ]);
  };

  const removeItemRow = (id: string) => {
    if (items.length === 1) {
      Alert.alert('Notice', 'At least one medicine item is required.');
      return;
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, field: keyof RestockItem, value: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const totals = useMemo(() => {
    const totalCost = items.reduce((acc, item) => {
      const qty = parseInt(item.quantity, 10) || 0;
      const cost = parseFloat(item.costPrice) || 0;
      return acc + qty * cost;
    }, 0);
    const totalUnits = items.reduce((acc, item) => acc + (parseInt(item.quantity, 10) || 0), 0);
    return { totalCost, totalUnits };
  }, [items]);

  const handleSubmit = async () => {
    // Validation
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.name.trim()) {
        Alert.alert('Validation Error', `Please enter the medicine name for item #${i + 1}.`);
        return;
      }
      const qty = parseInt(it.quantity, 10);
      if (!qty || qty <= 0) {
        Alert.alert('Validation Error', `Quantity for "${it.name}" must be at least 1.`);
        return;
      }
      const cost = parseFloat(it.costPrice);
      if (Number.isNaN(cost) || cost < 0) {
        Alert.alert('Validation Error', `Cost price for "${it.name}" must be valid.`);
        return;
      }
      const sell = parseFloat(it.sellingPrice);
      if (Number.isNaN(sell) || sell < 0) {
        Alert.alert('Validation Error', `Selling price for "${it.name}" must be valid.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        supplier: selectedSupplier.trim() || null,
        warehouse: warehouse.trim() || 'Main Pharmacy',
        invoiceNumber: invoiceNumber.trim() || null,
        receivedDate: receivedDate || new Date().toISOString().split('T')[0],
        items: items.map((it) => ({
          name: it.name.trim(),
          genericName: it.genericName.trim() || null,
          strength: it.strength.trim() || null,
          batchNumber: it.batchNumber.trim() || null,
          quantity: parseInt(it.quantity, 10),
          costPrice: parseFloat(it.costPrice) || 0,
          sellingPrice: parseFloat(it.sellingPrice) || 0,
          expiryDate: it.expiryDate.trim() || null,
        })),
      };

      await apiClient.post('/api/inventory/batch', payload);
      Alert.alert(
        'Stock Added',
        `Successfully received ${totals.totalUnits} units across ${items.length} line item(s).`,
        [
          {
            text: 'View Inventory',
            onPress: () => router.replace('/(tabs)/inventory'),
          },
          {
            text: 'Add More Stock',
            onPress: () => {
              setItems([
                {
                  id: `item_${Date.now()}`,
                  name: '',
                  genericName: '',
                  strength: '',
                  batchNumber: '',
                  costPrice: '',
                  sellingPrice: '',
                  quantity: '',
                  expiryDate: '',
                },
              ]);
            },
          },
        ]
      );
    } catch (err: unknown) {
      console.error('Failed to add stock batch', err);
      const reqErr = err as { response?: { data?: { error?: string; message?: string } } };
      Alert.alert(
        'Error Adding Stock',
        reqErr.response?.data?.error ||
          reqErr.response?.data?.message ||
          'Failed to record batch. Please check inputs.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RoleGuard page="add-stock">
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 24, 32) }]}
      >
        {/* Top Header */}
        <View style={styles.topHeader}>
          <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
            <ArrowLeft size={22} color={theme.text} />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { color: theme.navigation }]}>
              Restock & Add Stock
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.mutedText }]}>
              Receive medicine batches into pharmacy inventory
            </Text>
          </View>
        </View>
  
        {/* Shipment Metadata Card */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Batch Metadata</Text>
  
          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Supplier Partner</Text>
          <TextInput
            value={selectedSupplier}
            onChangeText={setSelectedSupplier}
            placeholder="e.g. Lusaka Pharma Distributors"
            placeholderTextColor={theme.mutedText}
            style={[styles.input, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }]}
          />
  
          <View style={styles.formRow}>
            <View style={styles.formCol}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Warehouse</Text>
              <TextInput
                value={warehouse}
                onChangeText={setWarehouse}
                style={[styles.input, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }]}
              />
            </View>
            <View style={styles.formCol}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Invoice Number</Text>
              <TextInput
                value={invoiceNumber}
                onChangeText={setInvoiceNumber}
                style={[styles.input, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }]}
              />
            </View>
          </View>
  
          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Date Received</Text>
          <TextInput
            value={receivedDate}
            onChangeText={setReceivedDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.mutedText}
            style={[styles.input, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }]}
          />
        </View>
  
        {/* Line Items List */}
        <View style={styles.sectionHeadingRow}>
          <Text style={[styles.sectionHeading, { color: theme.mutedText }]}>
            RESTOCK LINE ITEMS ({items.length})
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={addItemRow}
            style={[styles.addItemBtn, { backgroundColor: theme.primarySoft }]}
          >
            <Plus size={15} color={theme.primary} />
            <Text style={[styles.addItemBtnText, { color: theme.primary }]}>Add Line Item</Text>
          </Pressable>
        </View>
  
        {items.map((item, index) => (
          <View
            key={item.id}
            style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, marginBottom: 14 }]}
          >
            <View style={styles.itemHeader}>
              <Text style={[styles.itemHeaderTitle, { color: theme.navigation }]}>
                Item #{index + 1}
              </Text>
              {items.length > 1 ? (
                <Pressable
                  accessibilityLabel="Remove item"
                  hitSlop={8}
                  onPress={() => removeItemRow(item.id)}
                >
                  <Trash2 size={18} color={theme.danger} />
                </Pressable>
              ) : null}
            </View>
  
            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Medicine Name *</Text>
            <TextInput
              value={item.name}
              onChangeText={(val) => updateItem(item.id, 'name', val)}
              placeholder="e.g. Amoxicillin 500mg"
              placeholderTextColor={theme.mutedText}
              style={[styles.input, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }]}
            />
  
            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Generic Name</Text>
                <TextInput
                  value={item.genericName}
                  onChangeText={(val) => updateItem(item.id, 'genericName', val)}
                  placeholder="e.g. Amoxicillin"
                  placeholderTextColor={theme.mutedText}
                  style={[styles.input, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }]}
                />
              </View>
              <View style={styles.formCol}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Strength</Text>
                <TextInput
                  value={item.strength}
                  onChangeText={(val) => updateItem(item.id, 'strength', val)}
                  placeholder="e.g. 500mg"
                  placeholderTextColor={theme.mutedText}
                  style={[styles.input, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }]}
                />
              </View>
            </View>
  
            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Batch Number</Text>
                <TextInput
                  value={item.batchNumber}
                  onChangeText={(val) => updateItem(item.id, 'batchNumber', val)}
                  placeholder="Auto if blank"
                  placeholderTextColor={theme.mutedText}
                  style={[styles.input, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }]}
                />
              </View>
              <View style={styles.formCol}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Quantity *</Text>
                <TextInput
                  value={item.quantity}
                  onChangeText={(val) => updateItem(item.id, 'quantity', val)}
                  placeholder="e.g. 100"
                  keyboardType="numeric"
                  placeholderTextColor={theme.mutedText}
                  style={[styles.input, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }]}
                />
              </View>
            </View>
  
            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Cost Price (K) *</Text>
                <TextInput
                  value={item.costPrice}
                  onChangeText={(val) => updateItem(item.id, 'costPrice', val)}
                  placeholder="e.g. 12.50"
                  keyboardType="decimal-pad"
                  placeholderTextColor={theme.mutedText}
                  style={[styles.input, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }]}
                />
              </View>
              <View style={styles.formCol}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Selling Price (K) *</Text>
                <TextInput
                  value={item.sellingPrice}
                  onChangeText={(val) => updateItem(item.id, 'sellingPrice', val)}
                  placeholder="e.g. 20.00"
                  keyboardType="decimal-pad"
                  placeholderTextColor={theme.mutedText}
                  style={[styles.input, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }]}
                />
              </View>
            </View>
  
            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Expiry Date (YYYY-MM-DD)</Text>
            <TextInput
              value={item.expiryDate}
              onChangeText={(val) => updateItem(item.id, 'expiryDate', val)}
              placeholder="e.g. 2027-12-31"
              placeholderTextColor={theme.mutedText}
              style={[styles.input, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }]}
            />
          </View>
        ))}
  
        {/* Totals Summary & Submit Button */}
        <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.summaryLine}>
            <Text style={[styles.summaryLabel, { color: theme.mutedText }]}>Total Units Receiving:</Text>
            <Text style={[styles.summaryVal, { color: theme.text }]}>{totals.totalUnits} units</Text>
          </View>
          <View style={styles.summaryLine}>
            <Text style={[styles.summaryLabel, { color: theme.mutedText }]}>Total Shipment Cost:</Text>
            <Text style={[styles.summaryVal, { color: theme.primary }]}>
              K {totals.totalCost.toFixed(2)}
            </Text>
          </View>
          <Button
            title={submitting ? 'Recording Batch...' : 'Record & Receive Inventory'}
            onPress={handleSubmit}
            loading={submitting}
            variant="primary"
            size="lg"
            fullWidth
            style={{ marginTop: 12 }}
          />
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
  card: {
    borderRadius: layout.radius.xl,
    padding: layout.spacing.lg,
    borderWidth: 1,
    marginBottom: layout.spacing.md,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  fieldLabel: { fontSize: 11, fontWeight: '700', marginTop: 10, marginBottom: 4 },
  input: {
    height: 46,
    borderRadius: layout.radius.sm,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  formRow: { flexDirection: 'row', gap: 10 },
  formCol: { flex: 1 },
  sectionHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  sectionHeading: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: layout.radius.sm,
  },
  addItemBtnText: { fontSize: 12, fontWeight: '700' },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemHeaderTitle: { fontSize: 14, fontWeight: '800' },
  summaryCard: {
    borderRadius: layout.radius.xl,
    padding: layout.spacing.lg,
    borderWidth: 1,
    marginTop: 8,
  },
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  summaryLabel: { fontSize: 13, fontWeight: '600' },
  summaryVal: { fontSize: 15, fontWeight: '800' },
});
