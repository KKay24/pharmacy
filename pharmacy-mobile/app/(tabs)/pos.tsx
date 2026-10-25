import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { useAuth } from '@/context/AuthContext';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  HeartPulse,
  Pill,
  ReceiptText,
  CreditCard,
  Banknote,
  Smartphone,
  User,
  X,
  Layers,
} from 'lucide-react-native';
import { getMedicineBatches, getMedicineCurrentPrice, getMedicineTotalQuantity } from '@/utils/inventory';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { layout } from '@/constants/theme';
import { SearchInput } from '@/components/ui/SearchInput';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { RoleGuard } from '@/components/ui/RoleGuard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandLogo } from '@/components/ui/BrandLogo';

interface Medicine {
  id: number;
  name: string;
  genericName?: string;
  brandName?: string;
  barcode?: string;
  totalQuantity: number;
  price: number;
  mainCategoryId?: number;
}

interface CartItem extends Medicine {
  quantity: number;
}

interface ConfirmedReceipt {
  receiptNumber: string;
  date: string;
  cashierName: string;
  items: Array<{ name: string; quantity: number; price: number; total: number }>;
  paymentMethod: string;
  total: number;
}

interface Customer {
  id: number;
  name: string;
  phone?: string;
}

const PAYMENT_METHODS = [
  { id: 'Cash', label: 'Cash', Icon: Banknote },
  { id: 'Airtel Money', label: 'Airtel Money', Icon: Smartphone },
  { id: 'MTN Mobile Money', label: 'MTN Money', Icon: Smartphone },
  { id: 'Card', label: 'Bank Card', Icon: CreditCard },
];

export default function PosScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('Cash');

  // Customers
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  // Receipt
  const [successModal, setSuccessModal] = useState(false);
  const [confirmedReceipt, setConfirmedReceipt] = useState<ConfirmedReceipt | null>(null);

  const checkoutRef = useRef<{ signature: string; transactionId: string } | null>(null);
  const submissionLock = useRef(false);

  const fetchInventory = async () => {
    try {
      setFetching(true);
      const [firstInvRes, catRes, custRes] = await Promise.allSettled([
        apiClient.get('/api/inventory?page=1&limit=100'),
        apiClient.get('/api/inventory/categories'),
        apiClient.get('/api/customers'),
      ]);

      let allRows: any[] = [];
      if (firstInvRes.status === 'fulfilled') {
        const firstData = firstInvRes.value.data;
        const initialRows = Array.isArray(firstData) ? firstData : firstData?.data || [];
        allRows.push(...initialRows);
        const totalPages = Number(firstData?.pagination?.totalPages) || 1;

        if (totalPages > 1) {
          const pagePromises = [];
          for (let p = 2; p <= totalPages; p++) {
            pagePromises.push(apiClient.get(`/api/inventory?page=${p}&limit=100`));
          }
          const results = await Promise.allSettled(pagePromises);
          for (const res of results) {
            if (res.status === 'fulfilled') {
              const pageData = res.value.data;
              const rows = Array.isArray(pageData) ? pageData : pageData?.data || [];
              allRows.push(...rows);
            }
          }
        }
      }

      // Deduplicate by med.id
      const seen = new Set<number>();
      const deduplicated = allRows.filter((med: any) => {
        if (!med || !med.id) return false;
        if (seen.has(med.id)) return false;
        seen.add(med.id);
        return true;
      });

      const data = deduplicated.map((med: any) => {
        const batches = getMedicineBatches(med.Batches);
        return {
          id: med.id,
          name: med.name,
          genericName: med.genericName,
          brandName: med.brandName,
          barcode: med.barcode || med.sku || '',
          totalQuantity: getMedicineTotalQuantity(batches),
          price: getMedicineCurrentPrice(batches),
          mainCategoryId: med.mainCategoryId,
        };
      });
      setMedicines(data);

      if (catRes.status === 'fulfilled') {
        const catRows = Array.isArray(catRes.value.data) ? catRes.value.data : [];
        setCategories(catRows);
      }

      if (custRes.status === 'fulfilled') {
        const custRows = Array.isArray(custRes.value.data)
          ? custRes.value.data
          : custRes.value.data?.data || [];
        setCustomers(custRows);
      }
    } catch (err) {
      console.error('Failed to fetch data for POS:', err);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const filteredMedicines = useMemo(() => {
    let result = medicines;
    if (selectedCategoryId) {
      result = result.filter((m) => m.mainCategoryId === selectedCategoryId);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          (m.genericName && m.genericName.toLowerCase().includes(q)) ||
          (m.brandName && m.brandName.toLowerCase().includes(q)) ||
          (m.barcode && m.barcode.toLowerCase().includes(q))
      );
    }
    return result;
  }, [medicines, selectedCategoryId, searchQuery]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const q = customerSearch.toLowerCase().trim();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q))
    );
  }, [customers, customerSearch]);

  const addToCart = (medicine: Medicine) => {
    if (medicine.totalQuantity <= 0) {
      Alert.alert('Out of Stock', `${medicine.name} is currently out of stock.`);
      return;
    }

    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.id === medicine.id);
      if (existing) {
        if (existing.quantity >= medicine.totalQuantity) {
          Alert.alert('Stock limit reached', `Only ${medicine.totalQuantity} items available.`);
          return prevCart;
        }
        return prevCart.map((item) =>
          item.id === medicine.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevCart, { ...medicine, quantity: 1 }];
    });
  };

  const updateCartQuantity = (id: number, delta: number) => {
    setCart((prevCart) =>
      prevCart
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return item;
            if (newQty > item.totalQuantity) {
              Alert.alert('Stock limit reached', `Only ${item.totalQuantity} items available.`);
              return item;
            }
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (id: number) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== id));
  };

  const calculateTotal = () =>
    cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0 || submissionLock.current) return;

    submissionLock.current = true;
    setLoading(true);
    try {
      const signature = JSON.stringify(
        cart.map(({ id, quantity, price }) => [id, quantity, price])
      );
      if (!checkoutRef.current || checkoutRef.current.signature !== signature) {
        const randomId =
          typeof globalThis.crypto?.randomUUID === 'function'
            ? globalThis.crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        checkoutRef.current = { signature, transactionId: `mobile_${randomId}`.slice(0, 128) };
      }
      const { transactionId } = checkoutRef.current;
      const receiptNumber = `MQ-${transactionId.replace(/[^a-z0-9]/gi, '').slice(-14).toUpperCase()}`;
      const date = new Date().toISOString();
      const totalAmount = calculateTotal();

      const salesData = cart.map((item, index) => ({
        medicineId: item.id,
        name: item.name,
        quantity: item.quantity,
        totalPrice: item.price * item.quantity,
        paymentMethod,
        customerId: selectedCustomer?.id || null,
        date,
        receiptNumber,
        clientTransactionId: `${transactionId}_${index}`,
      }));

      const payments = [
        {
          method: paymentMethod,
          amount: totalAmount,
        },
      ];

      const response = await apiClient.post('/api/sales', {
        clientTransactionId: transactionId,
        items: salesData,
        payments,
      });

      if (response.status >= 200 && response.status < 300) {
        const confirmedSales = Array.isArray(response.data) ? response.data : [response.data];
        if (confirmedSales.length !== salesData.length || confirmedSales.some((sale) => !sale?.id)) {
          throw new Error('The server did not confirm every item in this sale.');
        }

        setConfirmedReceipt({
          receiptNumber: confirmedSales[0]?.receiptNumber || receiptNumber,
          date: confirmedSales[0]?.date || date,
          cashierName: confirmedSales[0]?.soldBy || user?.username || 'Not recorded',
          items: confirmedSales.map((sale) => ({
            name: sale.name,
            quantity: Number(sale.quantity),
            price: Number(sale.pricePerUnit || sale.totalPrice / sale.quantity || 0),
            total: Number(sale.totalPrice || 0),
          })),
          paymentMethod: confirmedSales[0]?.paymentMethod || paymentMethod,
          total: confirmedSales.reduce((sum, sale) => sum + Number(sale.totalPrice || 0), 0),
        });

        setCart([]);
        setSelectedCustomer(null);
        setShowCart(false);
        setSuccessModal(true);
        checkoutRef.current = null;
        await fetchInventory();
      } else {
        Alert.alert('Sale Error', 'Could not record sale. Please try again.');
      }
    } catch (err: unknown) {
      console.error('POS Checkout error:', err);
      const requestError = err as {
        response?: { data?: { message?: string; error?: string } };
        message?: string;
      };
      const errorMessage =
        requestError.response?.data?.message ||
        requestError.response?.data?.error ||
        requestError.message ||
        'Failed to connect to server.';
      Alert.alert('Sale Failed', errorMessage);
    } finally {
      submissionLock.current = false;
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <View style={[styles.accessDenied, { backgroundColor: theme.background }]}>
        <View style={[styles.deniedIconWrap, { backgroundColor: theme.primarySoft }]}>
          <ShoppingCart size={44} color={theme.primary} />
        </View>
        <Text style={[styles.accessTitle, { color: theme.text }]}>Staff Access Required</Text>
        <Text style={[styles.accessCopy, { color: theme.mutedText }]}>
          Point of Sale checkout is reserved for authorized pharmacy staff and cashiers.
        </Text>
      </View>
    );
  }

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

  return (
    <RoleGuard page="pos">
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* POS Top Bar */}
        <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <View style={styles.brandRow}>
            <View style={[styles.logoMark, { backgroundColor: '#ffffff', overflow: 'hidden' }]}>
              <BrandLogo size="icon" width={38} height={38} />
            </View>
            <View style={styles.brandCopy}>
              <Text style={[styles.brand, { color: theme.navigation }]}>
                MediQuick <Text style={{ color: theme.primary }}>POS</Text>
              </Text>
              <Text style={[styles.cashierLabel, { color: theme.mutedText }]}>
                Cashier: <Text style={{ fontWeight: '700', color: theme.text }}>{user?.username || 'Staff'}</Text>
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Select customer"
              style={[
                styles.customerBtn,
                {
                  backgroundColor: selectedCustomer ? theme.primarySoft : theme.surfaceMuted,
                  borderColor: selectedCustomer ? theme.primary : theme.border,
                },
              ]}
              onPress={() => setShowCustomerModal(true)}
            >
              <User size={15} color={selectedCustomer ? theme.primary : theme.mutedText} />
              <Text
                style={[
                  styles.customerBtnText,
                  { color: selectedCustomer ? theme.primary : theme.textSecondary },
                ]}
                numberOfLines={1}
              >
                {selectedCustomer ? selectedCustomer.name : 'Patient'}
              </Text>
            </Pressable>
          </View>
  
          <SearchInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search medicines, OTC, barcode..."
          />
  
          {/* Category Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            <Pressable
              accessibilityRole="button"
              onPress={() => setSelectedCategoryId(null)}
              style={[
                styles.categoryChip,
                {
                  backgroundColor: selectedCategoryId === null ? theme.primary : theme.surfaceMuted,
                  borderColor: selectedCategoryId === null ? theme.primary : theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  { color: selectedCategoryId === null ? '#ffffff' : theme.textSecondary },
                ]}
              >
                All Items
              </Text>
            </Pressable>
            {categories.map((cat) => {
              const active = selectedCategoryId === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  accessibilityRole="button"
                  onPress={() => setSelectedCategoryId(active ? null : cat.id)}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: active ? theme.primary : theme.surfaceMuted,
                      borderColor: active ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      { color: active ? '#ffffff' : theme.textSecondary },
                    ]}
                  >
                    {cat.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
  
        {/* Product Grid */}
        <FlatList
          data={filteredMedicines}
          numColumns={2}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl
              refreshing={fetching}
              onRefresh={fetchInventory}
              tintColor={theme.primary}
            />
          }
          renderItem={({ item }) => {
            const outOfStock = item.totalQuantity <= 0;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Add ${item.name} to sale`}
                disabled={outOfStock}
                style={({ pressed }) => [
                  styles.itemCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    opacity: outOfStock ? 0.6 : pressed ? 0.85 : 1,
                  },
                ]}
                onPress={() => addToCart(item)}
              >
                <View style={[styles.productVisual, { backgroundColor: theme.primarySoft }]}>
                  <Pill size={36} color={theme.primary} strokeWidth={1.8} />
                  {outOfStock ? (
                    <View style={styles.outOfStockBadge}>
                      <Text style={styles.outOfStockText}>Out of stock</Text>
                    </View>
                  ) : null}
                </View>
                <Text numberOfLines={2} style={[styles.itemName, { color: theme.text }]}>
                  {item.name}
                </Text>
                <Text numberOfLines={1} style={[styles.itemStock, { color: theme.mutedText }]}>
                  Stock: {item.totalQuantity} units{item.barcode ? ` · #${item.barcode}` : ''}
                </Text>
                <Text style={[styles.itemPrice, { color: theme.navigation }]}>
                  K {item.price.toFixed(2)}
                </Text>
                <View
                  style={[
                    styles.addButton,
                    { backgroundColor: outOfStock ? theme.border : theme.primary },
                  ]}
                >
                  <Text style={styles.quickAddText}>
                    {outOfStock ? 'Unavailable' : 'Add to sale'}
                  </Text>
                  {!outOfStock ? <Plus size={15} color="#ffffff" /> : null}
                </View>
              </Pressable>
            );
          }}
          columnWrapperStyle={styles.productRow}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            !fetching ? (
              <EmptyState
                icon={<Pill size={32} color={theme.mutedText} />}
                title="No products found"
                description="Try adjusting your search terms or category filter."
              />
            ) : null
          }
        />
  
        {/* Cart Summary FAB */}
        {cart.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Review current sale"
            style={[styles.cartFab, { backgroundColor: theme.navigation, shadowColor: theme.navigation }]}
            onPress={() => setShowCart(true)}
          >
            <View style={styles.cartFabLeft}>
              <View style={[styles.cartBadge, { backgroundColor: theme.primary }]}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
              <View style={styles.cartFabCopy}>
                <Text style={styles.cartFabTitle}>Current Sale</Text>
                <Text style={styles.cartFabSubtitle}>
                  {paymentMethod} · {selectedCustomer ? selectedCustomer.name : 'Walk-in'}
                </Text>
              </View>
            </View>
            <View style={styles.cartFabRight}>
              <Text style={styles.cartFabTotal}>K {calculateTotal().toFixed(2)}</Text>
              <Text style={styles.cartFabAction}>Pay & Checkout →</Text>
            </View>
          </Pressable>
        ) : null}
  
        {/* Cart & Payment Drawer Modal */}
        <Modal visible={showCart} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
              <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                <View>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>Checkout & Sale</Text>
                  <Text style={[styles.modalSubtitle, { color: theme.mutedText }]}>
                    {cartCount} item{cartCount === 1 ? '' : 's'} in cart
                  </Text>
                </View>
                <Pressable hitSlop={8} onPress={() => setShowCart(false)}>
                  <X size={22} color={theme.mutedText} />
                </Pressable>
              </View>
  
              <ScrollView style={styles.cartList} showsVerticalScrollIndicator={false}>
                {cart.map((item) => (
                  <View key={item.id} style={[styles.cartItem, { borderBottomColor: theme.borderLight }]}>
                    <View style={styles.cartItemInfo}>
                      <Text style={[styles.cartItemName, { color: theme.text }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={[styles.cartItemPrice, { color: theme.mutedText }]}>
                        K {item.price.toFixed(2)} each
                      </Text>
                    </View>
                    <View style={styles.cartItemActions}>
                      <Pressable
                        style={[styles.qtyBtn, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
                        onPress={() => updateCartQuantity(item.id, -1)}
                      >
                        <Minus size={15} color={theme.text} />
                      </Pressable>
                      <Text style={[styles.qtyText, { color: theme.text }]}>{item.quantity}</Text>
                      <Pressable
                        style={[styles.qtyBtn, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
                        onPress={() => updateCartQuantity(item.id, 1)}
                      >
                        <Plus size={15} color={theme.text} />
                      </Pressable>
                      <Pressable
                        style={styles.deleteBtn}
                        onPress={() => removeFromCart(item.id)}
                      >
                        <Trash2 size={16} color={theme.danger} />
                      </Pressable>
                    </View>
                  </View>
                ))}
  
                {/* Payment Method Selector */}
                <View style={styles.paymentSection}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Payment Method</Text>
                  <View style={styles.paymentMethodsGrid}>
                    {PAYMENT_METHODS.map(({ id, label, Icon }) => {
                      const active = paymentMethod === id;
                      return (
                        <Pressable
                          key={id}
                          accessibilityRole="button"
                          style={[
                            styles.paymentOption,
                            {
                              backgroundColor: active ? theme.primarySoft : theme.surfaceMuted,
                              borderColor: active ? theme.primary : theme.border,
                            },
                          ]}
                          onPress={() => setPaymentMethod(id)}
                        >
                          <Icon size={18} color={active ? theme.primary : theme.mutedText} />
                          <Text
                            style={[
                              styles.paymentOptionText,
                              { color: active ? theme.primary : theme.textSecondary, fontWeight: active ? '700' : '500' },
                            ]}
                          >
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
  
                {/* Customer Linkage */}
                <View style={styles.customerSection}>
                  <View style={styles.customerHeaderRow}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Patient / Customer</Text>
                    <Pressable onPress={() => setShowCustomerModal(true)}>
                      <Text style={[styles.changeCustomerText, { color: theme.primary }]}>
                        {selectedCustomer ? 'Change' : 'Assign Patient'}
                      </Text>
                    </Pressable>
                  </View>
                  {selectedCustomer ? (
                    <View style={[styles.selectedCustomerCard, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                      <User size={16} color={theme.primary} />
                      <View style={styles.customerInfo}>
                        <Text style={[styles.customerNameText, { color: theme.text }]}>{selectedCustomer.name}</Text>
                        {selectedCustomer.phone ? (
                          <Text style={[styles.customerPhoneText, { color: theme.mutedText }]}>{selectedCustomer.phone}</Text>
                        ) : null}
                      </View>
                      <Pressable hitSlop={6} onPress={() => setSelectedCustomer(null)}>
                        <X size={16} color={theme.mutedText} />
                      </Pressable>
                    </View>
                  ) : (
                    <Text style={[styles.noCustomerNotice, { color: theme.mutedText }]}>
                      Walk-in customer (optional patient assignment)
                    </Text>
                  )}
                </View>
              </ScrollView>
  
              <View style={[styles.modalFooter, { borderTopColor: theme.border }]}>
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: theme.mutedText }]}>Total to Pay</Text>
                  <Text style={[styles.totalValue, { color: theme.navigation }]}>
                    K {calculateTotal().toFixed(2)}
                  </Text>
                </View>
                <Button
                  title={loading ? 'Processing Sale...' : `Confirm & Record Sale (K ${calculateTotal().toFixed(2)})`}
                  onPress={handleCheckout}
                  loading={loading}
                  variant="primary"
                  size="lg"
                  fullWidth
                />
              </View>
            </View>
          </View>
        </Modal>
  
        {/* Customer Selection Modal */}
        <Modal visible={showCustomerModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContentSmall, { backgroundColor: theme.surface }]}>
              <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Assign Patient / Customer</Text>
                <Pressable hitSlop={8} onPress={() => setShowCustomerModal(false)}>
                  <X size={20} color={theme.mutedText} />
                </Pressable>
              </View>
              <View style={{ paddingVertical: 10 }}>
                <SearchInput
                  value={customerSearch}
                  onChangeText={setCustomerSearch}
                  placeholder="Search by name or phone..."
                />
              </View>
              <FlatList
                data={filteredCustomers}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                  <Pressable
                    accessibilityRole="button"
                    style={[styles.customerRow, { borderBottomColor: theme.borderLight }]}
                    onPress={() => {
                      setSelectedCustomer(item);
                      setShowCustomerModal(false);
                    }}
                  >
                    <View style={[styles.custAvatar, { backgroundColor: theme.primarySoft }]}>
                      <Text style={[styles.custAvatarText, { color: theme.primary }]}>
                        {item.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.custDetails}>
                      <Text style={[styles.custName, { color: theme.text }]}>{item.name}</Text>
                      {item.phone ? (
                        <Text style={[styles.custPhone, { color: theme.mutedText }]}>{item.phone}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                )}
                ListEmptyComponent={
                  <Text style={[styles.emptyCustomer, { color: theme.mutedText }]}>
                    No patients found.
                  </Text>
                }
              />
            </View>
          </View>
        </Modal>
  
        {/* Confirmed Receipt Modal */}
        <Modal visible={successModal} transparent animationType="fade">
          <View style={styles.successOverlay}>
            <View style={[styles.successContent, { backgroundColor: theme.surface }]}>
              <View style={[styles.successIconCircle, { backgroundColor: theme.successSoft }]}>
                <CheckCircle2 size={46} color={theme.success} />
              </View>
              <Text style={[styles.successTitle, { color: theme.navigation }]}>Sale Recorded!</Text>
              <Text style={[styles.receiptNumber, { color: theme.primary }]}>
                Receipt #{confirmedReceipt?.receiptNumber}
              </Text>
  
              <View style={[styles.receiptPaper, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                <View style={styles.receiptLine}>
                  <Text style={[styles.receiptFieldLabel, { color: theme.mutedText }]}>Date & Time:</Text>
                  <Text style={[styles.receiptFieldValue, { color: theme.text }]}>
                    {confirmedReceipt?.date ? new Date(confirmedReceipt.date).toLocaleString() : '—'}
                  </Text>
                </View>
                <View style={styles.receiptLine}>
                  <Text style={[styles.receiptFieldLabel, { color: theme.mutedText }]}>Cashier:</Text>
                  <Text style={[styles.receiptFieldValue, { color: theme.text }]}>
                    {confirmedReceipt?.cashierName}
                  </Text>
                </View>
                <View style={styles.receiptLine}>
                  <Text style={[styles.receiptFieldLabel, { color: theme.mutedText }]}>Payment Method:</Text>
                  <Text style={[styles.receiptFieldValue, { color: theme.text }]}>
                    {confirmedReceipt?.paymentMethod}
                  </Text>
                </View>
  
                <View style={[styles.receiptDivider, { backgroundColor: theme.border }]} />
  
                {confirmedReceipt?.items?.map((item, idx) => (
                  <View key={idx} style={styles.receiptItemLine}>
                    <Text style={[styles.receiptItemName, { color: theme.text }]} numberOfLines={1}>
                      {item.name} × {item.quantity}
                    </Text>
                    <Text style={[styles.receiptItemTotal, { color: theme.text }]}>
                      K {item.total.toFixed(2)}
                    </Text>
                  </View>
                ))}
  
                <View style={[styles.receiptDivider, { backgroundColor: theme.border }]} />
  
                <View style={styles.receiptTotalLine}>
                  <Text style={[styles.receiptTotalLabel, { color: theme.text }]}>Total Amount</Text>
                  <Text style={[styles.receiptTotalAmount, { color: theme.primary }]}>
                    K {Number(confirmedReceipt?.total || 0).toFixed(2)}
                  </Text>
                </View>
              </View>
  
              <Button
                title="Start New Sale"
                onPress={() => setSuccessModal(false)}
                variant="primary"
                size="md"
                fullWidth
              />
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
  deniedIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: layout.spacing.lg,
  },
  accessTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  accessCopy: { textAlign: 'center', marginTop: 8, lineHeight: 22, maxWidth: 300 },
  header: {
    paddingHorizontal: layout.spacing.lg,
    paddingTop: layout.spacing.md,
    paddingBottom: layout.spacing.sm,
    borderBottomWidth: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: layout.spacing.sm,
    backgroundColor: 'transparent',
  },
  logoMark: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandCopy: { flex: 1, marginLeft: 10, backgroundColor: 'transparent' },
  brand: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  cashierLabel: { fontSize: 11, marginTop: 1 },
  customerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: layout.radius.sm,
    borderWidth: 1,
  },
  customerBtnText: { fontSize: 12, fontWeight: '600', maxWidth: 90 },
  categoryScroll: { gap: 8, paddingVertical: 10 },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: layout.radius.full,
    borderWidth: 1,
  },
  categoryChipText: { fontSize: 12, fontWeight: '700' },
  listContent: {
    paddingHorizontal: layout.spacing.md,
    paddingTop: layout.spacing.sm,
    paddingBottom: 110,
  },
  productRow: { justifyContent: 'space-between' },
  itemCard: {
    width: '48.5%',
    padding: 9,
    borderRadius: layout.radius.md,
    marginBottom: layout.spacing.md,
    borderWidth: 1,
  },
  productVisual: {
    height: 90,
    borderRadius: layout.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 8,
  },
  outOfStockBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  outOfStockText: { color: '#ffffff', fontSize: 9, fontWeight: '700' },
  itemName: { fontSize: 13, fontWeight: '800', minHeight: 34, lineHeight: 17 },
  itemStock: { fontSize: 10, marginTop: 2 },
  itemPrice: { fontSize: 15, fontWeight: '800', marginTop: 4, marginBottom: 6 },
  addButton: {
    minHeight: 32,
    borderRadius: layout.radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  quickAddText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  cartFab: {
    position: 'absolute',
    left: layout.spacing.md,
    right: layout.spacing.md,
    bottom: 14,
    minHeight: 58,
    borderRadius: layout.radius.lg,
    paddingHorizontal: layout.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  cartFabLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'transparent' },
  cartBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: { color: '#ffffff', fontSize: 12, fontWeight: '900' },
  cartFabCopy: { backgroundColor: 'transparent' },
  cartFabTitle: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  cartFabSubtitle: { color: 'rgba(255, 255, 255, 0.75)', fontSize: 11, marginTop: 1 },
  cartFabRight: { alignItems: 'flex-end', backgroundColor: 'transparent' },
  cartFabTotal: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
  cartFabAction: { color: '#34d399', fontSize: 11, fontWeight: '700', marginTop: 1 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 49, 86, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: layout.radius.xxl,
    borderTopRightRadius: layout.radius.xxl,
    height: '84%',
    padding: layout.spacing.lg,
  },
  modalContentSmall: {
    borderTopLeftRadius: layout.radius.xxl,
    borderTopRightRadius: layout.radius.xxl,
    height: '65%',
    padding: layout.spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: layout.spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalSubtitle: { fontSize: 12, marginTop: 2 },
  cartList: { flex: 1, marginTop: 8 },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    backgroundColor: 'transparent',
  },
  cartItemInfo: { flex: 1, backgroundColor: 'transparent' },
  cartItemName: { fontSize: 14, fontWeight: '700' },
  cartItemPrice: { fontSize: 12, marginTop: 2 },
  cartItemActions: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'transparent' },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  qtyText: { minWidth: 22, textAlign: 'center', fontSize: 13, fontWeight: '800' },
  deleteBtn: { padding: 6, marginLeft: 2 },
  paymentSection: { marginTop: layout.spacing.lg, backgroundColor: 'transparent' },
  sectionTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 0.2, marginBottom: 8 },
  paymentMethodsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, backgroundColor: 'transparent' },
  paymentOption: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: layout.radius.md,
    borderWidth: 1.5,
  },
  paymentOptionText: { fontSize: 12 },
  customerSection: { marginTop: layout.spacing.lg, marginBottom: layout.spacing.lg, backgroundColor: 'transparent' },
  customerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginBottom: 6,
  },
  changeCustomerText: { fontSize: 12, fontWeight: '700' },
  selectedCustomerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: layout.radius.sm,
    borderWidth: 1,
  },
  customerInfo: { flex: 1, backgroundColor: 'transparent' },
  customerNameText: { fontSize: 13, fontWeight: '700' },
  customerPhoneText: { fontSize: 11, marginTop: 1 },
  noCustomerNotice: { fontSize: 12, fontStyle: 'italic' },
  modalFooter: { paddingTop: layout.spacing.md, borderTopWidth: 1 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: layout.spacing.md,
    backgroundColor: 'transparent',
  },
  totalLabel: { fontSize: 14, fontWeight: '600' },
  totalValue: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  custAvatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  custAvatarText: { fontSize: 14, fontWeight: '800' },
  custDetails: { marginLeft: 10, flex: 1 },
  custName: { fontSize: 14, fontWeight: '700' },
  custPhone: { fontSize: 12, marginTop: 1 },
  emptyCustomer: { textAlign: 'center', paddingVertical: 20, fontSize: 13 },
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 49, 86, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: layout.spacing.xl,
  },
  successContent: {
    width: '100%',
    borderRadius: layout.radius.xl,
    padding: layout.spacing.xl,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: layout.spacing.md,
  },
  successTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  receiptNumber: { fontSize: 13, fontWeight: '700', marginTop: 2, marginBottom: layout.spacing.md },
  receiptPaper: {
    width: '100%',
    padding: layout.spacing.md,
    borderRadius: layout.radius.md,
    borderWidth: 1,
    marginBottom: layout.spacing.lg,
  },
  receiptLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
    backgroundColor: 'transparent',
  },
  receiptFieldLabel: { fontSize: 11, fontWeight: '600' },
  receiptFieldValue: { fontSize: 11, fontWeight: '700' },
  receiptDivider: { height: 1, marginVertical: 8 },
  receiptItemLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 3,
    backgroundColor: 'transparent',
  },
  receiptItemName: { fontSize: 12, fontWeight: '600', flex: 1, marginRight: 8 },
  receiptItemTotal: { fontSize: 12, fontWeight: '700' },
  receiptTotalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginTop: 2,
  },
  receiptTotalLabel: { fontSize: 13, fontWeight: '800' },
  receiptTotalAmount: { fontSize: 16, fontWeight: '900' },
});
