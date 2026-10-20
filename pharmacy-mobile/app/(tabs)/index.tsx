import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  ScrollView,
  Pressable,
  TouchableOpacity,
  Image,
  TextInput,
  Modal,
  Alert,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Text, View } from '@/components/Themed';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Search,
  Menu,
  X,
  Truck,
  ShieldCheck,
  ChevronRight,
  ShoppingCart,
  Pill,
  Sparkles,
  HeartPulse,
  Baby,
  FileText,
  User,
  LayoutGrid,
  ClipboardList,
  BarChart3,
  Users,
  Building,
  Receipt,
  HelpCircle,
  PhoneCall,
  Info,
  LogIn,
} from 'lucide-react-native';
import apiClient from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 40 - 12) / 2;

interface DatabaseProduct {
  id: number;
  name: string;
  genericName?: string;
  brandName?: string;
  price: number;
  imageUrl?: string;
  category?: string;
  dosage?: string;
  strength?: string;
  description?: string;
  prescriptionRequired?: boolean;
  MainCategory?: { id: number; name: string; slug: string } | null;
}

const CATEGORY_DEFAULT_IMAGES: Record<string, string> = {
  medicines: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400&q=80',
  otc: 'https://images.unsplash.com/photo-1550572017-edd951b55104?auto=format&fit=crop&w=400&q=80',
  vitamins: 'https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?auto=format&fit=crop&w=400&q=80',
  'vitamins-supplements': 'https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?auto=format&fit=crop&w=400&q=80',
  'personal-care': 'https://images.unsplash.com/photo-1556229010-6c3f2c9ca5f8?auto=format&fit=crop&w=400&q=80',
  'baby-products': 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=400&q=80',
  'medical-supplies': 'https://images.unsplash.com/photo-1550572017-edd951b55104?auto=format&fit=crop&w=400&q=80',
  'medical-devices': 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400&q=80',
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string }>();
  const { user } = useAuth();
  const { addToCart, cartCount } = useCart();
  const isStaff = Boolean(user && ['admin', 'manager', 'user'].includes(user.role?.toLowerCase() || ''));

  const [products, setProducts] = useState<DatabaseProduct[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(params.category || 'all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (params.category) {
      setSelectedCategory(params.category);
    }
  }, [params.category]);

  const fetchDatabaseProducts = useCallback(async () => {
    try {
      let url = '/api/products?limit=50';
      if (selectedCategory && selectedCategory !== 'all') {
        if (selectedCategory === 'prescriptions') {
          url += '&prescriptionRequired=true';
        } else {
          url += `&category=${encodeURIComponent(selectedCategory)}`;
        }
      }
      if (search.trim()) {
        url += `&search=${encodeURIComponent(search.trim())}`;
      }

      const res = await apiClient.get(url);
      const rows = res.data?.data || (Array.isArray(res.data) ? res.data : []);

      const formatted: DatabaseProduct[] = rows.map((m: any) => {
        const catSlug = (m.MainCategory?.slug || m.category || 'medicines').toLowerCase();
        return {
          id: m.id,
          name: m.name,
          genericName: m.genericName,
          brandName: m.brandName,
          price: Number(m.price ?? m.basePrice ?? 0),
          imageUrl:
            m.imageUrl ||
            CATEGORY_DEFAULT_IMAGES[catSlug] ||
            'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400&q=80',
          category: catSlug,
          dosage: m.dosage,
          strength: m.strength,
          description: m.description,
          prescriptionRequired: Boolean(m.prescriptionRequired),
          MainCategory: m.MainCategory,
        };
      });

      setProducts(formatted);
    } catch (err) {
      console.warn('Failed to fetch products from database:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory, search]);

  useEffect(() => {
    fetchDatabaseProducts();
  }, [fetchDatabaseProducts]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDatabaseProducts();
  };

  const handleAddToCart = (product: DatabaseProduct) => {
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
      dosage: product.dosage,
      strength: product.strength,
      category: product.category,
      prescriptionRequired: product.prescriptionRequired,
    });

    Alert.alert(
      'Added to Cart',
      `${product.name} (ZMW ${product.price.toFixed(2)}) has been added to your basket.`,
      [
        { text: 'View Cart', onPress: () => router.push('/(tabs)/cart') },
        { text: 'Continue', style: 'cancel' },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ─── Top Header ────────────────────────────────────────────── */}
      <View style={styles.topHeader}>
        <View style={styles.brandRow}>
          <View style={styles.appIcon}>
            <HeartPulse size={22} color="#ffffff" strokeWidth={2.5} />
          </View>
          <Text style={styles.brandTitle}>
            MediQuick <Text style={styles.brandTitleGreen}>Pharmacy</Text>
          </Text>
        </View>

        <TouchableOpacity
          style={styles.menuBtn}
          onPress={() => setMenuOpen(true)}
          accessibilityLabel="Open navigation menu"
        >
          <Menu size={26} color="#0e3854" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00966d" />}
      >
        {/* ─── Search Bar ────────────────────────────────────────── */}
        <View style={styles.searchBar}>
          <Search size={19} color="#94a3b8" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search medicines, OTC, health products..."
            placeholderTextColor="#94a3b8"
            style={styles.searchInput}
          />
          {search ? (
            <Pressable onPress={() => setSearch('')}>
              <X size={16} color="#94a3b8" />
            </Pressable>
          ) : null}
        </View>

        {/* ─── Promo Banner ("Get 10% Off Your First Order!") ────── */}
        <View style={styles.promoBanner}>
          <View style={styles.promoLeft}>
            <Text style={styles.promoTitle}>Get 10% Off</Text>
            <Text style={styles.promoSubtitle}>Your First Order!</Text>
            <View style={styles.codePill}>
              <Text style={styles.codePillText}>code: WELCOME10</Text>
            </View>
          </View>

          {/* Delivery Van & First Aid Graphic */}
          <View style={styles.promoRightGraphic}>
            <View style={styles.vanBackdropCircle} />
            <View style={styles.truckBox}>
              <Truck size={38} color="#ffffff" strokeWidth={1.8} />
              <View style={styles.crossCircle}>
                <Text style={styles.crossSymbol}>+</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ─── Shop by Category (5 Clean Circular Badges) ───────── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Shop by Category</Text>
          {selectedCategory !== 'all' && (
            <TouchableOpacity onPress={() => setSelectedCategory('all')}>
              <Text style={styles.clearCatText}>Show all</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesRow}
        >
          {/* 1. Prescriptions */}
          <TouchableOpacity
            style={styles.categoryItem}
            onPress={() =>
              setSelectedCategory((prev) => (prev === 'prescriptions' ? 'all' : 'prescriptions'))
            }
          >
            <View
              style={[
                styles.categoryCircle,
                selectedCategory === 'prescriptions' && styles.categoryCircleActive,
              ]}
            >
              <Text style={styles.rxIconText}>Rx</Text>
            </View>
            <Text
              style={[
                styles.categoryLabel,
                selectedCategory === 'prescriptions' && styles.categoryLabelActive,
              ]}
            >
              Prescriptions
            </Text>
          </TouchableOpacity>

          {/* 2. OTC */}
          <TouchableOpacity
            style={styles.categoryItem}
            onPress={() =>
              setSelectedCategory((prev) => (prev === 'medicines' ? 'all' : 'medicines'))
            }
          >
            <View
              style={[
                styles.categoryCircle,
                selectedCategory === 'medicines' && styles.categoryCircleActive,
              ]}
            >
              <View style={styles.twoPills}>
                <Pill size={22} color="#00966d" />
              </View>
            </View>
            <Text
              style={[
                styles.categoryLabel,
                selectedCategory === 'medicines' && styles.categoryLabelActive,
              ]}
            >
              OTC
            </Text>
          </TouchableOpacity>

          {/* 3. Vitamins */}
          <TouchableOpacity
            style={styles.categoryItem}
            onPress={() =>
              setSelectedCategory((prev) =>
                prev === 'vitamins-supplements' ? 'all' : 'vitamins-supplements'
              )
            }
          >
            <View
              style={[
                styles.categoryCircle,
                selectedCategory === 'vitamins-supplements' && styles.categoryCircleActive,
              ]}
            >
              <View style={styles.vitaminBottle}>
                <Sparkles size={20} color="#00966d" />
              </View>
            </View>
            <Text
              style={[
                styles.categoryLabel,
                selectedCategory === 'vitamins-supplements' && styles.categoryLabelActive,
              ]}
            >
              Vitamins
            </Text>
          </TouchableOpacity>

          {/* 4. Personal Care */}
          <TouchableOpacity
            style={styles.categoryItem}
            onPress={() =>
              setSelectedCategory((prev) =>
                prev === 'personal-care' ? 'all' : 'personal-care'
              )
            }
          >
            <View
              style={[
                styles.categoryCircle,
                selectedCategory === 'personal-care' && styles.categoryCircleActive,
              ]}
            >
              <Text style={{ fontSize: 22 }}>🧴</Text>
            </View>
            <Text
              style={[
                styles.categoryLabel,
                selectedCategory === 'personal-care' && styles.categoryLabelActive,
              ]}
            >
              Personal Care
            </Text>
          </TouchableOpacity>

          {/* 5. Baby & Child */}
          <TouchableOpacity
            style={styles.categoryItem}
            onPress={() =>
              setSelectedCategory((prev) =>
                prev === 'baby-products' ? 'all' : 'baby-products'
              )
            }
          >
            <View
              style={[
                styles.categoryCircle,
                selectedCategory === 'baby-products' && styles.categoryCircleActive,
              ]}
            >
              <View style={styles.abcBlock}>
                <Text style={styles.abcText}>ABC</Text>
              </View>
            </View>
            <Text
              style={[
                styles.categoryLabel,
                selectedCategory === 'baby-products' && styles.categoryLabelActive,
              ]}
            >
              Baby & Child
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* ─── Popular Products from Database ───────────────────── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Popular Products</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/categories')}>
            <Text style={styles.seeAllText}>See all ({products.length})</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#00966d" />
            <Text style={styles.loadingText}>Fetching catalogue from pharmacy database...</Text>
          </View>
        ) : products.length === 0 ? (
          <View style={styles.emptyProducts}>
            <Text style={styles.emptyProductsTitle}>No products found</Text>
            <Text style={styles.emptyProductsSubtitle}>
              {search
                ? `No medicines matching "${search}".`
                : 'No products currently listed in this category.'}
            </Text>
          </View>
        ) : (
          <View style={styles.productsGrid}>
            {products.map((item) => (
              <View key={item.id} style={styles.productCard}>
                {/* Product Image */}
                <TouchableOpacity
                  style={styles.productImageWrap}
                  onPress={() => router.push({ pathname: '/product/[id]', params: { id: String(item.id) } })}
                >
                  <Image source={{ uri: item.imageUrl }} style={styles.productImage} resizeMode="contain" />
                  {item.prescriptionRequired && (
                    <View style={styles.rxRequiredBadge}>
                      <Text style={styles.rxRequiredText}>Rx Required</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Product Title & Real Price */}
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/product/[id]', params: { id: String(item.id) } })}
                >
                  <Text style={styles.productName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.dosage || item.strength ? (
                    <Text style={styles.productDosage} numberOfLines={1}>
                      {[item.dosage, item.strength].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                  <Text style={styles.productPrice}>ZMW {item.price.toFixed(2)}</Text>
                </TouchableOpacity>

                {/* Add to Cart button */}
                <TouchableOpacity
                  style={styles.addToCartBtn}
                  onPress={() => handleAddToCart(item)}
                >
                  <Text style={styles.addToCartText}>Add to Cart</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ─── Slide-In Navigation Drawer Modal ────────────────────── */}
      <Modal visible={menuOpen} animationType="slide" transparent>
        <View style={styles.menuOverlay}>
          <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)} />
          <View style={[styles.menuSheet, { paddingTop: insets.top + 10 }]}>
            {/* Sheet Header */}
            <View style={styles.menuSheetHeader}>
              <View style={styles.brandRow}>
                <View style={styles.appIconSmall}>
                  <HeartPulse size={18} color="#ffffff" />
                </View>
                <Text style={styles.brandTitle}>
                  MediQuick <Text style={styles.brandTitleGreen}>Pharmacy</Text>
                </Text>
              </View>
              <TouchableOpacity onPress={() => setMenuOpen(false)}>
                <X size={22} color="#0e3854" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.menuList}>
              {/* Customer Links */}
              <Text style={styles.menuSectionTitle}>CUSTOMER STORE</Text>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  router.push('/(tabs)');
                }}
              >
                <Pill size={18} color="#00966d" />
                <Text style={styles.menuItemText}>Store Home</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  router.push('/(tabs)/categories');
                }}
              >
                <LayoutGrid size={18} color="#00966d" />
                <Text style={styles.menuItemText}>Shop by Category</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  router.push('/(tabs)/cart');
                }}
              >
                <ShoppingCart size={18} color="#00966d" />
                <Text style={styles.menuItemText}>My Cart ({cartCount})</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  router.push('/prescription-upload');
                }}
              >
                <FileText size={18} color="#00966d" />
                <Text style={styles.menuItemText}>Upload Prescription</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  router.push('/track-order');
                }}
              >
                <Truck size={18} color="#00966d" />
                <Text style={styles.menuItemText}>Track Order</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  router.push('/health-wellness');
                }}
              >
                <Sparkles size={18} color="#00966d" />
                <Text style={styles.menuItemText}>Health & Wellness</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  router.push('/contact');
                }}
              >
                <PhoneCall size={18} color="#00966d" />
                <Text style={styles.menuItemText}>Contact & Support</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  router.push('/about');
                }}
              >
                <Info size={18} color="#00966d" />
                <Text style={styles.menuItemText}>About MediQuick</Text>
              </TouchableOpacity>

              {/* Staff Operations Section */}
              <View style={styles.divider} />
              <Text style={styles.menuSectionTitle}>
                {isStaff ? 'STAFF OPERATIONS' : 'STAFF ACCESS'}
              </Text>

              {isStaff ? (
                <>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      setMenuOpen(false);
                      router.push('/operations');
                    }}
                  >
                    <ClipboardList size={18} color="#0e3854" />
                    <Text style={[styles.menuItemText, { fontWeight: '700' }]}>Operations Command Center</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      setMenuOpen(false);
                      router.push('/pos');
                    }}
                  >
                    <Receipt size={18} color="#0e3854" />
                    <Text style={styles.menuItemText}>Point of Sale (POS)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      setMenuOpen(false);
                      router.push('/inventory');
                    }}
                  >
                    <Pill size={18} color="#0e3854" />
                    <Text style={styles.menuItemText}>Stock & Batches</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      setMenuOpen(false);
                      router.push('/orders');
                    }}
                  >
                    <Truck size={18} color="#0e3854" />
                    <Text style={styles.menuItemText}>Online Orders Queue</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      setMenuOpen(false);
                      router.push('/prescriptions');
                    }}
                  >
                    <FileText size={18} color="#0e3854" />
                    <Text style={styles.menuItemText}>Prescription Approvals</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      setMenuOpen(false);
                      router.push('/reports');
                    }}
                  >
                    <BarChart3 size={18} color="#0e3854" />
                    <Text style={styles.menuItemText}>Sales Reports & Analytics</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.signInCard}
                  onPress={() => {
                    setMenuOpen(false);
                    router.push('/(auth)/login');
                  }}
                >
                  <LogIn size={18} color="#00966d" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.signInCardTitle}>Staff Sign In</Text>
                    <Text style={styles.signInCardSub}>Access POS, inventory, orders, and reports</Text>
                  </View>
                  <ChevronRight size={16} color="#00966d" />
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  appIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#00966d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appIconSmall: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#00966d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0e3854',
  },
  brandTitleGreen: {
    color: '#00966d',
  },
  menuBtn: {
    padding: 6,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    marginVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0e3854',
  },
  promoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#008375',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginVertical: 6,
    overflow: 'hidden',
  },
  promoLeft: {
    flex: 1,
    zIndex: 2,
  },
  promoTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  promoSubtitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 2,
  },
  codePill: {
    backgroundColor: 'rgba(0, 35, 25, 0.45)',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 12,
  },
  codePillText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  promoRightGraphic: {
    width: 100,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  vanBackdropCircle: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  truckBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  crossCircle: {
    position: 'absolute',
    top: 6,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#00966d',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  crossSymbol: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 13,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0e3854',
  },
  clearCatText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00966d',
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00966d',
  },
  categoriesRow: {
    gap: 16,
    paddingVertical: 4,
  },
  categoryItem: {
    alignItems: 'center',
    width: 66,
  },
  categoryCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#e6f7f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  categoryCircleActive: {
    borderColor: '#00966d',
    backgroundColor: '#d1fae5',
  },
  rxIconText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#00966d',
  },
  twoPills: {
    transform: [{ rotate: '45deg' }],
  },
  vitaminBottle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  abcBlock: {
    backgroundColor: '#00966d',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  abcText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
    lineHeight: 14,
  },
  categoryLabelActive: {
    color: '#00966d',
    fontWeight: '700',
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  productCard: {
    width: CARD_WIDTH,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eef2f6',
    padding: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 5,
  },
  productImageWrap: {
    width: '100%',
    height: 110,
    borderRadius: 12,
    backgroundColor: '#f4f7f9',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 8,
  },
  productImage: {
    width: '80%',
    height: '80%',
  },
  rxRequiredBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: '#fff0eb',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  rxRequiredText: {
    color: '#ff6b35',
    fontSize: 10,
    fontWeight: '800',
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0e3854',
    marginBottom: 2,
  },
  productDosage: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0e3854',
    marginBottom: 10,
  },
  addToCartBtn: {
    backgroundColor: '#00966d',
    borderRadius: 10,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addToCartText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
  },
  emptyProducts: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyProductsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0e3854',
  },
  emptyProductsSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(14, 56, 84, 0.4)',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  menuSheet: {
    width: '80%',
    backgroundColor: '#ffffff',
    height: '100%',
    paddingHorizontal: 20,
    elevation: 12,
  },
  menuSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 10,
  },
  menuList: {
    paddingBottom: 40,
    gap: 4,
  },
  menuSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.8,
    marginTop: 14,
    marginBottom: 6,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0e3854',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 10,
  },
  signInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f0fdf9',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    marginTop: 6,
  },
  signInCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#00966d',
  },
  signInCardSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
});
