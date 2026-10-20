import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  TextInput,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Text, View } from '@/components/Themed';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Search, ChevronRight, Pill, Sparkles, Shield, HeartPulse, Baby, Layers } from 'lucide-react-native';
import apiClient from '@/api/client';

interface CategoryItem {
  id: number | string;
  name: string;
  slug: string;
  description?: string;
  level?: number;
  imageUrl?: string;
}

const CATEGORY_IMAGES: Record<string, string> = {
  medicines: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=700&q=80',
  'medical-supplies': 'https://images.unsplash.com/photo-1550572017-edd951b55104?auto=format&fit=crop&w=700&q=80',
  'vitamins-supplements': 'https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?auto=format&fit=crop&w=700&q=80',
  'personal-care': 'https://images.unsplash.com/photo-1556229010-6c3f2c9ca5f8?auto=format&fit=crop&w=700&q=80',
  'baby-products': 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=700&q=80',
  'medical-devices': 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=700&q=80',
};

const CATEGORY_ICONS: Record<string, string> = {
  medicines: '💊',
  'medical-supplies': '🩹',
  'vitamins-supplements': '🌿',
  'personal-care': '🧴',
  'baby-products': '👶',
  'medical-devices': '🩺',
};

export default function CategoriesScreen() {
  const insets = useSafeAreaInsets();
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/products/categories');
      const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      // Filter level 1 or main categories from database
      const mainCats = data.map((c: any) => ({
        id: c.id,
        name: c.name,
        slug: c.slug || c.name.toLowerCase().replace(/\s+/g, '-'),
        description: c.description || `Browse ${c.name} catalogue`,
        imageUrl: CATEGORY_IMAGES[c.slug] || 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=700&q=80',
      }));
      setCategories(mainCats);
    } catch {
      // Fallback to top-level canonical categories
      setCategories([
        { id: 1, name: 'Medicines', slug: 'medicines', description: 'Essential prescription and OTC medications' },
        { id: 184, name: 'Medical Supplies', slug: 'medical-supplies', description: 'First aid, bandages, and protective gear' },
        { id: 248, name: 'Vitamins & Supplements', slug: 'vitamins-supplements', description: 'Daily vitamins, minerals, and wellness' },
        { id: 207, name: 'Personal Care', slug: 'personal-care', description: 'Hygiene, lotions, and skin health' },
        { id: 228, name: 'Baby Products', slug: 'baby-products', description: 'Diapers, baby care, and infant nutrition' },
        { id: 270, name: 'Medical Devices', slug: 'medical-devices', description: 'Health monitors, meters, and diagnostics' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>All Categories</Text>
        <Text style={styles.subtitle}>
          Explore medicines & health products from our pharmacy database
        </Text>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Search size={18} color="#94a3b8" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search categories..."
          placeholderTextColor="#94a3b8"
          style={styles.searchInput}
        />
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#00966d" />
          <Text style={styles.loadingText}>Loading categories from database...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredCategories}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(insets.bottom + 40, 60) }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.card,
                { opacity: pressed ? 0.92 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] },
              ]}
              onPress={() => router.push({ pathname: '/(tabs)', params: { category: item.slug } })}
            >
              <Image
                source={{
                  uri:
                    CATEGORY_IMAGES[item.slug] ||
                    item.imageUrl ||
                    'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=700&q=80',
                }}
                style={styles.cardImage}
              />
              <View style={styles.cardBody}>
                <View style={styles.cardHeader}>
                  <View style={styles.iconCircle}>
                    <Text style={styles.iconText}>{CATEGORY_ICONS[item.slug] || '💊'}</Text>
                  </View>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                </View>
                <Text style={styles.cardDesc} numberOfLines={2}>
                  {item.description}
                </Text>
              </View>
              <ChevronRight size={18} color="#94a3b8" style={styles.chevron} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginVertical: 12,
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0e3854',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eef2f6',
    overflow: 'hidden',
    padding: 12,
    gap: 14,
  },
  cardImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  cardBody: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e6f7f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0e3854',
    flex: 1,
  },
  cardDesc: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 16,
  },
  chevron: {
    marginLeft: 4,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingBottom: 60,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
  },
});
