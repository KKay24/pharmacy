import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, Pressable, TextInput, Alert, Modal, ScrollView } from 'react-native';
import { Text, View } from '@/components/Themed';
import apiClient from '@/api/client';
import { Search, ShoppingCart, Plus, Minus, Trash2, CheckCircle2 } from 'lucide-react-native';
import { getMedicineBatches, getMedicineCurrentPrice, getMedicineTotalQuantity } from '@/utils/inventory';

interface Medicine {
  id: number;
  name: string;
  genericName?: string;
  totalQuantity: number;
  price: number;
}

interface CartItem extends Medicine {
  quantity: number;
}

export default function PosScreen() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [filteredMedicines, setFilteredMedicines] = useState<Medicine[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successModal, setSuccessModal] = useState(false);

  const fetchInventory = async () => {
    try {
      const response = await apiClient.get('/api/inventory');
      const rows = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      const data = rows.map((med: any) => {
        const batches = getMedicineBatches(med.Batches);

        return {
          id: med.id,
          name: med.name,
          genericName: med.genericName,
          totalQuantity: getMedicineTotalQuantity(batches),
          price: getMedicineCurrentPrice(batches),
        };
      });
      setMedicines(data);
      setFilteredMedicines(data);
    } catch (err) {
      console.error('Failed to fetch inventory for POS:', err);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredMedicines(medicines);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = medicines.filter(med => 
        med.name.toLowerCase().includes(query) || 
        med.genericName?.toLowerCase().includes(query)
      );
      setFilteredMedicines(filtered);
    }
  }, [searchQuery, medicines]);

  const addToCart = (medicine: Medicine) => {
    if (medicine.totalQuantity <= 0) {
      Alert.alert('Out of Stock', `${medicine.name} is currently unavailable.`);
      return;
    }

    setCart(prevCart => {
      const existing = prevCart.find(item => item.id === medicine.id);
      if (existing) {
        if (existing.quantity >= medicine.totalQuantity) {
          Alert.alert('Insolvent Stock', `Only ${medicine.totalQuantity} items available.`);
          return prevCart;
        }
        return prevCart.map(item => 
          item.id === medicine.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevCart, { ...medicine, quantity: 1 }];
    });
  };

  const updateCartQuantity = (id: number, delta: number) => {
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.id === id) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return item;
          if (newQty > item.totalQuantity) {
             Alert.alert('Insolvent Stock', `Only ${item.totalQuantity} items available.`);
             return item;
          }
          return { ...item, quantity: newQty };
        }
        return item;
      }).filter(item => item.quantity > 0);
    });
  };

  const removeFromCart = (id: number) => {
    setCart(prevCart => prevCart.filter(item => item.id !== id));
  };

  const calculateSubtotal = () => cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const calculateTotal = () => calculateSubtotal();

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    setLoading(true);
    try {
      const salesData = cart.map(item => ({
        medicineId: item.id,
        name: item.name,
        quantity: item.quantity,
        totalPrice: item.price * item.quantity,
        paymentMethod: 'Cash', // Default for mobile POS for now
        date: new Date().toISOString()
      }));

      const response = await apiClient.post('/api/sales', salesData);
      
      if (response.status >= 200 && response.status < 300) {
        setCart([]);
        setShowCart(false);
        setSuccessModal(true);
        fetchInventory(); // Refresh stock
      } else {
        Alert.alert('Error', 'Failed to record sale.');
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      const errorMessage = err.response?.data?.error || 'Failed to connect to server.';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Search size={20} color="#64748b" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <FlatList
        data={filteredMedicines}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <Pressable 
            style={({ pressed }) => [styles.itemCard, pressed && styles.itemPressed]}
            onPress={() => addToCart(item)}
          >
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemStock}>Stock: {item.totalQuantity}</Text>
            </View>
            <View style={styles.itemAction}>
              <Text style={styles.itemPrice}>K {item.price.toFixed(2)}</Text>
              <View style={styles.addButton}>
                <Plus size={16} color="#fff" />
              </View>
            </View>
          </Pressable>
        )}
        contentContainerStyle={styles.listContent}
      />

      {/* Floating Cart Button */}
      {cart.length > 0 && (
        <Pressable style={styles.cartFab} onPress={() => setShowCart(true)}>
          <ShoppingCart color="#fff" size={24} />
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>{cart.reduce((a, b) => a + b.quantity, 0)}</Text>
          </View>
        </Pressable>
      )}

      {/* Cart Modal */}
      <Modal visible={showCart} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Current Sale</Text>
              <Pressable onPress={() => setShowCart(false)}>
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.cartList}>
              {cart.map(item => (
                <View key={item.id} style={styles.cartItem}>
                  <View style={styles.cartItemInfo}>
                    <Text style={styles.cartItemName}>{item.name}</Text>
                    <Text style={styles.cartItemPrice}>K {item.price.toFixed(2)} ea</Text>
                  </View>
                  <View style={styles.cartItemActions}>
                    <Pressable style={styles.qtyBtn} onPress={() => updateCartQuantity(item.id, -1)}>
                      <Minus size={16} color="#475569" />
                    </Pressable>
                    <Text style={styles.qtyText}>{item.quantity}</Text>
                    <Pressable style={styles.qtyBtn} onPress={() => updateCartQuantity(item.id, 1)}>
                      <Plus size={16} color="#475569" />
                    </Pressable>
                    <Pressable style={styles.deleteBtn} onPress={() => removeFromCart(item.id)}>
                      <Trash2 size={16} color="#ef4444" />
                    </Pressable>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalFooter}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>K {calculateSubtotal().toFixed(2)}</Text>
              </View>

              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>K {calculateTotal().toFixed(2)}</Text>
              </View>

              <Pressable 
                style={[styles.checkoutBtn, loading && styles.disabledBtn]} 
                onPress={handleCheckout}
                disabled={loading}
              >
                <Text style={styles.checkoutBtnText}>
                  {loading ? 'Processing...' : 'Complete Sale'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal visible={successModal} transparent={true} animationType="fade">
        <View style={styles.successOverlay}>
          <View style={styles.successContent}>
            <CheckCircle2 size={60} color="#059669" />
            <Text style={styles.successTitle}>Sale Recorded!</Text>
            <Text style={styles.successText}>The transaction has been successfully processed.</Text>
            <Pressable style={styles.successBtn} onPress={() => setSuccessModal(false)}>
              <Text style={styles.successBtnText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    margin: 15,
    paddingHorizontal: 15,
    borderRadius: 12,
    height: 50,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#0f172a',
  },
  listContent: {
    padding: 15,
    paddingBottom: 100,
  },
  itemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  itemPressed: {
    backgroundColor: '#f8fafc',
    borderColor: '#2563eb',
  },
  itemInfo: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  itemName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0f172a',
  },
  itemStock: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  itemAction: {
    alignItems: 'flex-end',
    backgroundColor: 'transparent',
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563eb',
    marginBottom: 8,
  },
  addButton: {
    backgroundColor: '#2563eb',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartFab: {
    position: 'absolute',
    bottom: 25,
    right: 25,
    backgroundColor: '#2563eb',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  cartBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#ef4444',
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    height: '80%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  closeText: {
    color: '#64748b',
    fontSize: 16,
  },
  cartList: {
    flex: 1,
  },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  cartItemPrice: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  cartItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyText: {
    marginHorizontal: 12,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  deleteBtn: {
    marginLeft: 15,
    padding: 5,
  },
  modalFooter: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    color: '#64748b',
    fontSize: 15,
  },
  summaryValue: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '500',
  },
  totalRow: {
    marginTop: 5,
    marginBottom: 20,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  totalValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  checkoutBtn: {
    backgroundColor: '#2563eb',
    height: 55,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkoutBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  disabledBtn: {
    backgroundColor: '#94a3b8',
  },
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successContent: {
    backgroundColor: '#fff',
    padding: 40,
    borderRadius: 25,
    alignItems: 'center',
    width: '80%',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 20,
  },
  successText: {
    textAlign: 'center',
    color: '#64748b',
    marginTop: 10,
    marginBottom: 30,
    lineHeight: 20,
  },
  successBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 12,
  },
  successBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
