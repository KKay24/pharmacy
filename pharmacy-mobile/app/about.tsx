import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Stethoscope,
  Bandage,
  Sparkles,
  Heart,
  Bike,
  MessageCircle,
  DollarSign,
  ShieldCheck,
  Smartphone,
  Headphones,
  Store,
  MapPin,
  Clock,
  Phone,
  CheckCircle,
  Zap,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../constants/theme';
import { BrandLogo } from '@/components/ui/BrandLogo';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const SERVICES = [
  {
    title: 'Prescription & OTC Medicines',
    description: 'Browse genuine medicines and submit doctor prescriptions for licensed pharmacist review.',
    Icon: Stethoscope,
  },
  {
    title: 'Medical Supplies & First Aid',
    description: 'Explore diagnostic devices, wound dressings, and emergency first-aid supplies.',
    Icon: Bandage,
  },
  {
    title: 'Personal Care & Wellness',
    description: 'Trusted personal-care products and evidence-informed health resources.',
    Icon: Sparkles,
  },
  {
    title: 'Baby & Maternal Care',
    description: 'Infant formulas, nursing essentials, and pediatric supplements for growing families.',
    Icon: Heart,
  },
  {
    title: 'Doorstep Delivery',
    description: 'Fast, secure doorstep delivery across Lusaka and nearby communities.',
    Icon: Bike,
  },
  {
    title: 'Clinical Consultation',
    description: 'Connect with a certified pharmacist for medication guidance and interaction alerts.',
    Icon: MessageCircle,
  },
];

const VALUES = [
  {
    title: 'Accessible Care',
    description: 'Browse catalog products, calculate costs, and order whenever you need.',
    Icon: DollarSign,
  },
  {
    title: 'Clinical Vetting',
    description: 'All orders and prescriptions undergo thorough safety review before dispensing.',
    Icon: ShieldCheck,
  },
  {
    title: 'Patient Convenience',
    description: 'Seamless order tracking and digital prescription management in one app.',
    Icon: Smartphone,
  },
  {
    title: 'Always Here',
    description: 'Direct WhatsApp and helpline support to address your clinical concerns.',
    Icon: Headphones,
  },
];

export default function AboutScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  const handleDirections = () => {
    Linking.openURL('https://www.google.com/maps/search/?api=1&query=Nationalist+Road%2C+25147');
  };

  const handleCall = () => {
    Linking.openURL('tel:+260977000000');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Brand Hero */}
        <View style={[styles.heroCard, { backgroundColor: colors.primary }]}>
          <View style={{ backgroundColor: '#ffffff', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 20, alignSelf: 'center', marginBottom: 16 }}>
            <BrandLogo size="lg" width={180} height={60} />
          </View>

          <View style={styles.heroBadge}>
            <Stethoscope size={16} color="#ffffff" />
            <Text style={styles.heroBadgeText}>Licensed Community Pharmacy</Text>
          </View>

          <Text style={styles.heroTitle}>MediQuick Pharmacy</Text>
          <Text style={styles.heroSubTitle}>Your trusted partner for everyday health & medicines.</Text>
          <Text style={styles.heroBody}>
            MediQuick brings hospital-grade pharmaceutical care, transparent pricing, and doorstep convenience to every Zambian household.
          </Text>

          <View style={styles.highlightsRow}>
            <View style={styles.highlightPill}>
              <CheckCircle size={14} color="#ffffff" />
              <Text style={styles.highlightText}>100% Genuine</Text>
            </View>
            <View style={styles.highlightPill}>
              <ShieldCheck size={14} color="#ffffff" />
              <Text style={styles.highlightText}>Pharmacy Reviewed</Text>
            </View>
            <View style={styles.highlightPill}>
              <Zap size={14} color="#ffffff" />
              <Text style={styles.highlightText}>Fast Dispatch</Text>
            </View>
          </View>
        </View>

        {/* Mission Statement */}
        <Card style={styles.missionCard}>
          <Text style={[styles.sectionKicker, { color: colors.primary }]}>OUR MISSION</Text>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>
            Making healthcare clearer, safer, and customer-focused.
          </Text>
          <Text style={[styles.missionText, { color: colors.textMuted }]}>
            MediQuick seamlessly integrates mobile shopping with licensed pharmacy operations. Whether dispensing chronic medications or providing pediatric remedies, our pharmacists ensure uncompromising quality and regulatory compliance.
          </Text>
        </Card>

        {/* What We Offer */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>What We Offer</Text>
          <Text style={[styles.sectionSub, { color: colors.textMuted }]}>
            Comprehensive healthcare services designed around your wellbeing.
          </Text>
        </View>

        <View style={styles.servicesGrid}>
          {SERVICES.map((srv) => (
            <Card key={srv.title} style={styles.serviceCard}>
              <View style={[styles.serviceIconCircle, { backgroundColor: colors.primary + '15' }]}>
                <srv.Icon size={22} color={colors.primary} />
              </View>
              <Text style={[styles.serviceTitle, { color: colors.text }]}>{srv.title}</Text>
              <Text style={[styles.serviceDesc, { color: colors.textMuted }]}>{srv.description}</Text>
            </Card>
          ))}
        </View>

        {/* Core Values */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>Why Choose MediQuick</Text>
          <Text style={[styles.sectionSub, { color: colors.textMuted }]}>
            Our clinical standards and operational commitments to you.
          </Text>
        </View>

        <View style={styles.valuesList}>
          {VALUES.map((val) => (
            <Card key={val.title} style={styles.valueCard}>
              <View style={[styles.valueIconCircle, { backgroundColor: colors.primary + '15' }]}>
                <val.Icon size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.valueTitle, { color: colors.text }]}>{val.title}</Text>
                <Text style={[styles.valueDesc, { color: colors.textMuted }]}>{val.description}</Text>
              </View>
            </Card>
          ))}
        </View>

        {/* Store Location & Hours */}
        <Card style={styles.locationCard}>
          <View style={styles.locationHeader}>
            <Store size={24} color={colors.primary} />
            <Text style={[styles.locationHeading, { color: colors.text }]}>Visit Our Pharmacy</Text>
          </View>

          <View style={styles.locationRow}>
            <MapPin size={18} color={colors.textMuted} />
            <Text style={[styles.locationDetail, { color: colors.text }]}>
              Nationalist Road, Plot 25147, Lusaka, Zambia
            </Text>
          </View>

          <View style={styles.locationRow}>
            <Clock size={18} color={colors.textMuted} />
            <Text style={[styles.locationDetail, { color: colors.text }]}>
              Mon – Sat: 8:00 AM – 8:00 PM · Sun: 9:00 AM – 5:00 PM
            </Text>
          </View>

          <View style={styles.locationRow}>
            <Phone size={18} color={colors.textMuted} />
            <Text style={[styles.locationDetail, { color: colors.text }]}>
              +260 97 700 0000 (Consultations & Enquiries)
            </Text>
          </View>

          <View style={styles.locationActions}>
            <Button
              title="Get Directions"
              variant="outline"
              onPress={handleDirections}
              style={{ flex: 1 }}
            />
            <Button
              title="Contact Pharmacy"
              variant="primary"
              onPress={() => router.push('/contact')}
              style={{ flex: 1 }}
            />
          </View>
        </Card>
      </ScrollView>
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
  heroCard: {
    borderRadius: 20,
    padding: 20,
    gap: 8,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  heroBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 4,
  },
  heroSubTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    opacity: 0.95,
  },
  heroBody: {
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 19,
    opacity: 0.9,
    marginTop: 2,
  },
  highlightsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  highlightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  highlightText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  missionCard: {
    padding: 16,
    gap: 6,
  },
  sectionKicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '800',
  },
  sectionSub: {
    fontSize: 13,
    marginTop: 2,
  },
  missionText: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
  },
  sectionHeader: {
    marginTop: 4,
  },
  servicesGrid: {
    gap: 10,
  },
  serviceCard: {
    padding: 14,
    gap: 6,
  },
  serviceIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  serviceTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  serviceDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  valuesList: {
    gap: 10,
  },
  valueCard: {
    flexDirection: 'row',
    padding: 14,
    alignItems: 'flex-start',
    gap: 12,
  },
  valueIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  valueDesc: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  locationCard: {
    padding: 16,
    gap: 12,
    marginTop: 4,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  locationHeading: {
    fontSize: 16,
    fontWeight: '800',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationDetail: {
    fontSize: 13,
    flex: 1,
  },
  locationActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
});
