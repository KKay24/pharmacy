import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  FlatList,
  Pressable,
  Linking,
  Modal,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Text, View } from '@/components/Themed';
import apiClient from '@/api/client';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Users,
  Search,
  ShieldAlert,
  Star,
  Phone,
  Mail,
  MapPin,
  Clock,
  X,
  FileText,
} from 'lucide-react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { layout } from '@/constants/theme';
import { SearchInput } from '@/components/ui/SearchInput';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

export default function CustomersScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [patientHistory, setPatientHistory] = useState<any | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadCustomers = useCallback(async () => {
    try {
      const response = await apiClient.get('/api/customers?limit=100');
      const data = response.data?.data || (Array.isArray(response.data) ? response.data : []);
      setCustomers(data);
    } catch (err) {
      console.warn('Failed to load customers', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const stats = useMemo(() => {
    const total = customers.length;
    const totalPoints = customers.reduce((acc, c) => acc + (c.loyaltyPoints || 0), 0);
    const withAllergies = customers.filter(
      (c) => c.allergies && c.allergies.toLowerCase() !== 'none'
    ).length;
    return { total, totalPoints, withAllergies };
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase().trim();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q))
    );
  }, [customers, search]);

  const openPatientDetail = async (patient: any) => {
    setSelectedPatient(patient);
    setLoadingHistory(true);
    try {
      const res = await apiClient.get(`/api/customers/${patient.id}`);
      setPatientHistory(res.data);
    } catch (err) {
      console.warn('Failed to fetch patient history', err);
      setPatientHistory(null);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCall = (phone?: string) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`);
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
              Patient & Customer Hub
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.mutedText }]}>
              Medical history, allergy alerts & loyalty status
            </Text>
          </View>
        </View>

        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by patient name or phone number..."
          style={{ marginTop: 8 }}
        />
      </View>

      {/* Patients List */}
      <FlatList
        data={filteredCustomers}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadCustomers();
            }}
            tintColor={theme.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.statsRow}>
            <StatCard
              style={styles.statCard}
              label="Total Patients"
              value={stats.total}
              icon={<Users size={18} color="#0369a1" />}
              iconBg="#e0f2fe"
            />
            <StatCard
              style={styles.statCard}
              label="Allergy Alerts"
              value={stats.withAllergies}
              icon={<ShieldAlert size={18} color="#b91c1c" />}
              iconBg="#fee2e2"
            />
            <StatCard
              style={styles.statCard}
              label="Loyalty Points"
              value={stats.totalPoints}
              icon={<Star size={18} color="#a16207" />}
              iconBg="#fef9c3"
            />
          </View>
        }
        renderItem={({ item }) => {
          const hasAllergies =
            item.allergies && item.allergies.toLowerCase() !== 'none';
          return (
            <Pressable
              accessibilityRole="button"
              style={[styles.patientCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => openPatientDetail(item)}
            >
              <View style={styles.patientTopRow}>
                <View style={[styles.avatarCircle, { backgroundColor: theme.primarySoft }]}>
                  <Text style={[styles.avatarText, { color: theme.primary }]}>
                    {item.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.patientCopy}>
                  <Text style={[styles.patientName, { color: theme.text }]}>{item.name}</Text>
                  <Text style={[styles.patientMeta, { color: theme.mutedText }]}>
                    {item.phone || 'No phone'} · {item.email || 'No email'}
                  </Text>
                </View>
                <Badge
                  label={`★ ${item.loyaltyPoints || 0} pts`}
                  variant="warning"
                  size="sm"
                />
              </View>

              {hasAllergies ? (
                <View style={[styles.allergyBanner, { backgroundColor: theme.dangerSoft, borderColor: theme.danger }]}>
                  <ShieldAlert size={14} color={theme.danger} />
                  <Text style={[styles.allergyText, { color: theme.danger }]}>
                    Allergy Alert: {item.allergies}
                  </Text>
                </View>
              ) : null}

              {item.phone ? (
                <View style={[styles.actionsRow, { borderTopColor: theme.borderLight }]}>
                  <Pressable
                    style={[styles.callBtn, { backgroundColor: theme.primarySoft }]}
                    onPress={() => handleCall(item.phone)}
                  >
                    <Phone size={13} color={theme.primary} />
                    <Text style={[styles.callBtnText, { color: theme.primary }]}>
                      Call {item.phone}
                    </Text>
                  </Pressable>
                  <Text style={[styles.viewDetailsText, { color: theme.mutedText }]}>
                    View Records →
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon={<Users size={32} color={theme.mutedText} />}
              title="No patients found"
              description="Patients added through sales or registrations will appear here."
            />
          ) : null
        }
      />

      {/* Patient History Detail Modal */}
      <Modal visible={!!selectedPatient} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <View>
                <Text style={[styles.modalTitle, { color: theme.navigation }]}>
                  {selectedPatient?.name}
                </Text>
                <Text style={[styles.modalSub, { color: theme.mutedText }]}>
                  Patient Medical & Dispense History
                </Text>
              </View>
              <Pressable hitSlop={8} onPress={() => setSelectedPatient(null)}>
                <X size={20} color={theme.mutedText} />
              </Pressable>
            </View>

            <ScrollView style={{ marginTop: 12 }}>
              {selectedPatient ? (
                <>
                  <View style={[styles.infoSection, { backgroundColor: theme.surfaceMuted }]}>
                    <Text style={[styles.infoSectionTitle, { color: theme.textSecondary }]}>
                      CLINICAL PROFILE
                    </Text>
                    <Text style={[styles.infoRow, { color: theme.text }]}>
                      Phone: <Text style={{ fontWeight: '700' }}>{selectedPatient.phone || 'N/A'}</Text>
                    </Text>
                    <Text style={[styles.infoRow, { color: theme.text }]}>
                      Email: <Text style={{ fontWeight: '700' }}>{selectedPatient.email || 'N/A'}</Text>
                    </Text>
                    <Text style={[styles.infoRow, { color: theme.text }]}>
                      Allergies:{' '}
                      <Text style={{ fontWeight: '700', color: theme.danger }}>
                        {selectedPatient.allergies || 'None recorded'}
                      </Text>
                    </Text>
                    <Text style={[styles.infoRow, { color: theme.text }]}>
                      Loyalty Balance:{' '}
                      <Text style={{ fontWeight: '700', color: theme.primary }}>
                        {selectedPatient.loyaltyPoints || 0} points
                      </Text>
                    </Text>
                  </View>

                  <View style={{ marginTop: 14 }}>
                    <Text style={[styles.infoSectionTitle, { color: theme.mutedText, marginBottom: 8 }]}>
                      RECENT DISPENSED TRANSACTIONS
                    </Text>
                    {(patientHistory?.Sales || patientHistory?.sales || []).length > 0 ? (
                      (patientHistory?.Sales || patientHistory?.sales || []).map(
                        (sale: any, idx: number) => (
                          <View
                            key={idx}
                            style={[styles.historyRow, { borderBottomColor: theme.borderLight }]}
                          >
                            <View>
                              <Text style={[styles.historyItemName, { color: theme.text }]}>
                                {sale.name} × {sale.quantity}
                              </Text>
                              <Text style={[styles.historyDate, { color: theme.mutedText }]}>
                                {sale.date ? new Date(sale.date).toLocaleDateString() : '—'}
                              </Text>
                            </View>
                            <Text style={[styles.historyAmount, { color: theme.primary }]}>
                              K {Number(sale.totalPrice || 0).toFixed(2)}
                            </Text>
                          </View>
                        )
                      )
                    ) : (
                      <Text style={[styles.emptyHistory, { color: theme.mutedText }]}>
                        No previous dispensary records found for this patient.
                      </Text>
                    )}
                  </View>
                </>
              ) : null}
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
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: layout.spacing.md,
  },
  statCard: { flex: 1, padding: 10 },
  listContent: { padding: layout.spacing.lg, paddingBottom: 60 },
  patientCard: {
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
  patientTopRow: { flexDirection: 'row', alignItems: 'center' },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 18, fontWeight: '900' },
  patientCopy: { flex: 1 },
  patientName: { fontSize: 15, fontWeight: '800' },
  patientMeta: { fontSize: 11, marginTop: 2 },
  allergyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: layout.radius.sm,
    borderWidth: 1,
    marginTop: 10,
  },
  allergyText: { fontSize: 11, fontWeight: '700' },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: layout.radius.sm,
  },
  callBtnText: { fontSize: 11, fontWeight: '700' },
  viewDetailsText: { fontSize: 11, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 49, 86, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: layout.radius.xxl,
    borderTopRightRadius: layout.radius.xxl,
    padding: layout.spacing.xl,
    height: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalSub: { fontSize: 12, marginTop: 2 },
  infoSection: {
    padding: 12,
    borderRadius: layout.radius.md,
    gap: 4,
  },
  infoSectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginBottom: 4 },
  infoRow: { fontSize: 13, marginVertical: 2 },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  historyItemName: { fontSize: 13, fontWeight: '700' },
  historyDate: { fontSize: 11, marginTop: 2 },
  historyAmount: { fontSize: 14, fontWeight: '800' },
  emptyHistory: { fontStyle: 'italic', fontSize: 12, paddingVertical: 10 },
});
