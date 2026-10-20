import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Pill,
  Heart,
  AlertCircle,
  FileText,
  ShieldCheck,
  Truck,
  Package,
  Minus,
  Plus,
  ShoppingCart,
  CheckCircle,
} from 'lucide-react-native';
import { useTheme } from '../../constants/theme';
import apiClient from '../../api/client';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';

interface ProductDetail {
  id: number;
  name: string;
  genericName?: string;
  brandName?: string;
  category?: string;
  description?: string;
  dosage?: string;
  strength?: string;
  manufacturer?: string;
  sideEffects?: string;
  storage?: string;
  price: number;
  prescriptionRequired?: boolean;
  isCustomerVisible?: boolean;
  imageUrl?: string;
  Batches?: any[];
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [activeTab, setActiveTab] = useState<'desc' | 'storage' | 'sideEffects'>('desc');
  const [isWished, setIsWished] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchProduct = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.get(`/api/products/${id}`);
        setProduct(res.data);
      } catch (e: any) {
        // Fallback to inventory endpoint
        try {
          const invRes = await apiClient.get(`/api/inventory/${id}`);
          const invData = invRes.data;
          const batchPrice = invData.Batches?.[0]?.sellingPrice || invData.price || 0;
          setProduct({ ...invData, price: Number(batchPrice) });
        } catch (invErr: any) {
          setError(e.response?.data?.error || 'Product details could not be found.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.mutedText, { color: colors.textMuted }]}>Loading medicine info...</Text>
      </SafeAreaView>
    );
  }

  if (error || !product) {
    return (
      <SafeAreaView style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <AlertCircle size={56} color={colors.danger} />
        <Text style={[styles.errorTitle, { color: colors.text }]}>Product Not Found</Text>
        <Text style={[styles.mutedText, { color: colors.textMuted, textAlign: 'center' }]}>
          {error || 'The requested medication could not be located in our inventory.'}
        </Text>
        <Button
          title="Return to Catalog"
          variant="primary"
          onPress={() => router.back()}
          style={{ marginTop: 16 }}
        />
      </SafeAreaView>
    );
  }

  const handleAddToCart = () => {
    Alert.alert(
      'Added to Cart',
      `${product.name} (×${qty}) has been added to your shopping cart.`,
      [
        { text: 'Keep Browsing' },
        { text: 'View Cart', onPress: () => router.push('/(tabs)') },
      ]
    );
  };

  const handleUploadRx = () => {
    router.push('/prescription-upload');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Product Visual Container */}
        <View style={[styles.imageCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {product.imageUrl ? (
            <Image source={{ uri: product.imageUrl }} style={styles.productImage} resizeMode="contain" />
          ) : (
            <View style={[styles.iconCircle, { backgroundColor: colors.primary + '15' }]}>
              <Pill size={54} color={colors.primary} />
            </View>
          )}

          <TouchableOpacity
            style={[styles.wishlistBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setIsWished(!isWished)}
          >
            <Heart
              size={22}
              color={isWished ? colors.danger : colors.textMuted}
              fill={isWished ? colors.danger : 'none'}
            />
          </TouchableOpacity>
        </View>

        {/* Category & Title */}
        <View style={styles.titleSection}>
          <Text style={[styles.categoryTag, { color: colors.primary }]}>
            {product.category || 'Pharmacy Healthcare'}
          </Text>
          <Text style={[styles.productName, { color: colors.text }]}>{product.name}</Text>
          {product.genericName && (
            <Text style={[styles.genericName, { color: colors.textMuted }]}>
              Generic: {product.genericName}
            </Text>
          )}

          {/* Badges */}
          <View style={styles.badgeRow}>
            {product.prescriptionRequired ? (
              <Badge
                label="Prescription Required"
                variant="danger"
                icon={<FileText size={12} color={colors.danger} />}
              />
            ) : (
              <Badge
                label="Over The Counter (OTC)"
                variant="success"
                icon={<CheckCircle size={12} color={colors.success} />}
              />
            )}
            {product.strength && <Badge label={product.strength} variant="primary" />}
            {product.dosage && <Badge label={product.dosage} variant="neutral" />}
          </View>

          {/* Price */}
          <View style={styles.priceRow}>
            <Text style={[styles.priceCurrency, { color: colors.primary }]}>ZMW</Text>
            <Text style={[styles.priceValue, { color: colors.text }]}>
              {Number(product.price || 0).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Prescription Required Advisory */}
        {product.prescriptionRequired ? (
          <Card style={[styles.rxCard, { backgroundColor: colors.danger + '10', borderColor: colors.danger + '30' }]}>
            <View style={styles.rxCardHeader}>
              <FileText size={24} color={colors.danger} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rxTitle, { color: colors.danger }]}>
                  Valid Prescription Required
                </Text>
                <Text style={[styles.rxSub, { color: colors.text }]}>
                  In compliance with Zambian pharmaceutical regulations, our licensed pharmacist must inspect a doctor's prescription before dispensing.
                </Text>
              </View>
            </View>
            <Button
              title="Upload Prescription Photo"
              variant="danger"
              leftIcon={<FileText size={16} color="#ffffff" />}
              onPress={handleUploadRx}
              style={{ marginTop: 12 }}
            />
          </Card>
        ) : (
          /* Quantity selector & Add to Cart */
          <Card style={styles.actionCard}>
            <View style={styles.qtyControlRow}>
              <Text style={[styles.qtyLabel, { color: colors.text }]}>Select Quantity</Text>
              <View style={[styles.stepper, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => setQty((q) => Math.max(1, q - 1))}
                >
                  <Minus size={18} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.qtyNumber, { color: colors.text }]}>{qty}</Text>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => setQty((q) => q + 1)}
                >
                  <Plus size={18} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>

            <Button
              title={`Add ${qty} to Cart (ZMW ${(Number(product.price || 0) * qty).toFixed(2)})`}
              variant="primary"
              size="lg"
              leftIcon={<ShoppingCart size={18} color="#ffffff" />}
              onPress={handleAddToCart}
            />
          </Card>
        )}

        {/* Clinical Tabs: Description, Storage, Side Effects */}
        <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.tabItem,
              activeTab === 'desc' && [styles.activeTabItem, { borderBottomColor: colors.primary }],
            ]}
            onPress={() => setActiveTab('desc')}
          >
            <Text
              style={[
                styles.tabLabel,
                { color: activeTab === 'desc' ? colors.primary : colors.textMuted },
              ]}
            >
              Description
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabItem,
              activeTab === 'storage' && [styles.activeTabItem, { borderBottomColor: colors.primary }],
            ]}
            onPress={() => setActiveTab('storage')}
          >
            <Text
              style={[
                styles.tabLabel,
                { color: activeTab === 'storage' ? colors.primary : colors.textMuted },
              ]}
            >
              Storage
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabItem,
              activeTab === 'sideEffects' && [styles.activeTabItem, { borderBottomColor: colors.primary }],
            ]}
            onPress={() => setActiveTab('sideEffects')}
          >
            <Text
              style={[
                styles.tabLabel,
                { color: activeTab === 'sideEffects' ? colors.primary : colors.textMuted },
              ]}
            >
              Side Effects
            </Text>
          </TouchableOpacity>
        </View>

        <Card style={styles.tabContentCard}>
          {activeTab === 'desc' && (
            <View style={{ gap: 8 }}>
              <Text style={[styles.contentText, { color: colors.text }]}>
                {product.description || 'Verified pharmacy medication dispensed by MediQuick licensed pharmacists.'}
              </Text>
              {product.manufacturer && (
                <Text style={[styles.metaText, { color: colors.textMuted }]}>
                  Manufacturer: {product.manufacturer}
                </Text>
              )}
            </View>
          )}

          {activeTab === 'storage' && (
            <Text style={[styles.contentText, { color: colors.text }]}>
              {product.storage ||
                'Store below 25°C in a cool, dry place away from direct sunlight and moisture. Keep safely out of reach of children.'}
            </Text>
          )}

          {activeTab === 'sideEffects' && (
            <Text style={[styles.contentText, { color: colors.text }]}>
              {product.sideEffects ||
                'Always read the package leaflet before use. In case of unexpected allergic symptoms, discontinue use immediately and consult your physician.'}
            </Text>
          )}
        </Card>

        {/* Quality Guarantees */}
        <View style={styles.guaranteeRow}>
          <View style={styles.guaranteeItem}>
            <ShieldCheck size={20} color={colors.primary} />
            <Text style={[styles.guaranteeText, { color: colors.textMuted }]}>100% Genuine</Text>
          </View>
          <View style={styles.guaranteeItem}>
            <Truck size={20} color={colors.primary} />
            <Text style={[styles.guaranteeText, { color: colors.textMuted }]}>Fast Delivery</Text>
          </View>
          <View style={styles.guaranteeItem}>
            <Package size={20} color={colors.primary} />
            <Text style={[styles.guaranteeText, { color: colors.textMuted }]}>Sealed Pack</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  imageCard: {
    height: 240,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  productImage: {
    width: '80%',
    height: '80%',
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wishlistBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleSection: {
    gap: 6,
  },
  categoryTag: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  productName: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  genericName: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 8,
  },
  priceCurrency: {
    fontSize: 16,
    fontWeight: '700',
  },
  priceValue: {
    fontSize: 28,
    fontWeight: '900',
  },
  rxCard: {
    padding: 16,
    borderWidth: 1,
    borderRadius: 16,
  },
  rxCardHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  rxTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  rxSub: {
    fontSize: 12,
    lineHeight: 18,
  },
  actionCard: {
    padding: 16,
    gap: 16,
  },
  qtyControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qtyLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  stepBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyNumber: {
    minWidth: 36,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginTop: 8,
  },
  tabItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabItem: {
    borderBottomWidth: 2,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  tabContentCard: {
    padding: 16,
  },
  contentText: {
    fontSize: 14,
    lineHeight: 22,
  },
  metaText: {
    fontSize: 13,
    marginTop: 6,
  },
  guaranteeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
  },
  guaranteeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  guaranteeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 8,
  },
  mutedText: {
    fontSize: 14,
    marginTop: 4,
  },
});
