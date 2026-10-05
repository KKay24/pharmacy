import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, Pressable, RefreshControl, ScrollView, TextInput } from 'react-native';
import { Text, View } from '@/components/Themed';
import apiClient from '@/api/client';
import { Search } from 'lucide-react-native';
import { getMedicineBatches, getMedicineCurrentPrice, getMedicineTotalQuantity } from '@/utils/inventory';

interface Medicine {
  id: number;
  name: string;
  genericName?: string;
  category?: string;
  mainCategoryId?: number | null;
  subcategoryId?: number | null;
  productFormId?: number | null;
  brandName?: string;
  strength?: string;
  dosage?: string;
  MainCategory?: { name: string };
  Subcategory?: { name: string };
  ProductForm?: { name: string };
  totalQuantity: number;
  lowStockThreshold: number;
  Batches: any[];
}

interface TaxonomyForm {
  id: number;
  name: string;
}

interface TaxonomySubcategory extends TaxonomyForm {
  forms: TaxonomyForm[];
}

interface TaxonomyCategory extends TaxonomyForm {
  subcategories: TaxonomySubcategory[];
}

export default function InventoryScreen() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [filteredMedicines, setFilteredMedicines] = useState<Medicine[]>([]);
  const [inventoryCategories, setInventoryCategories] = useState<TaxonomyCategory[]>([]);
  const [taxonomyError, setTaxonomyError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mainCategoryId, setMainCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [productFormId, setProductFormId] = useState('');
  const selectedCategory = inventoryCategories.find((category) => String(category.id) === mainCategoryId);
  const selectedSubcategory = selectedCategory?.subcategories.find(
    (subcategory) => String(subcategory.id) === subcategoryId
  );

  const fetchInventory = async () => {
    try {
      const response = await apiClient.get('/api/inventory');
      const rows = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      const data = rows.map((med: any) => {
        const batches = getMedicineBatches(med.Batches);

        return {
          ...med,
          Batches: batches,
          totalQuantity: getMedicineTotalQuantity(batches),
        };
      });
      setMedicines(data);
      setFilteredMedicines(data);
    } catch (err) {
      console.error('Failed to fetch inventory:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchInventoryCategories = async () => {
    try {
      const response = await apiClient.get('/api/inventory/categories');
      if (!Array.isArray(response.data)) {
        throw new Error('Inventory category response was not a list');
      }
      setInventoryCategories(response.data);
      setTaxonomyError('');
    } catch (error) {
      console.error('Failed to fetch inventory categories:', error);
      setTaxonomyError('Category filters are unavailable');
    }
  };

  useEffect(() => {
    fetchInventory();
    fetchInventoryCategories();
  }, []);

  useEffect(() => {
    const query = searchQuery.trim().toLowerCase();
    setFilteredMedicines(medicines.filter((medicine) => {
      const matchesClassification =
        (!mainCategoryId || String(medicine.mainCategoryId) === mainCategoryId) &&
        (!subcategoryId || String(medicine.subcategoryId) === subcategoryId) &&
        (!productFormId || String(medicine.productFormId) === productFormId);
      const matchesSearch = !query ||
        medicine.name.toLowerCase().includes(query) ||
        medicine.genericName?.toLowerCase().includes(query) ||
        medicine.brandName?.toLowerCase().includes(query) ||
        medicine.MainCategory?.name.toLowerCase().includes(query) ||
        medicine.Subcategory?.name.toLowerCase().includes(query) ||
        medicine.ProductForm?.name.toLowerCase().includes(query);
      return matchesClassification && matchesSearch;
    }));
  }, [searchQuery, medicines, mainCategoryId, subcategoryId, productFormId]);

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
            <Text style={styles.genericName}>{[item.brandName, item.genericName, item.strength].filter(Boolean).join(' · ') || 'N/A'}</Text>
          </View>
          <Text style={styles.price}>K {currentPrice.toFixed(2)}</Text>
        </View>
        
        <View style={styles.cardFooter}>
          <View style={styles.classification}>
            <Text style={styles.categoryBadge}>{item.MainCategory?.name || 'Unclassified'}</Text>
            <Text style={styles.classificationDetail}>
              {[item.Subcategory?.name, item.ProductForm?.name || item.dosage].filter(Boolean).join(' · ') || 'Classification needed'}
            </Text>
          </View>
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
      {taxonomyError ? <Text style={styles.taxonomyError}>{taxonomyError}</Text> : null}
      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>Main category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {[{ id: '', name: 'All' }, ...inventoryCategories].map((category) => (
            <Pressable
              key={String(category.id || 'all')}
              accessibilityRole="button"
              accessibilityLabel={`Main category: ${category.name}`}
              style={[styles.filterChip, mainCategoryId === String(category.id) && styles.activeFilterChip]}
              onPress={() => {
                setMainCategoryId(String(category.id));
                setSubcategoryId('');
                setProductFormId('');
              }}
            >
              <Text style={[styles.filterText, mainCategoryId === String(category.id) && styles.activeFilterText]}>
                {category.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      {selectedCategory ? (
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Subcategory</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {[{ id: '', name: 'All' }, ...selectedCategory.subcategories].map((subcategory) => (
              <Pressable
                key={String(subcategory.id || 'all')}
                accessibilityRole="button"
                accessibilityLabel={`Subcategory: ${subcategory.name}`}
                style={[styles.filterChip, subcategoryId === String(subcategory.id) && styles.activeFilterChip]}
                onPress={() => {
                  setSubcategoryId(String(subcategory.id));
                  setProductFormId('');
                }}
              >
                <Text style={[styles.filterText, subcategoryId === String(subcategory.id) && styles.activeFilterText]}>
                  {subcategory.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
      {selectedSubcategory ? (
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Product form</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {[{ id: '', name: 'All' }, ...selectedSubcategory.forms].map((form) => (
              <Pressable
                key={String(form.id || 'all')}
                accessibilityRole="button"
                accessibilityLabel={`Product form: ${form.name}`}
                style={[styles.filterChip, productFormId === String(form.id) && styles.activeFilterChip]}
                onPress={() => setProductFormId(String(form.id))}
              >
                <Text style={[styles.filterText, productFormId === String(form.id) && styles.activeFilterText]}>
                  {form.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

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
  taxonomyError: {
    color: '#b91c1c',
    marginHorizontal: 18,
    marginBottom: 8,
    fontSize: 12,
  },
  filterGroup: {
    backgroundColor: 'transparent',
    marginBottom: 6,
  },
  filterLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 18,
    marginBottom: 5,
  },
  filterRow: {
    paddingHorizontal: 15,
    gap: 7,
  },
  filterChip: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  activeFilterChip: {
    backgroundColor: '#dbeafe',
    borderColor: '#2563eb',
  },
  filterText: {
    color: '#475569',
    fontSize: 12,
  },
  activeFilterText: {
    color: '#1d4ed8',
    fontWeight: '600',
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
  classification: {
    backgroundColor: 'transparent',
    flexShrink: 1,
  },
  classificationDetail: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 3,
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
