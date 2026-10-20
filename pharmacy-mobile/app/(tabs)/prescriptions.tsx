import React from 'react';
import {
  StyleSheet,
  ScrollView,
  Pressable,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Text, View } from '@/components/Themed';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  FileText,
  Upload,
  Search,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ClipboardList,
} from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';

export default function PrescriptionsTabScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isStaff = Boolean(user && ['admin', 'manager', 'user'].includes(user.role?.toLowerCase() || ''));

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.rxBadge}>
          <Text style={styles.rxBadgeText}>Rx</Text>
        </View>
        <Text style={styles.title}>Prescription Services</Text>
        <Text style={styles.subtitle}>
          Upload doctor prescriptions for pharmacy review or track dispensing status.
        </Text>
      </View>

      {/* Staff shortcut if logged in */}
      {isStaff && (
        <TouchableOpacity
          style={styles.staffCard}
          onPress={() => router.push('/prescriptions')}
        >
          <View style={styles.staffIconCircle}>
            <ClipboardList size={20} color="#00966d" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.staffTitle}>Staff Prescription Queue</Text>
            <Text style={styles.staffSubtitle}>Review incoming patient scripts and update status</Text>
          </View>
          <ChevronRight size={18} color="#00966d" />
        </TouchableOpacity>
      )}

      {/* Quick Action 1: Upload */}
      <TouchableOpacity
        style={styles.actionCard}
        onPress={() => router.push('/prescription-upload')}
      >
        <View style={[styles.actionIconCircle, { backgroundColor: '#e6f7f2' }]}>
          <Upload size={24} color="#00966d" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>Upload New Prescription</Text>
          <Text style={styles.actionDesc}>
            Take a clear photo of your paper prescription or upload a PDF from your doctor.
          </Text>
          <View style={styles.pillRow}>
            <Text style={styles.pillText}>• Fast verification</Text>
            <Text style={styles.pillText}>• Licensed pharmacists</Text>
          </View>
        </View>
        <ChevronRight size={20} color="#94a3b8" />
      </TouchableOpacity>

      {/* Quick Action 2: Track */}
      <TouchableOpacity
        style={styles.actionCard}
        onPress={() => router.push('/track-order')}
      >
        <View style={[styles.actionIconCircle, { backgroundColor: '#eff6ff' }]}>
          <Search size={24} color="#3b82f6" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>Track Prescription Status</Text>
          <Text style={styles.actionDesc}>
            Check the dispensing progress of your submitted prescription using your order number.
          </Text>
        </View>
        <ChevronRight size={20} color="#94a3b8" />
      </TouchableOpacity>

      {/* How it works banner */}
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>How MediQuick Rx Works</Text>
        <View style={styles.stepRow}>
          <Text style={styles.stepNum}>1</Text>
          <Text style={styles.stepText}>Upload prescription image or PDF securely.</Text>
        </View>
        <View style={styles.stepRow}>
          <Text style={styles.stepNum}>2</Text>
          <Text style={styles.stepText}>Our registered pharmacist reviews medication and dosage.</Text>
        </View>
        <View style={styles.stepRow}>
          <Text style={styles.stepNum}>3</Text>
          <Text style={styles.stepText}>Order confirmed for pickup or swift doorstep delivery.</Text>
        </View>
      </View>
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
    marginBottom: 8,
  },
  rxBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#e6f7f2',
    borderWidth: 1.5,
    borderColor: '#00966d',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  rxBadgeText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#00966d',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0e3854',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 20,
  },
  staffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf9',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    gap: 12,
  },
  staffIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0e3854',
  },
  staffSubtitle: {
    fontSize: 12,
    color: '#00966d',
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eef2f6',
    padding: 16,
    gap: 14,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  actionIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0e3854',
    marginBottom: 4,
  },
  actionDesc: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 17,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#00966d',
  },
  infoBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 6,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0e3854',
    marginBottom: 10,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  stepNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#00966d',
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 20,
  },
  stepText: {
    flex: 1,
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
});
