import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Linking,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Phone, Mail, MapPin, CheckCheck } from 'lucide-react-native';
import { useTheme } from '../constants/theme';
import { API_BASE_URL } from '../constants/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const INQUIRY_TYPES = [
  'Help finding product',
  'Order issue',
  'Prescription query',
  'Delivery question',
  'Return/refund',
  'Other',
];

export default function ContactScreen() {
  const { colors, isDark } = useTheme();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [inquiryType, setInquiryType] = useState(INQUIRY_TYPES[0]);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Required Field', 'Please provide your full name.');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Required Field', 'Please provide a contact phone number.');
      return;
    }
    if (!message.trim()) {
      Alert.alert('Required Field', 'Please describe your inquiry or question.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/support/inquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          inquiryType,
          message: message.trim(),
        }),
      });

      if (res.ok) {
        setSent(true);
      } else {
        const errJson = await res.json().catch(() => ({}));
        Alert.alert('Error', errJson.error || 'Failed to submit inquiry.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Network connection failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDial = () => {
    Linking.openURL('tel:+260977000000');
  };

  const handleEmail = () => {
    Linking.openURL('mailto:pharmacy@mediquick.co.zm');
  };

  const handleDirections = () => {
    Linking.openURL('https://www.google.com/maps/search/?api=1&query=Nationalist+Road%2C+25147');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Get In Touch</Text>
            <Text style={[styles.headerSub, { color: colors.textMuted }]}>
              Have questions about your prescription, delivery, or finding medicine? Our clinical team is here to assist you.
            </Text>
          </View>

          {/* Contact Direct Channels */}
          <View style={styles.channelGrid}>
            <Card style={styles.channelCard}>
              <TouchableOpacity style={styles.channelBtn} onPress={handleDial}>
                <View style={[styles.channelIconCircle, { backgroundColor: colors.primary + '15' }]}>
                  <Phone size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.channelTitle, { color: colors.text }]}>Phone & WhatsApp</Text>
                  <Text style={[styles.channelValue, { color: colors.primary }]}>+260 97 700 0000</Text>
                  <Text style={[styles.channelHours, { color: colors.textMuted }]}>Mon–Sat, 8 AM – 8 PM</Text>
                </View>
              </TouchableOpacity>
            </Card>

            <Card style={styles.channelCard}>
              <TouchableOpacity style={styles.channelBtn} onPress={handleEmail}>
                <View style={[styles.channelIconCircle, { backgroundColor: colors.primary + '15' }]}>
                  <Mail size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.channelTitle, { color: colors.text }]}>Pharmacy Email</Text>
                  <Text style={[styles.channelValue, { color: colors.primary }]}>pharmacy@mediquick.co.zm</Text>
                  <Text style={[styles.channelHours, { color: colors.textMuted }]}>Replies within 2–4 hours</Text>
                </View>
              </TouchableOpacity>
            </Card>

            <Card style={styles.channelCard}>
              <TouchableOpacity style={styles.channelBtn} onPress={handleDirections}>
                <View style={[styles.channelIconCircle, { backgroundColor: colors.primary + '15' }]}>
                  <MapPin size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.channelTitle, { color: colors.text }]}>Licensed Store Location</Text>
                  <Text style={[styles.channelValue, { color: colors.primary }]}>Nationalist Road, 25147</Text>
                  <Text style={[styles.channelHours, { color: colors.textMuted }]}>Open Mon–Sun · Tap for Maps</Text>
                </View>
              </TouchableOpacity>
            </Card>
          </View>

          {/* Contact Form */}
          {sent ? (
            <Card style={styles.sentCard}>
              <CheckCheck size={56} color={colors.success} />
              <Text style={[styles.sentTitle, { color: colors.text }]}>Message Delivered!</Text>
              <Text style={[styles.sentSub, { color: colors.textMuted }]}>
                Thank you for contacting MediQuick. Our pharmacist will review your inquiry and follow up within 2 to 4 business hours.
              </Text>
              <Button
                title="Send Another Inquiry"
                variant="primary"
                onPress={() => {
                  setSent(false);
                  setName('');
                  setPhone('');
                  setEmail('');
                  setMessage('');
                }}
                style={{ marginTop: 12 }}
              />
            </Card>
          ) : (
            <Card style={styles.formCard}>
              <Text style={[styles.formHeading, { color: colors.text }]}>Send Us a Message</Text>

              <Text style={[styles.inputLabel, { color: colors.text }]}>Your Name *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
                placeholder="e.g. John Banda"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
              />

              <Text style={[styles.inputLabel, { color: colors.text }]}>Phone Number *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
                placeholder="+260 97 1234567"
                placeholderTextColor={colors.textMuted}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />

              <Text style={[styles.inputLabel, { color: colors.text }]}>Email Address</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
                placeholder="john@email.com"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={[styles.inputLabel, { color: colors.text }]}>Inquiry Subject</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                {INQUIRY_TYPES.map((type) => {
                  const selected = inquiryType === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.chip,
                        {
                          borderColor: selected ? colors.primary : colors.border,
                          backgroundColor: selected ? colors.primary + '15' : colors.surfaceMuted,
                        },
                      ]}
                      onPress={() => setInquiryType(type)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          {
                            color: selected ? colors.primary : colors.text,
                            fontWeight: selected ? '700' : '500',
                          },
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={[styles.inputLabel, { color: colors.text, marginTop: 12 }]}>Message *</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
                placeholder="How can our clinical team help you today?"
                placeholderTextColor={colors.textMuted}
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={4}
              />

              <Button
                title="Send Message"
                variant="primary"
                size="lg"
                icon="send"
                onPress={handleSubmit}
                loading={submitting}
                style={{ marginTop: 16 }}
              />
            </Card>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
  header: {
    gap: 6,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 13,
    lineHeight: 19,
  },
  channelGrid: {
    gap: 10,
  },
  channelCard: {
    padding: 12,
  },
  channelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  channelIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  channelValue: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 1,
  },
  channelHours: {
    fontSize: 11,
    marginTop: 2,
  },
  formCard: {
    padding: 16,
  },
  formHeading: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  textArea: {
    minHeight: 90,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  chipsRow: {
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
  },
  sentCard: {
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  sentTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  sentSub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
});
