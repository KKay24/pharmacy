import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Package,
  Search,
  Check,
  AlertCircle,
  XCircle,
  Truck,
  MapPin,
  ShoppingBag,
} from 'lucide-react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '../constants/theme';
import apiClient from '../api/client';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';

const STATUS_STEPS = [
  'Order Placed',
  'Confirmed',
  'Preparing',
  'Ready',
  'Out for Delivery',
  'Delivered',
];

function getStatusStepIndex(status: string) {
  const normalized = (status || '').toLowerCase().trim();
  const idx = STATUS_STEPS.findIndex((s) => s.toLowerCase() === normalized);
  return idx === -1 ? 0 : idx;
}

export default function TrackOrderScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ orderNumber?: string }>();

  const [orderNumber, setOrderNumber] = useState(params.orderNumber || '');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderData, setOrderData] = useState<any | null>(null);

  const handleTrack = async () => {
    if (!orderNumber.trim()) {
      setError('Please provide your order number (e.g. ORD-123456).');
      return;
    }
    if (!phone.trim()) {
      setError('Please provide your associated mobile contact number.');
      return;
    }

    setLoading(true);
    setError(null);
    setOrderData(null);

    try {
      const q = new URLSearchParams({
        orderNumber: orderNumber.trim(),
        phone: phone.trim(),
      }).toString();

      const res = await apiClient.get(`/api/orders?${q}`);
      const body = res.data;
      const orders = body.data || body.orders || (Array.isArray(body) ? body : []);
      if (orders.length === 0) {
        setError('No order found matching this order number and phone combination.');
      } else {
        setOrderData(orders[0]);
      }
    } catch (e: any) {
      setError(e.response?.data?.error || e.message || 'Unable to connect to pharmacy fulfillment server.');
    } finally {
      setLoading(false);
    }
  };

  const currentStep = orderData ? getStatusStepIndex(orderData.orderStatus) : -1;
  const isCancelled = orderData?.orderStatus === 'Cancelled';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header Banner */}
          <View style={styles.headerSection}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primary + '15' }]}>
              <Package size={36} color={colors.primary} />
            </View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Track Customer Order</Text>
            <Text style={[styles.headerSub, { color: colors.textMuted }]}>
              Monitor real-time fulfillment and dispatch status directly from the pharmacy.
            </Text>
          </View>

          {/* Search Card */}
          <Card style={styles.searchCard}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Order Number *</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceMuted,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="e.g. ORD-172948-9382"
              placeholderTextColor={colors.textMuted}
              value={orderNumber}
              onChangeText={setOrderNumber}
              autoCapitalize="characters"
            />

            <Text style={[styles.fieldLabel, { color: colors.text, marginTop: 12 }]}>
              Phone Number *
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceMuted,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="e.g. +260 97 1234567"
              placeholderTextColor={colors.textMuted}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            {error && (
              <View style={[styles.errorBanner, { backgroundColor: colors.danger + '15', borderColor: colors.danger + '30' }]}>
                <AlertCircle size={18} color={colors.danger} />
                <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
              </View>
            )}

            <Button
              title="Track Order Status"
              variant="primary"
              size="lg"
              leftIcon={<Search size={18} color="#ffffff" />}
              onPress={handleTrack}
              loading={loading}
              style={{ marginTop: 16 }}
            />
          </Card>

          {/* Order Result Card */}
          {orderData && (
            <Card style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <View>
                  <Text style={[styles.refLabel, { color: colors.textMuted }]}>Order Number</Text>
                  <Text style={[styles.refNumber, { color: colors.primary }]}>
                    {orderData.orderNumber}
                  </Text>
                  <Text style={[styles.dateText, { color: colors.textMuted }]}>
                    Placed: {new Date(orderData.date || orderData.createdAt).toLocaleDateString()}
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.refLabel, { color: colors.textMuted }]}>Total Bill</Text>
                  <Text style={[styles.totalAmount, { color: colors.text }]}>
                    ZMW {Number(orderData.totalAmount || 0).toFixed(2)}
                  </Text>
                  <Badge
                    label={orderData.orderStatus || 'Processing'}
                    variant={
                      isCancelled
                        ? 'danger'
                        : orderData.orderStatus === 'Delivered'
                        ? 'success'
                        : 'warning'
                    }
                    size="sm"
                  />
                </View>
              </View>

              {/* Progress Timeline */}
              {!isCancelled ? (
                <View style={styles.timelineSection}>
                  <Text style={[styles.timelineHeader, { color: colors.text }]}>
                    Fulfillment Progress
                  </Text>
                  <View style={styles.stepList}>
                    {STATUS_STEPS.map((step, idx) => {
                      const isCompleted = idx < currentStep;
                      const isCurrent = idx === currentStep;
                      return (
                        <View key={step} style={styles.stepItem}>
                          <View style={styles.stepIndicatorCol}>
                            <View
                              style={[
                                styles.stepCircle,
                                {
                                  borderColor: isCompleted || isCurrent ? colors.primary : colors.border,
                                  backgroundColor: isCompleted
                                    ? colors.primary
                                    : isCurrent
                                    ? colors.primary + '20'
                                    : colors.surfaceMuted,
                                },
                              ]}
                            >
                              {isCompleted ? (
                                <Check size={14} color="#ffffff" />
                              ) : isCurrent ? (
                                <View style={[styles.innerPulse, { backgroundColor: colors.primary }]} />
                              ) : null}
                            </View>
                            {idx < STATUS_STEPS.length - 1 && (
                              <View
                                style={[
                                  styles.stepLine,
                                  {
                                    backgroundColor: isCompleted ? colors.primary : colors.border,
                                  },
                                ]}
                              />
                            )}
                          </View>

                          <View style={styles.stepTextContainer}>
                            <Text
                              style={[
                                styles.stepLabel,
                                {
                                  color: isCompleted || isCurrent ? colors.text : colors.textMuted,
                                  fontWeight: isCurrent ? '800' : '600',
                                },
                              ]}
                            >
                              {step}
                            </Text>
                            {isCurrent && (
                              <Text style={[styles.currentStepHint, { color: colors.primary }]}>
                                Current stage
                              </Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : (
                <View style={[styles.cancelledAlert, { backgroundColor: colors.danger + '15' }]}>
                  <XCircle size={24} color={colors.danger} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cancelledTitle, { color: colors.danger }]}>
                      This order was cancelled
                    </Text>
                    {orderData.cancellationReason && (
                      <Text style={[styles.cancelledReason, { color: colors.text }]}>
                        Reason: {orderData.cancellationReason}
                      </Text>
                    )}
                  </View>
                </View>
              )}

              {/* Order Metadata */}
              <View style={[styles.metaSummary, { borderTopColor: colors.border }]}>
                {orderData.deliveryMethod && (
                  <View style={styles.metaRow}>
                    <Truck size={16} color={colors.textMuted} />
                    <Text style={[styles.metaText, { color: colors.text }]}>
                      Fulfilment: <Text style={{ fontWeight: '700' }}>{orderData.deliveryMethod}</Text>
                    </Text>
                  </View>
                )}
                {orderData.deliveryAddress && (
                  <View style={styles.metaRow}>
                    <MapPin size={16} color={colors.textMuted} />
                    <Text style={[styles.metaText, { color: colors.text }]}>
                      Destination: {orderData.deliveryAddress}
                    </Text>
                  </View>
                )}
                {orderData.itemCount && (
                  <View style={styles.metaRow}>
                    <ShoppingBag size={16} color={colors.textMuted} />
                    <Text style={[styles.metaText, { color: colors.text }]}>
                      {orderData.itemCount} items ordered
                    </Text>
                  </View>
                )}
              </View>
            </Card>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  headerSection: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  searchCard: {
    padding: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
  },
  errorText: {
    fontSize: 12,
    flex: 1,
  },
  resultCard: {
    padding: 16,
    gap: 16,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  refLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  refNumber: {
    fontSize: 18,
    fontWeight: '800',
    marginVertical: 2,
  },
  dateText: {
    fontSize: 12,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '800',
    marginVertical: 2,
  },
  timelineSection: {
    paddingTop: 8,
  },
  timelineHeader: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 12,
  },
  stepList: {
    paddingLeft: 6,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepIndicatorCol: {
    alignItems: 'center',
    width: 24,
  },
  stepCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepLine: {
    width: 2,
    height: 28,
  },
  stepTextContainer: {
    paddingTop: 2,
    paddingBottom: 16,
  },
  stepLabel: {
    fontSize: 13,
  },
  currentStepHint: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  cancelledAlert: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
  },
  cancelledTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  cancelledReason: {
    fontSize: 12,
    marginTop: 2,
  },
  metaSummary: {
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 13,
  },
});
