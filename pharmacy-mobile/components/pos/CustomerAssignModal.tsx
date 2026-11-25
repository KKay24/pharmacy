import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Text } from '@/components/Themed';
import apiClient from '@/api/client';
import Colors from '@/constants/Colors';
import { layout } from '@/constants/theme';
import { useColorScheme } from '@/components/useColorScheme';
import { SearchInput } from '@/components/ui/SearchInput';
import { Button } from '@/components/ui/Button';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Phone,
  RefreshCw,
  User,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface PosCustomer {
  id: number;
  patientCode?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  name: string;
  phone?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  address?: string | null;
  email?: string | null;
}

export type CustomerAssignment =
  | { type: 'WALK_IN' }
  | { type: 'REGISTERED'; customer: PosCustomer };

interface CustomerAssignModalProps {
  visible: boolean;
  assignment: CustomerAssignment;
  initialCustomers: PosCustomer[];
  onClose: () => void;
  onSelectWalkIn: () => void;
  onSelectPatient: (customer: PosCustomer) => void;
  onPatientRegistered: (customer: PosCustomer) => void;
}

const GENDER_OPTIONS = ['Female', 'Male', 'Other', 'Prefer not to say'] as const;

function formatPatientId(customer: PosCustomer): string {
  return customer.patientCode || `MQP-${String(customer.id).padStart(6, '0')}`;
}

function matchesPatientQuery(customer: PosCustomer, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  const code = formatPatientId(customer).toLowerCase();
  const numericId = String(customer.id);
  const digitsQuery = q.replace(/\D/g, '');
  const phoneDigits = (customer.phone || '').replace(/\D/g, '');

  return (
    customer.name.toLowerCase().includes(q) ||
    (customer.firstName ? customer.firstName.toLowerCase().includes(q) : false) ||
    (customer.lastName ? customer.lastName.toLowerCase().includes(q) : false) ||
    (customer.phone ? customer.phone.toLowerCase().includes(q) : false) ||
    code.includes(q) ||
    numericId === q.replace(/^#/, '') ||
    (digitsQuery.length >= 3 && phoneDigits.includes(digitsQuery))
  );
}

function validateDobInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return 'Use YYYY-MM-DD format (e.g. 1994-08-21).';
  }
  const [year, month, day] = trimmed.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return 'Enter a valid calendar date.';
  }
  if (trimmed > new Date().toISOString().slice(0, 10)) {
    return 'Date of birth cannot be in the future.';
  }
  return null;
}

export function CustomerAssignModal({
  visible,
  assignment,
  initialCustomers,
  onClose,
  onSelectWalkIn,
  onSelectPatient,
  onPatientRegistered,
}: CustomerAssignModalProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [mode, setMode] = useState<'select' | 'register'>('select');
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<PosCustomer[]>(initialCustomers);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Registration form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<string>('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicateCustomer, setDuplicateCustomer] = useState<PosCustomer | null>(null);

  const requestSeqRef = useRef(0);

  useEffect(() => {
    setCustomers(initialCustomers);
  }, [initialCustomers]);

  const fetchPatients = async (queryText = '') => {
    const seq = ++requestSeqRef.current;
    setFetching(true);
    setFetchError(null);
    try {
      const trimmed = queryText.trim();
      const endpoint = trimmed
        ? `/api/customers?q=${encodeURIComponent(trimmed)}&limit=50`
        : '/api/customers?limit=100';
      const response = await apiClient.get(endpoint);
      if (seq !== requestSeqRef.current) return;
      const rows: PosCustomer[] = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.data)
          ? response.data.data
          : [];
      setCustomers(rows);
    } catch (err: unknown) {
      if (seq !== requestSeqRef.current) return;
      const reqErr = err as {
        userMessage?: string;
        response?: { data?: { message?: string; error?: string } };
        message?: string;
      };
      setFetchError(
        reqErr.response?.data?.message ||
          reqErr.response?.data?.error ||
          reqErr.userMessage ||
          reqErr.message ||
          'Unable to load registered patients.'
      );
    } finally {
      if (seq === requestSeqRef.current) {
        setFetching(false);
      }
    }
  };

  useEffect(() => {
    if (!visible) {
      setMode('select');
      setSearchQuery('');
      setFormError(null);
      setDuplicateCustomer(null);
      return;
    }
    fetchPatients('');
  }, [visible]);

  useEffect(() => {
    if (!visible || mode !== 'select') return;
    const timer = setTimeout(() => {
      fetchPatients(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, visible, mode]);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    return customers.filter((c) => matchesPatientQuery(c, searchQuery));
  }, [customers, searchQuery]);

  const openRegisterForm = (prefillFromSearch = false) => {
    setFormError(null);
    setDuplicateCustomer(null);
    if (prefillFromSearch && searchQuery.trim()) {
      const trimmed = searchQuery.trim();
      const digitsOnly = trimmed.replace(/\D/g, '');
      if (digitsOnly.length >= 6 && /^[\d\s+\-()]+$/.test(trimmed)) {
        setPhone(trimmed);
        setFirstName('');
        setLastName('');
      } else {
        const parts = trimmed.split(/\s+/);
        setFirstName(parts[0] || '');
        setLastName(parts.slice(1).join(' '));
        setPhone('');
      }
    } else {
      setFirstName('');
      setLastName('');
      setPhone('');
    }
    setGender('');
    setDateOfBirth('');
    setAddress('');
    setMode('register');
  };

  const handleRegisterSubmit = async () => {
    if (submitting) return;
    setFormError(null);
    setDuplicateCustomer(null);

    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const cleanPhone = phone.trim();
    const cleanDob = dateOfBirth.trim();
    const cleanAddress = address.trim();

    if (!cleanFirst) {
      setFormError('First name is required.');
      return;
    }
    if (!cleanLast) {
      setFormError('Last name is required.');
      return;
    }
    if (cleanPhone && cleanPhone.replace(/\D/g, '').length < 6) {
      setFormError('Phone number must contain at least 6 digits.');
      return;
    }
    const dobError = validateDobInput(cleanDob);
    if (dobError) {
      setFormError(dobError);
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiClient.post<PosCustomer>('/api/customers', {
        firstName: cleanFirst,
        lastName: cleanLast,
        name: `${cleanFirst} ${cleanLast}`,
        phone: cleanPhone || undefined,
        gender: gender || undefined,
        dateOfBirth: cleanDob || undefined,
        address: cleanAddress || undefined,
      });

      const created = response.data;
      if (!created || !created.id) {
        setFormError('The server did not return the registered patient record.');
        return;
      }

      setCustomers((prev) => [created, ...prev.filter((item) => item.id !== created.id)]);
      onPatientRegistered(created);
      onClose();
    } catch (err: unknown) {
      const reqErr = err as {
        userMessage?: string;
        response?: {
          status?: number;
          data?: {
            message?: string;
            error?: string;
            existingCustomer?: PosCustomer;
          };
        };
        message?: string;
      };
      const existing = reqErr.response?.data?.existingCustomer || null;
      if (existing) {
        setDuplicateCustomer(existing);
      }
      setFormError(
        reqErr.response?.data?.message ||
          reqErr.response?.data?.error ||
          reqErr.userMessage ||
          reqErr.message ||
          'Failed to register patient. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isWalkInSelected = assignment.type === 'WALK_IN';
  const selectedPatientId =
    assignment.type === 'REGISTERED' ? assignment.customer.id : null;
  const currentSelectionLabel =
    assignment.type === 'REGISTERED'
      ? `${assignment.customer.name} (${formatPatientId(assignment.customer)})`
      : 'Walking Customer';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={styles.headerLeft}>
              {mode === 'register' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Back to customer list"
                  hitSlop={8}
                  style={[styles.iconCircleBtn, { backgroundColor: theme.surfaceMuted }]}
                  onPress={() => {
                    setFormError(null);
                    setDuplicateCustomer(null);
                    setMode('select');
                  }}
                >
                  <ArrowLeft size={18} color={theme.text} />
                </Pressable>
              ) : null}
              <View style={styles.headerTextWrap}>
                <Text style={[styles.title, { color: theme.navigation }]}>
                  {mode === 'register' ? 'Register New Patient' : 'Assign Patient / Customer'}
                </Text>
                <Text style={[styles.subtitle, { color: theme.mutedText }]} numberOfLines={1}>
                  Current: <Text style={{ color: theme.primary, fontWeight: '700' }}>{currentSelectionLabel}</Text>
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close customer modal"
              hitSlop={8}
              style={[styles.iconCircleBtn, { backgroundColor: theme.surfaceMuted }]}
              onPress={onClose}
            >
              <X size={18} color={theme.mutedText} />
            </Pressable>
          </View>

          {mode === 'select' ? (
            <View style={styles.selectBody}>
              {/* 1. Search field at the top */}
              <View style={styles.searchSection}>
                <SearchInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search by name, phone, or patient ID..."
                />
              </View>

              {/* 2. Quick options: Walking Customer + Register New Patient */}
              <View style={styles.quickOptionsSection}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Select Walking Customer"
                  onPress={() => {
                    onSelectWalkIn();
                    onClose();
                  }}
                  style={({ pressed }) => [
                    styles.walkInCard,
                    {
                      backgroundColor: isWalkInSelected ? theme.primarySoft : theme.surfaceMuted,
                      borderColor: isWalkInSelected ? theme.primary : theme.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.walkInIconWrap,
                      { backgroundColor: isWalkInSelected ? theme.primary : theme.surface },
                    ]}
                  >
                    <UserCheck size={18} color={isWalkInSelected ? '#ffffff' : theme.primary} />
                  </View>
                  <View style={styles.walkInCopy}>
                    <Text style={[styles.walkInTitle, { color: theme.text }]}>
                      Walking Customer
                    </Text>
                    <Text style={[styles.walkInSub, { color: theme.mutedText }]}>
                      Proceed without patient record or registration
                    </Text>
                  </View>
                  {isWalkInSelected ? (
                    <View style={[styles.selectedPill, { backgroundColor: theme.primary }]}>
                      <Check size={12} color="#ffffff" strokeWidth={3} />
                      <Text style={styles.selectedPillText}>Selected</Text>
                    </View>
                  ) : null}
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Register New Patient"
                  onPress={() => openRegisterForm(false)}
                  style={({ pressed }) => [
                    styles.registerCtaBtn,
                    { backgroundColor: theme.primary, opacity: pressed ? 0.88 : 1 },
                  ]}
                >
                  <UserPlus size={17} color="#ffffff" />
                  <Text style={styles.registerCtaText}>Register New Patient</Text>
                </Pressable>
              </View>

              {/* 3. Registered Patients Section */}
              <View style={styles.listHeaderRow}>
                <View style={styles.listHeaderTitleWrap}>
                  <Users size={14} color={theme.mutedText} />
                  <Text style={[styles.listHeaderLabel, { color: theme.mutedText }]}>
                    REGISTERED PATIENTS ({filteredCustomers.length})
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Refresh patient list"
                  hitSlop={8}
                  disabled={fetching}
                  onPress={() => fetchPatients(searchQuery)}
                  style={styles.refreshBtn}
                >
                  <RefreshCw size={14} color={theme.primary} />
                  <Text style={[styles.refreshText, { color: theme.primary }]}>Refresh</Text>
                </Pressable>
              </View>

              {fetchError ? (
                <View style={[styles.errorBanner, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                  <AlertCircle size={16} color="#dc2626" />
                  <Text style={styles.errorBannerText}>{fetchError}</Text>
                  <Pressable onPress={() => fetchPatients(searchQuery)}>
                    <Text style={styles.retryLink}>Retry</Text>
                  </Pressable>
                </View>
              ) : null}

              {fetching && filteredCustomers.length === 0 ? (
                <View style={styles.loadingState}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <Text style={[styles.loadingText, { color: theme.mutedText }]}>
                    Loading registered patients...
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={filteredCustomers}
                  keyExtractor={(item) => String(item.id)}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.listContent}
                  renderItem={({ item }) => {
                    const isSelected = selectedPatientId === item.id;
                    const patientIdLabel = formatPatientId(item);
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Select patient ${item.name}`}
                        style={({ pressed }) => [
                          styles.patientRow,
                          {
                            backgroundColor: isSelected ? theme.primarySoft : theme.surface,
                            borderColor: isSelected ? theme.primary : theme.borderLight,
                            opacity: pressed ? 0.85 : 1,
                          },
                        ]}
                        onPress={() => {
                          onSelectPatient(item);
                          onClose();
                        }}
                      >
                        <View
                          style={[
                            styles.avatar,
                            { backgroundColor: isSelected ? theme.primary : theme.primarySoft },
                          ]}
                        >
                          <Text
                            style={[
                              styles.avatarText,
                              { color: isSelected ? '#ffffff' : theme.primary },
                            ]}
                          >
                            {item.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.patientInfo}>
                          <Text style={[styles.patientName, { color: theme.text }]} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <View style={styles.patientMetaRow}>
                            <View style={[styles.patientIdChip, { backgroundColor: theme.surfaceMuted }]}>
                              <Text style={[styles.patientIdText, { color: theme.navigation }]}>
                                {patientIdLabel}
                              </Text>
                            </View>
                            {item.phone ? (
                              <View style={styles.phoneInline}>
                                <Phone size={11} color={theme.mutedText} />
                                <Text style={[styles.patientPhone, { color: theme.mutedText }]} numberOfLines={1}>
                                  {item.phone}
                                </Text>
                              </View>
                            ) : (
                              <Text style={[styles.patientPhone, { color: theme.mutedText }]}>
                                No phone
                              </Text>
                            )}
                          </View>
                        </View>
                        {isSelected ? (
                          <CheckCircle2 size={20} color={theme.primary} />
                        ) : null}
                      </Pressable>
                    );
                  }}
                  ListEmptyComponent={
                    <View style={[styles.emptyState, { borderColor: theme.border }]}>
                      <User size={28} color={theme.mutedText} />
                      <Text style={[styles.emptyTitle, { color: theme.text }]}>
                        {searchQuery.trim()
                          ? 'No matching patients found'
                          : 'No registered patients yet'}
                      </Text>
                      <Text style={[styles.emptyCopy, { color: theme.mutedText }]}>
                        {searchQuery.trim()
                          ? `No patient matched "${searchQuery.trim()}". You can register them now or checkout as a Walking Customer.`
                          : 'Register a patient to track their prescriptions and sales history, or select Walking Customer.'}
                      </Text>
                      <Pressable
                        style={[styles.emptyActionBtn, { backgroundColor: theme.primarySoft, borderColor: theme.primary }]}
                        onPress={() => openRegisterForm(Boolean(searchQuery.trim()))}
                      >
                        <UserPlus size={15} color={theme.primary} />
                        <Text style={[styles.emptyActionText, { color: theme.primary }]}>
                          {searchQuery.trim()
                            ? `Register "${searchQuery.trim()}"`
                            : 'Register First Patient'}
                        </Text>
                      </Pressable>
                    </View>
                  }
                />
              )}
            </View>
          ) : (
            <ScrollView
              style={styles.formScroll}
              contentContainerStyle={styles.formContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={[styles.autoIdBanner, { backgroundColor: theme.primarySoft, borderColor: theme.border }]}>
                <Text style={[styles.autoIdText, { color: theme.primary }]}>
                  Patient ID will be generated automatically upon registration (e.g. MQP-000123). Your current cart items will be preserved.
                </Text>
              </View>

              {formError ? (
                <View style={[styles.errorBanner, { backgroundColor: '#fef2f2', borderColor: '#fecaca', flexDirection: 'column', alignItems: 'flex-start' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <AlertCircle size={16} color="#dc2626" />
                    <Text style={styles.errorBannerText}>{formError}</Text>
                  </View>
                  {duplicateCustomer ? (
                    <Pressable
                      style={[styles.useExistingBtn, { backgroundColor: theme.primary }]}
                      onPress={() => {
                        onSelectPatient(duplicateCustomer);
                        onClose();
                      }}
                    >
                      <Check size={14} color="#ffffff" />
                      <Text style={styles.useExistingBtnText}>
                        Select Existing: {duplicateCustomer.name} ({formatPatientId(duplicateCustomer)})
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.twoColRow}>
                <View style={styles.halfField}>
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>
                    First Name <Text style={styles.requiredMark}>*</Text>
                  </Text>
                  <TextInput
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="e.g. Chanda"
                    placeholderTextColor={theme.mutedText}
                    autoCapitalize="words"
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.surfaceMuted,
                        borderColor: theme.border,
                        color: theme.text,
                      },
                    ]}
                  />
                </View>
                <View style={styles.halfField}>
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>
                    Last Name <Text style={styles.requiredMark}>*</Text>
                  </Text>
                  <TextInput
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="e.g. Banda"
                    placeholderTextColor={theme.mutedText}
                    autoCapitalize="words"
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.surfaceMuted,
                        borderColor: theme.border,
                        color: theme.text,
                      },
                    ]}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Phone Number</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="e.g. 0971234567"
                  placeholderTextColor={theme.mutedText}
                  keyboardType="phone-pad"
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surfaceMuted,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Gender</Text>
                <View style={styles.genderRow}>
                  {GENDER_OPTIONS.map((option) => {
                    const active = gender === option;
                    return (
                      <Pressable
                        key={option}
                        accessibilityRole="button"
                        onPress={() => setGender(active ? '' : option)}
                        style={[
                          styles.genderPill,
                          {
                            backgroundColor: active ? theme.primary : theme.surfaceMuted,
                            borderColor: active ? theme.primary : theme.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.genderPillText,
                            { color: active ? '#ffffff' : theme.textSecondary },
                          ]}
                        >
                          {option}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Date of Birth</Text>
                <TextInput
                  value={dateOfBirth}
                  onChangeText={setDateOfBirth}
                  placeholder="YYYY-MM-DD (e.g. 1992-05-14)"
                  placeholderTextColor={theme.mutedText}
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surfaceMuted,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Address</Text>
                <TextInput
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Street, area, or town (optional)"
                  placeholderTextColor={theme.mutedText}
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surfaceMuted,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                />
              </View>

              <View style={styles.formActions}>
                <Button
                  title={submitting ? 'Registering Patient...' : 'Register & Assign to Sale'}
                  onPress={handleRegisterSubmit}
                  loading={submitting}
                  variant="primary"
                  size="lg"
                  fullWidth
                />
              </View>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 49, 86, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: layout.radius.xxl,
    borderTopRightRadius: layout.radius.xxl,
    height: '86%',
    paddingHorizontal: layout.spacing.lg,
    paddingTop: layout.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: layout.spacing.sm,
    borderBottomWidth: 1,
    gap: 10,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  iconCircleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectBody: {
    flex: 1,
  },
  searchSection: {
    paddingTop: 12,
    paddingBottom: 10,
  },
  quickOptionsSection: {
    gap: 8,
    marginBottom: 12,
  },
  walkInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: layout.radius.md,
    borderWidth: 1.5,
    gap: 10,
  },
  walkInIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walkInCopy: {
    flex: 1,
  },
  walkInTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  walkInSub: {
    fontSize: 11.5,
    marginTop: 1,
  },
  selectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: layout.radius.full,
  },
  selectedPillText: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '800',
  },
  registerCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    borderRadius: layout.radius.md,
    paddingHorizontal: 14,
  },
  registerCtaText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  listHeaderTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  listHeaderLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  refreshText: {
    fontSize: 12,
    fontWeight: '700',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: layout.radius.sm,
    borderWidth: 1,
    marginBottom: 10,
  },
  errorBannerText: {
    flex: 1,
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  retryLink: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '800',
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 28,
  },
  loadingText: {
    fontSize: 13,
  },
  listContent: {
    paddingBottom: 20,
    gap: 8,
  },
  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 11,
    borderRadius: layout.radius.md,
    borderWidth: 1.2,
    gap: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: 14,
    fontWeight: '800',
  },
  patientMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 3,
  },
  patientIdChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  patientIdText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  phoneInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  patientPhone: {
    fontSize: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: layout.radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 6,
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
  },
  emptyCopy: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: layout.radius.sm,
    borderWidth: 1,
    marginTop: 8,
  },
  emptyActionText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  formScroll: {
    flex: 1,
  },
  formContent: {
    paddingTop: 12,
    paddingBottom: 28,
    gap: 12,
  },
  autoIdBanner: {
    padding: 10,
    borderRadius: layout.radius.sm,
    borderWidth: 1,
  },
  autoIdText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  useExistingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: layout.radius.sm,
    marginTop: 6,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  useExistingBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
  },
  halfField: {
    flex: 1,
    gap: 5,
  },
  fieldGroup: {
    gap: 5,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  requiredMark: {
    color: '#dc2626',
  },
  input: {
    minHeight: 44,
    borderRadius: layout.radius.sm,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  genderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genderPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: layout.radius.full,
    borderWidth: 1,
  },
  genderPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  formActions: {
    marginTop: 8,
  },
});
