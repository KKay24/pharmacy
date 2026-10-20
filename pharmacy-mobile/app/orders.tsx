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
  ClipboardList,
  Search,
  Package,
  Phone,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  DollarSign,
  ChevronRight,
  X,
  AlertCircle,
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

const ORDER_STATUSES = [
  'All',
  'Order Placed',
  'Confirmed',
  'Preparing',
  'Ready',
  'Out for Delivery',
  'Delivered',
  'Cancelled',
] as const;

export default function OrdersScreen() {
  const { user, logout } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Cancel order modal
  const [cancellingOrder, setCancellingOrder] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [submittingCancel, setSubmittingCancel] = useState(false);

  // Selected order details modal
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const loadOrders = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setError(null);
    try {
      const response = await apiClient.get('/api/orders?limit=100');
      const data = response.data?.data || (Array.isArray(response.data) ? response.data : []);
      setOrders(data);
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 401) {
        setError('Your session has expired. Please sign in again.');
        await logout().catch(() => {});
      } else {
        const errorMsg = err.response?.data?.error || err.response?.data?.message || 'Failed to load orders.';
        setError(errorMsg);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, logout]);

  useEffect(() => {
    if (user) {
      loadOrders();
    } else {
      setLoading(false);
    }
  }, [user, loadOrders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (statusFilter !== 'All' && order.orderStatus !== statusFilter) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matches =
          order.orderNumber?.toLowerCase().includes(q) ||
          order.customerName?.toLowerCase().includes(q) ||
          order.customerPhone?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [orders, statusFilter, search]);

  const updateOrderStatus = async (orderId: number, nextStatus: string, reason = '') => {
    setUpdatingStatus(true);
    try {
      await apiClient.put(`/api/orders/${orderId}/status`, {
        status: nextStatus,
        ...(nextStatus === 'Cancelled' ? { reason } : {}),
      });
      Alert.alert('Status Updated', `Order marked as "${nextStatus}".`);
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev: any) => ({ ...prev, orderStatus: nextStatus }));
      }
      loadOrders();
    } catch (err: unknown) {
      const reqErr = err as { response?: { data?: { error?: string; message?: string } } };
      Alert.alert('Error', reqErr.response?.data?.error || 'Failed to update order status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancellingOrder) return;
    setSubmittingCancel(true);
    try {
      await apiClient.put(`/api/orders/${cancellingOrder.id}/status`, {
        status: 'Cancelled',
        reason: cancelReason.trim() || 'Cancelled by staff',
      });
      Alert.alert('Order Cancelled', `Order ${cancellingOrder.orderNumber} has been cancelled.`);
      setCancellingOrder(null);
      setCancelReason('');
      if (selectedOrder?.id === cancellingOrder.id) {
        setSelectedOrder(null);
      }
      loadOrders();
    } catch (err: unknown) {
      const reqErr = err as { response?: { data?: { error?: string; message?: string } } };
      Alert.alert('Error', reqErr.response?.data?.error || 'Failed to cancel order.');
    } finally {
      setSubmittingCancel(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Delivered':
        return 'success';
      case 'Order Placed':
        return 'warning';
      case 'Confirmed':
      case 'Preparing':
        return 'info';
      case 'Ready':
      case 'Out for Delivery':
        return 'primary';
      case 'Cancelled':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  const getNextStatusAction = (currentStatus: string): { label: string; next: string } | null => {
    switch (currentStatus) {
      case 'Order Placed':
        return { label: 'Confirm Order', next: 'Confirmed' };
      case 'Confirmed':
        return { label: 'Start Preparing', next: 'Preparing' };
      case 'Preparing':
        return { label: 'Mark Ready', next: 'Ready' };
      case 'Ready':
        return { label: 'Out for Delivery', next: 'Out for Delivery' };
      case 'Out for Delivery':
        return { label: 'Mark Delivered', next: 'Delivered' };
      default:
        return null;
    }
  };

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <View style={styles.topRow}>
            <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
              <ArrowLeft size={22} color={theme.text} />
            </Pressable>
            <View style={styles.headerTitleWrap}>
              <Text style={[styles.headerTitle, { color: theme.navigation }]}>
                Orders Management
              </Text>
              <Text style={[styles.headerSubtitle, { color: theme.mutedText }]}>
                Fulfillment queue & customer orders
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.accessDeniedContent}>
          <View style={[styles.deniedIcon, { backgroundColor: theme.surfaceMuted }]}>
            <ShieldCheck size={52} color={theme.primary} />
          </View>
          <Text style={[styles.deniedTitle, { color: theme.text }]}>
            Authentication Required
          </Text>
          <Text style={[styles.deniedSubtitle, { color: theme.mutedText }]}>
            Sign in with your pharmacy staff or customer account to view and manage order fulfillment, or track a specific order with your order number.
          </Text>

          <View style={styles.deniedActions}>
            <Button
              title="Sign In to Your Account"
              onPress={() => router.push('/(auth)/login')}
              style={{ width: '100%', marginBottom: 12 }}
            />
            <Button
              title="Track a Specific Order"
              variant="outline"
              onPress={() => router.push('/track-order')}
              style={{ width: '100%' }}
            />
          </View>
        </View>
      </View>
    );
  }

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
              Online Orders
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.mutedText }]}>
              {orders.length} total orders recorded
            </Text>
          </View>
        </View>

        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by order #, customer, phone..."
          style={{ marginTop: 8 }}
        />

        {/* Status Filter Scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statusScroll}
        >
          {ORDER_STATUSES.map((status) => {
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

      {error ? (
        <View style={[styles.errorBanner, { backgroundColor: theme.danger + '15', borderColor: theme.danger + '40' }]}>
          <AlertCircle size={18} color={theme.danger} />
          <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
          <Pressable onPress={() => loadOrders()} style={styles.retryBtn}>
            <Text style={{ color: theme.primary, fontWeight: '700' }}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Orders List */}
      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadOrders();
            }}
            tintColor={theme.primary}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon={<ClipboardList size={32} color={theme.mutedText} />}
              title={error ? 'Unable to display orders' : 'No orders found'}
              description={
                error
                  ? error
                  : statusFilter !== 'All'
                  ? `No orders matching status "${statusFilter}".`
                  : 'There are no active orders to display.'
              }
              actionLabel={error ? 'Sign In Again' : undefined}
              onAction={error ? () => router.push('/(auth)/login') : undefined}
            />
          ) : null
        }
        renderItem={({ item }) => {
          const action = getNextStatusAction(item.orderStatus);
          const totalAmount = Number(item.totalAmount || 0);

          return (
            <Pressable
              accessibilityRole="button"
              style={[styles.orderCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => setSelectedOrder(item)}
            >
              <View style={styles.cardTopRow}>
                <View>
                  <Text style={[styles.orderNumber, { color: theme.navigation }]}>
                    {item.orderNumber}
                  </Text>
                  <Text style={[styles.orderDate, { color: theme.mutedText }]}>
                    {item.date || item.createdAt
                      ? new Date(item.date || item.createdAt).toLocaleString()
                      : 'N/A'}
                  </Text>
                </View>
                <Badge
                  label={item.orderStatus}
                  variant={getStatusBadgeVariant(item.orderStatus)}
                  size="md"
                />
              </View>

              <View style={[styles.customerInfoBlock, { backgroundColor: theme.surfaceMuted }]}>
                <Text style={[styles.customerName, { color: theme.text }]}>
                  {item.customerName || 'Customer'}
                </Text>
                {item.customerPhone ? (
                  <View style={styles.detailRow}>
                    <Phone size={13} color={theme.mutedText} />
                    <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                      {item.customerPhone}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.detailRow}>
                  <Truck size={13} color={theme.mutedText} />
                  <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                    {item.deliveryMethod === 'delivery'
                      ? `Delivery (${item.deliveryAddress || 'Address on file'})`
                      : 'Store Pickup'}
                  </Text>
                </View>
              </View>

              <View style={styles.cardBottomRow}>
                <Text style={[styles.orderTotal, { color: theme.primary }]}>
                  Total: K {totalAmount.toFixed(2)}
                </Text>
                <View style={styles.actionsCluster}>
                  {action ? (
                    <Button
                      title={action.label}
                      onPress={() => updateOrderStatus(item.id, action.next)}
                      variant="primary"
                      size="sm"
                    />
                  ) : null}
                  {item.orderStatus !== 'Cancelled' && item.orderStatus !== 'Delivered' ? (
                    <Pressable
                      style={[styles.cancelBtn, { borderColor: theme.danger }]}
                      onPress={() => {
                        setCancellingOrder(item);
                        setCancelReason('');
                      }}
                    >
                      <Text style={[styles.cancelBtnText, { color: theme.danger }]}>Cancel</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        }}

      />

      {/* Order Details Modal */}
      <Modal visible={!!selectedOrder} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <View>
                <Text style={[styles.modalTitle, { color: theme.navigation }]}>
                  {selectedOrder?.orderNumber}
                </Text>
                <Text style={[styles.modalSub, { color: theme.mutedText }]}>
                  Customer Online Order Details
                </Text>
              </View>
              <Pressable hitSlop={8} onPress={() => setSelectedOrder(null)}>
                <X size={22} color={theme.mutedText} />
              </Pressable>
            </View>

            <ScrollView style={{ marginTop: 12 }}>
              {selectedOrder ? (
                <>
                  <View style={styles.detailSection}>
                    <Text style={[styles.detailSectionHeading, { color: theme.mutedText }]}>
                      CUSTOMER & FULFILLMENT
                    </Text>
                    <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>
                      Customer Name:{' '}
                      <Text style={{ fontWeight: '700', color: theme.text }}>
                        {selectedOrder.customerName}
                      </Text>
                    </Text>
                    <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>
                      Phone:{' '}
                      <Text style={{ fontWeight: '700', color: theme.text }}>
                        {selectedOrder.customerPhone || 'N/A'}
                      </Text>
                    </Text>
                    <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>
                      Method:{' '}
                      <Text style={{ fontWeight: '700', color: theme.text }}>
                        {selectedOrder.deliveryMethod === 'delivery' ? 'Home Delivery' : 'Pick Up'}
                      </Text>
                    </Text>
                    {selectedOrder.deliveryAddress ? (
                      <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>
                        Address:{' '}
                        <Text style={{ fontWeight: '700', color: theme.text }}>
                          {selectedOrder.deliveryAddress}
                        </Text>
                      </Text>
                    ) : null}
                    {selectedOrder.notes ? (
                      <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>
                        Notes:{' '}
                        <Text style={{ fontStyle: 'italic', color: theme.text }}>
                          {selectedOrder.notes}
                        </Text>
                      </Text>
                    ) : null}
                  </View>

                  <View style={[styles.detailSection, { marginTop: 14 }]}>
                    <Text style={[styles.detailSectionHeading, { color: theme.mutedText }]}>
                      ORDER ITEMS
                    </Text>
                    {(selectedOrder.items || selectedOrder.OrderItems || []).map(
                      (item: any, idx: number) => (
                        <View
                          key={idx}
                          style={[styles.itemLine, { borderBottomColor: theme.borderLight }]}
                        >
                          <Text style={[styles.itemLineName, { color: theme.text }]}>
                            {item.name || item.Medicine?.name || 'Item'} × {item.quantity}
                          </Text>
                          <Text style={[styles.itemLinePrice, { color: theme.text }]}>
                            K {Number(item.price || item.totalPrice || 0).toFixed(2)}
                          </Text>
                        </View>
                      )
                    )}
                    <View style={styles.summaryTotalRow}>
                      <Text style={[styles.totalLabel, { color: theme.text }]}>Total Amount:</Text>
                      <Text style={[styles.totalAmount, { color: theme.primary }]}>
                        K {Number(selectedOrder.totalAmount || 0).toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  {/* Status Pipeline Buttons */}
                  <View style={{ marginTop: 20 }}>
                    <Text style={[styles.detailSectionHeading, { color: theme.mutedText, marginBottom: 8 }]}>
                      UPDATE STATUS
                    </Text>
                    <View style={styles.statusButtonsGrid}>
                      {[
                        'Confirmed',
                        'Preparing',
                        'Ready',
                        'Out for Delivery',
                        'Delivered',
                      ].map((st) => (
                        <Button
                          key={st}
                          title={st}
                          onPress={() => updateOrderStatus(selectedOrder.id, st)}
                          variant={selectedOrder.orderStatus === st ? 'primary' : 'outline'}
                          size="sm"
                          style={{ marginBottom: 6 }}
                        />
                      ))}
                    </View>
                  </View>
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Cancel Reason Modal */}
      <Modal visible={!!cancellingOrder} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalDialog, { backgroundColor: theme.surface }]}>
            <Text style={[styles.dialogTitle, { color: theme.danger }]}>Cancel Order</Text>
            <Text style={[styles.dialogSubtitle, { color: theme.mutedText }]}>
              Enter a cancellation reason for order {cancellingOrder?.orderNumber}:
            </Text>
            <TextInput
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="e.g. Out of stock, customer requested"
              placeholderTextColor={theme.mutedText}
              style={[
                styles.dialogInput,
                { backgroundColor: theme.surfaceMuted, borderColor: theme.border, color: theme.text },
              ]}
            />
            <View style={styles.dialogActions}>
              <Button
                title="Keep Order"
                onPress={() => setCancellingOrder(null)}
                variant="ghost"
                size="md"
              />
              <Button
                title={submittingCancel ? 'Cancelling...' : 'Confirm Cancel'}
                onPress={handleConfirmCancel}
                loading={submittingCancel}
                variant="danger"
                size="md"
              />
            </View>
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
  orderCard: {
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
    marginBottom: layout.spacing.sm,
  },
  orderNumber: { fontSize: 16, fontWeight: '800' },
  orderDate: { fontSize: 11, marginTop: 2 },
  customerInfoBlock: {
    padding: 10,
    borderRadius: layout.radius.md,
    marginVertical: 8,
    gap: 4,
  },
  customerName: { fontSize: 14, fontWeight: '700' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 12 },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  orderTotal: { fontSize: 16, fontWeight: '800' },
  actionsCluster: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  cancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: layout.radius.sm,
    borderWidth: 1,
  },
  cancelBtnText: { fontSize: 12, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 49, 86, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: layout.radius.xxl,
    borderTopRightRadius: layout.radius.xxl,
    padding: layout.spacing.xl,
    height: '80%',
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
  detailSection: {
    padding: 12,
    borderRadius: layout.radius.md,
    backgroundColor: 'transparent',
  },
  detailSectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  detailLabel: { fontSize: 13, marginVertical: 2 },
  itemLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  itemLineName: { fontSize: 13, fontWeight: '600' },
  itemLinePrice: { fontSize: 13, fontWeight: '700' },
  summaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
  },
  totalLabel: { fontSize: 15, fontWeight: '800' },
  totalAmount: { fontSize: 18, fontWeight: '900' },
  statusButtonsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modalDialog: {
    margin: 20,
    borderRadius: layout.radius.xl,
    padding: layout.spacing.xl,
    alignSelf: 'center',
    width: '90%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  dialogTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  dialogSubtitle: { fontSize: 13, marginBottom: 14, lineHeight: 18 },
  dialogInput: {
    borderWidth: 1,
    borderRadius: layout.radius.md,
    padding: 12,
    fontSize: 14,
    marginBottom: 16,
  },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  accessDeniedContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  deniedIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  deniedTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  deniedSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
  },
  deniedActions: {
    width: '100%',
    maxWidth: 320,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: layout.radius.md,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  retryBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
