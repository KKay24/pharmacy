import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet } from 'react-native';
import { Text, View } from '@/components/Themed';
import { API_URL } from '@/api/client';

export default function ModalScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>About MediQuick Mobile</Text>
      <View style={styles.separator} lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />
      
      <Text style={styles.description}>
        This is the mobile extension for your Pharmacy Management System.
        It allows you to manage inventory and record sales directly from your smartphone.
      </Text>

      <View style={styles.infoBox}>
        <Text style={styles.infoLabel}>Connected Backend:</Text>
        <Text style={styles.infoValue}>{API_URL}</Text>
      </View>

      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  separator: {
    marginVertical: 20,
    height: 1,
    width: '80%',
  },
  description: {
    textAlign: 'center',
    fontSize: 16,
    color: '#64748b',
    lineHeight: 24,
    marginBottom: 30,
  },
  infoBox: {
    backgroundColor: '#f1f5f9',
    padding: 15,
    borderRadius: 12,
    width: '100%',
  },
  infoLabel: {
    fontSize: 12,
    color: '#94a3b8',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    color: '#0f172a',
    marginTop: 5,
  }
});
