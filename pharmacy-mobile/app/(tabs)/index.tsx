import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, RefreshControl, TextInput } from 'react-native';
import { Text, View } from '@/components/Themed';
import apiClient from '@/api/client';
import { Search } from 'lucide-react-native';
import { getMedicineBatches, getMedicineCurrentPrice, getMedicineTotalQuantity } from '@/utils/inventory';

interface Medicine {
  id: number;
  name: string;
  genericName: string;
  category: string;
  totalQuantity: number;
  lowStockThreshold: number;
  Batches: any[];
}

export default function InventoryScreen() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [filteredMedicines, setFilteredMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchInventory = async () => {
    try {
      const response = await apiClient.get('/api/inventory');
      const data = Array.isArray(response.data) ? response.data.map((med: any) => {
        const batches = getMedicineBatches(med.Batches);

        return {
          ...med,
          Batches: batches,
          totalQuantity: getMedicineTotalQuantity(batches),
        };
      }) : [];
      setMedicines(data);
      setFilteredMedicines(data);
    } catch (err) {
      console.error('Failed to fetch inventory:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
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
        med.genericName?.toLowerCase().includes(query) ||
        med.category?.toLowerCase().includes(query)
      );
      setFilteredMedicines(filtered);
    }
  }, [searchQuery, medicines]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchInventory();
  };

  const renderItem = ({ item }: { item: Medicine }) => {
    const isLowStock = item.totalQuantity <= item.lowStockThreshold;
    const currentPrice = getMedicineCurrentPrice(item.Batches);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.medicineName}>{item.name}</Text>
            <Text style={styles.genericName}>{item.genericName || 'N/A'}</Text>
          </View>
          <Text style={styles.price}>K {currentPrice.toFixed(2)}</Text>
        </View>
        
        <View style={styles.cardFooter}>
          <Text style={styles.categoryBadge}>{item.category || 'General'}</Text>
          <View style={styles.stockContainer}>
            <Text style={[styles.stockText, isLowStock && styles.lowStockText]}>
              Stock: {item.totalQuantity}
            </Text>
            {isLowStock && (
              <View style={styles.lowStockBadge}>
                <Text style={styles.lowStockBadgeText}>Low</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
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

      <FlatList
        data={filteredMedicines}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No medicines found.</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    margin: 15,
    paddingHorizontal: 15,
    borderRadius: 12,
    height: 50,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    paddingHorizontal: 15,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    backgroundColor: 'transparent',
  },
  medicineName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  genericName: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  price: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2563eb',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  categoryBadge: {
    fontSize: 12,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    color: '#475569',
    overflow: 'hidden',
  },
  stockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  stockText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0f172a',
  },
  lowStockText: {
    color: '#ef4444',
  },
  lowStockBadge: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
    borderWidth: 0.5,
    borderColor: '#fca5a5',
  },
  lowStockBadgeText: {
    fontSize: 10,
    color: '#ef4444',
    fontWeight: '700',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 16,
  },
});
