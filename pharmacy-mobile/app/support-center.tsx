import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  Linking,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Text, View } from '@/components/Themed';
import apiClient from '@/api/client';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Headset,
  Search,
  Phone,
  Mail,
  Clock,
  CheckCircle2,
  MessageSquare,
  ChevronRight,
  ExternalLink,
} from 'lucide-react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { layout } from '@/constants/theme';
import { SearchInput } from '@/components/ui/SearchInput';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

const INQUIRY_STATUSES = ['All', 'New', 'Contacted', 'Resolved'] as const;

export default function SupportCenterScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  const loadInquiries = useCallback(async () => {
    try {
      const response = await apiClient.get('/api/support/inquiries?limit=100');
      const data = response.data?.data || (Array.isArray(response.data) ? response.data : []);
      setInquiries(data);
    } catch (err) {
      console.error('Failed to load support inquiries', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadInquiries();
  }, [loadInquiries]);

  const filteredInquiries = useMemo(() => {
    return inquiries.filter((inquiry) => {
      if (statusFilter !== 'All' && inquiry.status !== statusFilter) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matches =
          inquiry.name?.toLowerCase().includes(q) ||
          inquiry.phone?.toLowerCase().includes(q) ||
          inquiry.email?.toLowerCase().includes(q) ||
          inquiry.message?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [inquiries, statusFilter, search]);

  const updateStatus = async (inquiryId: number, nextStatus: string) => {
    try {
      await apiClient.put(`/api/support/inquiries/${inquiryId}/status`, {
        status: nextStatus,
      });
      Alert.alert('Status Updated', `Inquiry marked as "${nextStatus}".`);
      loadInquiries();
    } catch (err: unknown) {
      const reqErr = err as { response?: { data?: { error?: string } } };
      Alert.alert('Error', reqErr.response?.data?.error || 'Failed to update inquiry.');
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

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'New':
        return 'danger';
      case 'Contacted':
        return 'warning';
      case 'Resolved':
        return 'success';
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
              Support Center
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.mutedText }]}>
              Customer inquiries & message follow-ups
            </Text>
          </View>
        </View>

        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, phone, email, message..."
          style={{ marginTop: 8 }}
        />

        {/* Status Filter Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statusScroll}
        >
          {INQUIRY_STATUSES.map((status) => {
            const active = statusFilter === status;
            return (
              <Pressable
                key={status}
                accessibilityRole="button"
                onPress={() => setStatusFilter(status)}
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

      {/* Inquiry Cards List */}
      <FlatList
        data={filteredInquiries}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadInquiries();
            }}
            tintColor={theme.primary}
          />
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.cardTopRow}>
              <View>
                <Text style={[styles.customerName, { color: theme.text }]}>{item.name}</Text>
                <Text style={[styles.inquiryDate, { color: theme.mutedText }]}>
                  {item.createdAt ? new Date(item.createdAt).toLocaleString() : 'N/A'}
                </Text>
              </View>
              <Badge
                label={item.status}
                variant={getStatusBadgeVariant(item.status)}
                size="md"
              />
            </View>

            {item.inquiryType ? (
              <View style={styles.typeRow}>
                <Badge label={item.inquiryType} variant="info" size="sm" />
              </View>
            ) : null}

            {/* Message Body */}
            <View style={[styles.messageBox, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderLight }]}>
              <Text style={[styles.messageText, { color: theme.text }]}>
                "{item.message}"
              </Text>
            </View>

            {/* Contact Details & Direct Actions */}
            <View style={styles.contactRow}>
              {item.phone ? (
                <Pressable
                  style={[styles.contactButton, { backgroundColor: theme.primarySoft }]}
                  onPress={() => handleCall(item.phone)}
                >
                  <Phone size={14} color={theme.primary} />
                  <Text style={[styles.contactButtonText, { color: theme.primary }]}>
                    Call {item.phone}
                  </Text>
                </Pressable>
              ) : null}

              {item.email ? (
                <Pressable
                  style={[styles.contactButton, { backgroundColor: theme.surfaceMuted }]}
                  onPress={() => handleEmail(item.email)}
                >
                  <Mail size={14} color={theme.textSecondary} />
                  <Text style={[styles.contactButtonText, { color: theme.textSecondary }]}>
                    Email
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {/* Status Update Pipeline */}
            <View style={[styles.statusUpdateRow, { borderTopColor: theme.borderLight }]}>
              <Text style={[styles.updateLabel, { color: theme.mutedText }]}>Update Status:</Text>
              <View style={styles.statusButtonsWrap}>
                {item.status !== 'Contacted' ? (
                  <Button
                    title="Mark Contacted"
                    onPress={() => updateStatus(item.id, 'Contacted')}
                    variant="outline"
                    size="sm"
                  />
                ) : null}
                {item.status !== 'Resolved' ? (
                  <Button
                    title="Mark Resolved"
                    onPress={() => updateStatus(item.id, 'Resolved')}
                    variant="primary"
                    size="sm"
                  />
                ) : (
                  <Button
                    title="Re-open"
                    onPress={() => updateStatus(item.id, 'New')}
                    variant="ghost"
                    size="sm"
                  />
                )}
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon={<Headset size={32} color={theme.mutedText} />}
              title="No customer inquiries"
              description="Inquiries submitted via the store contact form will appear here."
            />
          ) : null
        }
      />
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
  customerName: { fontSize: 16, fontWeight: '800' },
  inquiryDate: { fontSize: 11, marginTop: 2 },
  typeRow: { marginVertical: 4 },
  messageBox: {
    padding: 10,
    borderRadius: layout.radius.sm,
    borderWidth: 1,
    marginVertical: 8,
  },
  messageText: { fontSize: 13, lineHeight: 18 },
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 6,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: layout.radius.sm,
  },
  contactButtonText: { fontSize: 12, fontWeight: '700' },
  statusUpdateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    marginTop: 6,
  },
  updateLabel: { fontSize: 11, fontWeight: '700' },
  statusButtonsWrap: { flexDirection: 'row', gap: 6 },
});
