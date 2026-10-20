import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  Modal,
  Linking,
  ScrollView,
  TextInput,
  RefreshControl,
} from 'react-native';
import { Text, View } from '@/components/Themed';
import apiClient from '@/api/client';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Truck,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  Star,
  X,
  Briefcase,
} from 'lucide-react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { layout } from '@/constants/theme';
import { SearchInput } from '@/components/ui/SearchInput';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

export default function SuppliersScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Onboard modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [submitting, setSubmitting] = useState(false);

  const loadSuppliers = useCallback(async () => {
    try {
      const response = await apiClient.get('/api/suppliers');
      const data = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setSuppliers(data);
    } catch (err) {
      console.warn('Failed to load suppliers', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const stats = useMemo(() => {
    const total = suppliers.length;
    const totalOwed = suppliers.reduce((acc, s) => acc + (s.balanceOwed || 0), 0);
    const topRated = suppliers.filter((s) => (s.rating || 0) === 5).length;
    return { total, totalOwed, topRated };
  }, [suppliers]);

  const filteredSuppliers = useMemo(() => {
    if (!search.trim()) return suppliers;
    const q = search.toLowerCase().trim();
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.contactPerson && s.contactPerson.toLowerCase().includes(q))
    );
  }, [suppliers, search]);

  const handleCreateSupplier = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Supplier company name is required.');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post('/api/suppliers', {
        name: name.trim(),
        contactPerson: contactPerson.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        paymentTerms: paymentTerms.trim() || 'Net 30',
      });
      setShowAddModal(false);
      setName('');
      setContactPerson('');
      setPhone('');
      setEmail('');
      setAddress('');
      Alert.alert('Supplier Onboarded', `${name} has been added to procurement partners.`);
      loadSuppliers();
    } catch (err: unknown) {
      const reqErr = err as { response?: { data?: { error?: string } } };
      Alert.alert('Error', reqErr.response?.data?.error || 'Failed to onboard supplier.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCall = (phoneNumber?: string) => {
    if (!phoneNumber) return;
    Linking.openURL(`tel:${phoneNumber.replace(/\s+/g, '')}`);
  };

  const handleEmail = (emailAddress?: string) => {
    if (!emailAddress) return;
    Linking.openURL(`mailto:${emailAddress}`);
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
              Supplier Partners
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.mutedText }]}>
              Procurement partners, delivery terms & balances
            </Text>
          </View>
          <Button
            title="Onboard"
            onPress={() => setShowAddModal(true)}
            variant="primary"
            size="sm"
            leftIcon={<Plus size={16} color="#ffffff" />}
          />
        </View>

        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by supplier or contact person..."
          style={{ marginTop: 8 }}
        />
      </View>

      {/* Supplier List */}
      <FlatList
        data={filteredSuppliers}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadSuppliers();
            }}
            tintColor={theme.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.statsRow}>
            <StatCard
              style={styles.statCard}
              label="Total Partners"
              value={stats.total}
              icon={<Truck size={18} color="#166534" />}
              iconBg="#dcfce7"
            />
            <StatCard
              style={styles.statCard}
              label="Balance Owed"
              value={`K ${Math.round(stats.totalOwed).toLocaleString()}`}
              icon={<DollarSign size={18} color="#b91c1c" />}
              iconBg="#fee2e2"
            />
            <StatCard
              style={styles.statCard}
              label="Top Rated"
              value={stats.topRated}
              icon={<Star size={18} color="#a16207" />}
              iconBg="#fef9c3"
            />
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.cardTopRow}>
              <View style={styles.cardTitleWrap}>
                <Text style={[styles.supplierName, { color: theme.text }]}>{item.name}</Text>
                {item.contactPerson ? (
                  <Text style={[styles.contactPerson, { color: theme.mutedText }]}>
                    Contact: {item.contactPerson}
                  </Text>
                ) : null}
              </View>
              <Badge
                label={item.paymentTerms || 'Net 30'}
                variant="info"
                size="sm"
              />
            </View>

            <View style={[styles.infoBlock, { backgroundColor: theme.surfaceMuted }]}>
              {item.phone ? (
                <View style={styles.metaRow}>
                  <Phone size={13} color={theme.mutedText} />
                  <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                    {item.phone}
                  </Text>
                </View>
              ) : null}
              {item.email ? (
                <View style={styles.metaRow}>
                  <Mail size={13} color={theme.mutedText} />
                  <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                    {item.email}
                  </Text>
                </View>
              ) : null}
              {item.address ? (
                <View style={styles.metaRow}>
                  <MapPin size={13} color={theme.mutedText} />
                  <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                    {item.address}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={[styles.actionsRow, { borderTopColor: theme.borderLight }]}>
              <View style={styles.balanceWrap}>
                <Text style={[styles.balanceLabel, { color: theme.mutedText }]}>Balance Owed:</Text>
                <Text style={[styles.balanceAmount, { color: theme.navigation }]}>
                  K {Number(item.balanceOwed || 0).toFixed(2)}
                </Text>
              </View>

              <View style={styles.directActions}>
                {item.phone ? (
                  <Pressable
                    style={[styles.smallBtn, { backgroundColor: theme.primarySoft }]}
                    onPress={() => handleCall(item.phone)}
                  >
                    <Phone size={13} color={theme.primary} />
                    <Text style={[styles.smallBtnText, { color: theme.primary }]}>Call</Text>
                  </Pressable>
                ) : null}
                {item.email ? (
                  <Pressable
                    style={[styles.smallBtn, { backgroundColor: theme.surfaceMuted }]}
                    onPress={() => handleEmail(item.email)}
                  >
                    <Mail size={13} color={theme.textSecondary} />
                    <Text style={[styles.smallBtnText, { color: theme.textSecondary }]}>Email</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon={<Truck size={32} color={theme.mutedText} />}
              title="No suppliers found"
              description="Tap 'Onboard' above to register new pharmaceutical distributors."
            />
          ) : null
        }
      />

      {/* Onboard Supplier Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.navigation }]}>
                Onboard New Supplier
              </Text>
              <Pressable hitSlop={8} onPress={() => setShowAddModal(false)}>
                <X size={20} color={theme.mutedText} />
              </Pressable>
            </View>

            <ScrollView style={{ marginTop: 12 }}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Company Name *</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. MedPharm Zambia Ltd"
                placeholderTextColor={theme.mutedText}
                style={[styles.input, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }]}
              />

              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Contact Person</Text>
              <TextInput
                value={contactPerson}
                onChangeText={setContactPerson}
                placeholder="e.g. Mwamba Banda"
                placeholderTextColor={theme.mutedText}
                style={[styles.input, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }]}
              />

              <View style={styles.formRow}>
                <View style={styles.formCol}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Phone Number</Text>
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="+260 97 XXXXXXX"
                    placeholderTextColor={theme.mutedText}
                    style={[styles.input, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }]}
                  />
                </View>
                <View style={styles.formCol}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Payment Terms</Text>
                  <TextInput
                    value={paymentTerms}
                    onChangeText={setPaymentTerms}
                    placeholder="Net 30, COD, etc."
                    placeholderTextColor={theme.mutedText}
                    style={[styles.input, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }]}
                  />
                </View>
              </View>

              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Email Address</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="orders@medpharm.co.zm"
                placeholderTextColor={theme.mutedText}
                style={[styles.input, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }]}
              />

              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Physical Address</Text>
              <TextInput
                value={address}
                onChangeText={setAddress}
                placeholder="Plot 45, Industrial Area, Lusaka"
                placeholderTextColor={theme.mutedText}
                style={[styles.input, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }]}
              />

              <View style={{ marginTop: 16 }}>
                <Button
                  title={submitting ? 'Onboarding...' : 'Onboard Partner'}
                  onPress={handleCreateSupplier}
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
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  cardTitleWrap: { flex: 1, paddingRight: 8 },
  supplierName: { fontSize: 15, fontWeight: '800' },
  contactPerson: { fontSize: 12, marginTop: 2 },
  infoBlock: {
    padding: 10,
    borderRadius: layout.radius.sm,
    marginVertical: 6,
    gap: 4,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12 },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    marginTop: 4,
  },
  balanceWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  balanceLabel: { fontSize: 11, fontWeight: '600' },
  balanceAmount: { fontSize: 14, fontWeight: '800' },
  directActions: { flexDirection: 'row', gap: 6 },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: layout.radius.sm,
  },
  smallBtnText: { fontSize: 11, fontWeight: '700' },
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
  formRow: { flexDirection: 'row', gap: 10 },
  formCol: { flex: 1 },
});
