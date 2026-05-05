import React from 'react';
import { StyleSheet, Pressable, Alert } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useAuth } from '@/context/AuthContext';
import { User, LogOut, ShieldCheck, Mail } from 'lucide-react-native';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          onPress: async () => {
            await logout();
          },
          style: 'destructive'
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <User size={50} color="#2563eb" />
        </View>
        <Text style={styles.username}>{user?.username || 'User'}</Text>
        <View style={styles.roleBadge}>
          <ShieldCheck size={14} color="#059669" />
          <Text style={styles.roleText}>{user?.role?.toUpperCase() || 'USER'}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Information</Text>
        <View style={styles.infoRow}>
          <Mail size={20} color="#64748b" />
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user?.email || 'No email on file'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.actionSection}>
        <Pressable 
          style={({ pressed }) => [
            styles.logoutButton,
            { opacity: pressed ? 0.8 : 1 }
          ]} 
          onPress={handleLogout}
        >
          <LogOut size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      </View>

      <View style={styles.footer}>
        <Text style={styles.versionText}>MediQuick v1.0.0</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  roleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
    marginLeft: 5,
  },
  section: {
    marginTop: 25,
    backgroundColor: '#ffffff',
    padding: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 20,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  infoTextContainer: {
    marginLeft: 15,
    backgroundColor: 'transparent',
  },
  infoLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },
  infoValue: {
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '500',
    marginTop: 2,
  },
  actionSection: {
    marginTop: 30,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  footer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 30,
    backgroundColor: 'transparent',
  },
  versionText: {
    color: '#94a3b8',
    fontSize: 12,
  },
});
