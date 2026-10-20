import React, { useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  Pressable,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Text, View } from '@/components/Themed';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Tag,
  Truck,
  Building,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react-native';
import apiClient from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';

export default function CartTabScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { cart, updateQuantity, clearCart, cartTotal } = useCart();

  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<'delivery' | 'pickup'>('delivery');
  const [customerName, setCustomerName] = useState(user?.username || '');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [placingOrder, setPlacingOrder] = useState(false);

  const deliveryFee = deliveryMethod === 'delivery' ? 25.0 : 0;
  const discountAmount = promoApplied ? cartTotal * 0.1 : 0;
  const grandTotal = Math.max(0, cartTotal - discountAmount + deliveryFee);

  const handleApplyPromo = () => {
    if (promoCode.trim().toUpperCase() === 'WELCOME10') {
      setPromoApplied(true);
      Alert.alert('Promo Applied!', 'You received 10% off your order with code WELCOME10.');
    } else {
      Alert.alert('Invalid Code', 'Please enter a valid promotional code such as WELCOME10.');
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Please add products from the catalogue before placing an order.');
      return;
    }
    if (!customerName.trim() || !customerPhone.trim()) {
      Alert.alert('Contact Details Required', 'Please enter your full name and phone number for pharmacy confirmation.');
      return;
    }
    if (deliveryMethod === 'delivery' && !deliveryAddress.trim()) {
      Alert.alert('Delivery Address Required', 'Please enter a delivery address for your order.');
      return;
    }

    setPlacingOrder(true);
    try {
      const orderPayload = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryMethod,
        deliveryAddress: deliveryMethod === 'delivery' ? deliveryAddress.trim() : undefined,
        paymentMethod: 'Cash on Delivery',
        items: cart.map((item) => ({
          medicineId: item.id,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
          totalPrice: item.price * item.quantity,
        })),
        totalAmount: grandTotal,
      };

      const res = await apiClient.post('/api/orders', orderPayload);
      const orderNumber = res.data?.orderNumber || res.data?.data?.orderNumber || 'MQ-' + Date.now();

      clearCart();
      Alert.alert(
        'Order Received!',
        `Your order #${orderNumber} has been received by MediQuick Pharmacy. A pharmacist will review and verify your order shortly.`,
        [
          {
            text: 'Track Order',
            onPress: () => router.push({ pathname: '/track-order', params: { orderNumber } }),
          },
          { text: 'Done', onPress: () => router.replace('/(tabs)') },
        ]
      );
    } catch (error: any) {
      const msg = error.response?.data?.message || error.response?.data?.error || 'Failed to place order. Please check your network and try again.';
      Alert.alert('Order Failed', msg);
    } finally {
      setPlacingOrder(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Your Cart</Text>
        <Text style={styles.subtitle}>
          {cart.length} {cart.length === 1 ? 'item' : 'items'} in your basket
        </Text>
      </View>

      {/* Cart Items List */}
      {cart.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconCircle}>
            <ShoppingCart size={36} color="#00966d" />
          </View>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptyDesc}>
            Browse our pharmacy products from the catalog and add medicines or essentials to your basket.
          </Text>
          <TouchableOpacity style={styles.browseBtn} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.browseBtnText}>Start Shopping</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.itemsList}>
            {cart.map((item) => (
              <View key={item.id} style={styles.itemCard}>
                <Image
                  source={{
                    uri:
                      item.imageUrl ||
                      'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=200&q=80',
                  }}
                  style={styles.itemImage}
                  resizeMode="contain"
                />
                <View style={styles.itemDetails}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.dosage || item.strength ? (
                    <Text style={styles.itemDosage}>{[item.dosage, item.strength].filter(Boolean).join(' · ')}</Text>
                  ) : null}
                  <Text style={styles.itemPrice}>ZMW {item.price.toFixed(2)}</Text>
                </View>

                {/* Qty Controls */}
                <View style={styles.qtyRow}>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => updateQuantity(item.id, -1)}
                  >
                    {item.quantity === 1 ? (
                      <Trash2 size={13} color="#ef4444" />
                    ) : (
                      <Minus size={13} color="#0e3854" />
                    )}
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => updateQuantity(item.id, 1)}
                  >
                    <Plus size={13} color="#0e3854" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>

          {/* Promo code card */}
          <View style={styles.promoCard}>
            <Tag size={18} color="#00966d" />
            <TextInput
              value={promoCode}
              onChangeText={setPromoCode}
              placeholder="Enter promo code (e.g. WELCOME10)"
              placeholderTextColor="#94a3b8"
              autoCapitalize="characters"
              style={styles.promoInput}
            />
            <TouchableOpacity
              style={[styles.applyBtn, promoApplied && { backgroundColor: '#e6f7f2' }]}
              onPress={handleApplyPromo}
              disabled={promoApplied}
            >
              <Text style={[styles.applyBtnText, promoApplied && { color: '#00966d' }]}>
                {promoApplied ? 'Applied' : 'Apply'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Delivery Method Selector */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Fulfillment Method</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, deliveryMethod === 'delivery' && styles.toggleBtnActive]}
                onPress={() => setDeliveryMethod('delivery')}
              >
                <Truck size={16} color={deliveryMethod === 'delivery' ? '#00966d' : '#64748b'} />
                <Text style={[styles.toggleText, deliveryMethod === 'delivery' && styles.toggleTextActive]}>
                  Delivery (ZMW 25.00)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, deliveryMethod === 'pickup' && styles.toggleBtnActive]}
                onPress={() => setDeliveryMethod('pickup')}
              >
                <Building size={16} color={deliveryMethod === 'pickup' ? '#00966d' : '#64748b'} />
                <Text style={[styles.toggleText, deliveryMethod === 'pickup' && styles.toggleTextActive]}>
                  Store Pickup (Free)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Customer Inputs */}
            <TextInput
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="Your Full Name *"
              placeholderTextColor="#94a3b8"
              style={styles.input}
            />
            <TextInput
              value={customerPhone}
              onChangeText={setCustomerPhone}
              placeholder="Phone Number for confirmation *"
              placeholderTextColor="#94a3b8"
              keyboardType="phone-pad"
              style={styles.input}
            />
            {deliveryMethod === 'delivery' && (
              <TextInput
                value={deliveryAddress}
                onChangeText={setDeliveryAddress}
                placeholder="Delivery Address (Street, House/Apt) *"
                placeholderTextColor="#94a3b8"
                style={styles.input}
              />
            )}
          </View>

          {/* Price Breakdown */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>ZMW {cartTotal.toFixed(2)}</Text>
            </View>
            {promoApplied && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: '#00966d' }]}>Discount (10%)</Text>
                <Text style={[styles.summaryValue, { color: '#00966d' }]}>-ZMW {discountAmount.toFixed(2)}</Text>
              </View>
            )}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery Fee</Text>
              <Text style={styles.summaryValue}>ZMW {deliveryFee.toFixed(2)}</Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>ZMW {grandTotal.toFixed(2)}</Text>
            </View>

            <TouchableOpacity
              style={styles.checkoutBtn}
              onPress={handleCheckout}
              disabled={placingOrder}
            >
              {placingOrder ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Text style={styles.checkoutBtnText}>
                    Place Order · ZMW {grandTotal.toFixed(2)}
                  </Text>
                  <ArrowRight size={18} color="#ffffff" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0e3854',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  itemsList: {
    gap: 10,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#eef2f6',
    padding: 12,
    gap: 12,
  },
  itemImage: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0e3854',
  },
  itemDosage: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#00966d',
    marginTop: 4,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 4,
  },
  qtyBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  qtyText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0e3854',
    minWidth: 16,
    textAlign: 'center',
  },
  promoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  promoInput: {
    flex: 1,
    fontSize: 13,
    color: '#0e3854',
  },
  applyBtn: {
    backgroundColor: '#00966d',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  applyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eef2f6',
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0e3854',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  toggleBtnActive: {
    backgroundColor: '#e6f7f2',
    borderColor: '#00966d',
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  toggleTextActive: {
    color: '#00966d',
  },
  input: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#0e3854',
    backgroundColor: '#ffffff',
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eef2f6',
    padding: 16,
    gap: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0e3854',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#eef2f6',
    paddingTop: 10,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0e3854',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#00966d',
  },
  checkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00966d',
    borderRadius: 12,
    height: 48,
    gap: 8,
    marginTop: 8,
  },
  checkoutBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#e6f7f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0e3854',
  },
  emptyDesc: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 18,
  },
  browseBtn: {
    backgroundColor: '#00966d',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  browseBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
});
