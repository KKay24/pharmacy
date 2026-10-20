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
  FileText,
  Search,
  Plus,
  Clock,
  CheckCircle2,
  PauseCircle,
  User,
  Stethoscope,
  Calendar,
  X,
  ShieldCheck,
} from 'lucide-react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { layout } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { SearchInput } from '@/components/ui/SearchInput';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

const STATUS_TABS = [
  'All',
  'Pending',
  'Ready for Pickup',
  'Filled',
  'On Hold',
] as const;

export default function PrescriptionsScreen() {
  const { user } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<string>('All');

  // New Prescription modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [medications, setMedications] = useState('');
  const [prescriber, setPrescriber] = useState('');
  const [insurance, setInsurance] = useState('Self-Pay');
  const [submitting, setSubmitting] = useState(false);

  const loadPrescriptions = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const response = await apiClient.get('/api/prescriptions?limit=100');
      const data = response.data?.data || (Array.isArray(response.data) ? response.data : []);
      setPrescriptions(data);
    } catch (err) {
      console.error('Failed to load prescriptions', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadPrescriptions();
    } else {
      setLoading(false);
    }
  }, [user, loadPrescriptions]);

  const filtered = useMemo(() => {
    return prescriptions.filter((p) => {
      if (activeTab !== 'All' && p.status !== activeTab) return false;
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matches =
          p.patientName?.toLowerCase().includes(q) ||
          p.medications?.toLowerCase().includes(q) ||
          p.prescriber?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [prescriptions, activeTab, search]);

  const handleUpdateStatus = async (id: number, nextStatus: string) => {
    try {
      await apiClient.put(`/api/prescriptions/${id}/status`, { status: nextStatus });
      Alert.alert('Status Updated', `Prescription marked as "${nextStatus}".`);
      loadPrescriptions();
    } catch (err: unknown) {
      const reqErr = err as { response?: { data?: { error?: string } } };
      Alert.alert('Error', reqErr.response?.data?.error || 'Failed to update prescription status.');
    }
  };

  const handleCreatePrescription = async () => {
    if (!patientName.trim() || !medications.trim()) {
      Alert.alert('Validation Error', 'Please enter patient name and prescribed medications.');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post('/api/prescriptions', {
        patientName: patientName.trim(),
        medications: medications.trim(),
        prescriber: prescriber.trim() || 'Dr. On Duty',
        insurance: insurance.trim() || 'Self-Pay',
        dueDate: new Date().toISOString().split('T')[0],
      });
      setShowAddModal(false);
      setPatientName('');
      setMedications('');
      setPrescriber('');
      Alert.alert('Prescription Created', 'Prescription has been added to the queue.');
      loadPrescriptions();
    } catch (err: unknown) {
      const reqErr = err as { response?: { data?: { error?: string } } };
      Alert.alert('Error', reqErr.response?.data?.error || 'Failed to create prescription.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Filled':
        return 'info';
      case 'Ready for Pickup':
        return 'success';
      case 'Pending':
        return 'warning';
      case 'On Hold':
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
              Prescription Management
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.mutedText }]}>
              Fill orders, track patient records & dispensary queue
            </Text>
          </View>
          <Button
            title="New Rx"
            onPress={() => setShowAddModal(true)}
            variant="primary"
            size="sm"
            leftIcon={<Plus size={16} color="#ffffff" />}
          />
        </View>

        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by patient, medicine, prescriber..."
          style={{ marginTop: 8 }}
        />

        {/* Status Scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statusScroll}
        >
          {STATUS_TABS.map((status) => {
            const active = activeTab === status;
            return (
              <Pressable
                key={status}
                accessibilityRole="button"
                onPress={() => setActiveTab(status)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active ? theme.navigation : theme.surfaceMuted,
                    borderColor: active ? theme.navigation : theme.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: active ? '#ffffff' : theme.textSecondary },
                  ]}
                >
                  {status}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Prescriptions List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadPrescriptions();
            }}
            tintColor={theme.primary}
          />
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.cardTopRow}>
              <View>
                <Text style={[styles.patientName, { color: theme.text }]}>{item.patientName}</Text>
                <Text style={[styles.prescriberText, { color: theme.mutedText }]}>
                  Rx from {item.prescriber || 'Doctor'}
                </Text>
              </View>
              <Badge
                label={item.status || 'Pending'}
                variant={getStatusBadgeVariant(item.status)}
                size="md"
              />
            </View>

            <View style={[styles.medicationBox, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderLight }]}>
              <Text style={[styles.medicationHeading, { color: theme.mutedText }]}>
                PRESCRIBED MEDICATIONS
              </Text>
              <Text style={[styles.medicationBody, { color: theme.text }]}>
                {item.medications}
              </Text>
            </View>

            <View style={styles.metaRow}>
              <View style={styles.metaCol}>
                <Text style={[styles.metaLabel, { color: theme.mutedText }]}>Insurance</Text>
                <Text style={[styles.metaValue, { color: theme.textSecondary }]}>
                  {item.insurance || 'Self-Pay'}
                </Text>
              </View>
              <View style={styles.metaCol}>
                <Text style={[styles.metaLabel, { color: theme.mutedText }]}>Due Date</Text>
                <Text style={[styles.metaValue, { color: theme.textSecondary }]}>
                  {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'Today'}
                </Text>
              </View>
            </View>

            {/* Quick Status Action Buttons */}
            <View style={[styles.actionsRow, { borderTopColor: theme.borderLight }]}>
              {item.status !== 'Filled' ? (
                <Button
                  title="Mark Filled"
                  onPress={() => handleUpdateStatus(item.id, 'Filled')}
                  variant="outline"
                  size="sm"
                />
              ) : null}
              {item.status !== 'Ready for Pickup' ? (
                <Button
                  title="Ready for Pickup"
                  onPress={() => handleUpdateStatus(item.id, 'Ready for Pickup')}
                  variant="primary"
                  size="sm"
                />
              ) : null}
              {item.status !== 'On Hold' ? (
                <Button
                  title="Hold"
                  onPress={() => handleUpdateStatus(item.id, 'On Hold')}
                  variant="ghost"
                  size="sm"
                />
              ) : null}
            </View>
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon={<FileText size={32} color={theme.mutedText} />}
              title="No prescriptions in this queue"
              description="Prescriptions uploaded by patients or added by staff will appear here."
            />
          ) : null
        }
      />

      {/* Add Prescription Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.navigation }]}>
                New Prescription Fill
              </Text>
              <Pressable hitSlop={8} onPress={() => setShowAddModal(false)}>
                <X size={20} color={theme.mutedText} />
              </Pressable>
            </View>

            <ScrollView style={{ marginTop: 12 }}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Patient Full Name *</Text>
              <TextInput
                value={patientName}
                onChangeText={setPatientName}
                placeholder="e.g. Chileshe Mumba"
                placeholderTextColor={theme.mutedText}
                style={[styles.input, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }]}
              />

              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Prescribed Medications *</Text>
              <TextInput
                value={medications}
                onChangeText={setMedications}
                placeholder="e.g. Amoxicillin 500mg capsules, Paracetamol 500mg"
                placeholderTextColor={theme.mutedText}
                multiline
                numberOfLines={3}
                style={[styles.inputMulti, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }]}
              />

              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Prescriber / Doctor</Text>
              <TextInput
                value={prescriber}
                onChangeText={setPrescriber}
                placeholder="Dr. Name or Hospital"
                placeholderTextColor={theme.mutedText}
                style={[styles.input, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }]}
              />

              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Insurance / Scheme</Text>
              <TextInput
                value={insurance}
                onChangeText={setInsurance}
                placeholder="Self-Pay, NHIMA, Madison, etc."
                placeholderTextColor={theme.mutedText}
                style={[styles.input, { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text }]}
              />

              <View style={{ marginTop: 16 }}>
                <Button
                  title={submitting ? 'Creating...' : 'Add to Dispensary Queue'}
                  onPress={handleCreatePrescription}
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
  statusScroll: { gap: 8, paddingVertical: 10 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: layout.radius.full,
    borderWidth: 1,
  },
  filterChipText: { fontSize: 12, fontWeight: '700' },
  listContent: { padding: layout.spacing.lg, paddingBottom: 60 },
  card: {
    borderRadius: layout.radius.lg,
    padding: layout.spacing.lg,
    borderWidth: 1,
    marginBottom: layout.spacing.md,
    shadowColor: '#0b3156',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  patientName: { fontSize: 16, fontWeight: '800' },
  prescriberText: { fontSize: 12, marginTop: 2 },
  medicationBox: {
    padding: 10,
    borderRadius: layout.radius.sm,
    borderWidth: 1,
    marginVertical: 8,
  },
  medicationHeading: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, marginBottom: 4 },
  medicationBody: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
  metaCol: { flex: 1 },
  metaLabel: { fontSize: 10, fontWeight: '600' },
  metaValue: { fontSize: 12, fontWeight: '700', marginTop: 1 },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    marginTop: 6,
  },
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
  fieldLabel: { fontSize: 12, fontWeight: '700', marginTop: 10, marginBottom: 4 },
  input: {
    height: 46,
    borderRadius: layout.radius.sm,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  inputMulti: {
    minHeight: 70,
    borderRadius: layout.radius.sm,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
  },
});
