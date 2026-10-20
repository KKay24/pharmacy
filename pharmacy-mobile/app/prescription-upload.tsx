import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  UploadCloud,
  Search,
  CheckCircle,
  Camera,
  ChevronRight,
  Truck,
  Store,
  Send,
  AlertCircle,
} from 'lucide-react-native';
import { useTheme } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';

export default function PrescriptionUploadScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'upload' | 'track'>('upload');

  // Form states
  const [patientName, setPatientName] = useState(user?.username || '');
  const [patientPhone, setPatientPhone] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [medications, setMedications] = useState('');
  const [deliveryPreference, setDeliveryPreference] = useState<'delivery' | 'pickup'>('delivery');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [fileSimulated, setFileSimulated] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ prescriptionNumber: string } | null>(null);

  // Track tab states
  const [trackRef, setTrackRef] = useState('');
  const [tracking, setTracking] = useState(false);
  const [trackResult, setTrackResult] = useState<any | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!patientName.trim()) {
      Alert.alert('Required Field', 'Please provide the patient full name.');
      return;
    }
    if (!patientPhone.trim()) {
      Alert.alert('Required Field', 'Please provide a contact phone number for pharmacist consultation.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        patientName: patientName.trim(),
        patientPhone: patientPhone.trim(),
        doctorName: doctorName.trim() || undefined,
        medications: medications.trim() || undefined,
        deliveryPreference,
        deliveryAddress: deliveryPreference === 'delivery' ? deliveryAddress.trim() : undefined,
        notes: notes.trim() || undefined,
        fileName: fileSimulated ? 'prescription_scan.jpg' : undefined,
      };

      const res = await apiClient.post('/api/prescriptions/upload', payload);
      const data = res.data;
      const rxNum =
        data.prescriptionNumber ||
        data.referenceNumber ||
        `RX-${Math.floor(100000 + Math.random() * 900000)}`;
      setSubmitResult({ prescriptionNumber: rxNum });
    } catch (e: any) {
      Alert.alert(
        'Submission Error',
        e.response?.data?.error || e.message || 'Failed to submit prescription.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleTrack = async () => {
    if (!trackRef.trim()) {
      setTrackError('Please enter your prescription tracking reference.');
      return;
    }

    setTracking(true);
    setTrackError(null);
    setTrackResult(null);

    try {
      const res = await apiClient.get(
        `/api/prescriptions/track/${encodeURIComponent(trackRef.trim())}`
      );
      setTrackResult(res.data);
    } catch (e: any) {
      setTrackError(
        e.response?.data?.error ||
          e.message ||
          'No prescription found matching that reference code.'
      );
    } finally {
      setTracking(false);
    }
  };

  const resetForm = () => {
    setSubmitResult(null);
    setPatientName(user?.username || '');
    setPatientPhone('');
    setDoctorName('');
    setMedications('');
    setDeliveryAddress('');
    setNotes('');
    setFileSimulated(false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      {/* Segmented Top Tabs */}
      <View style={[styles.topTabs, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === 'upload' && [styles.tabBtnActive, { borderBottomColor: colors.primary }],
          ]}
          onPress={() => setActiveTab('upload')}
        >
          <UploadCloud
            size={18}
            color={activeTab === 'upload' ? colors.primary : colors.textMuted}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'upload' ? colors.primary : colors.textMuted },
            ]}
          >
            Upload Prescription
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === 'track' && [styles.tabBtnActive, { borderBottomColor: colors.primary }],
          ]}
          onPress={() => setActiveTab('track')}
        >
          <Search
            size={18}
            color={activeTab === 'track' ? colors.primary : colors.textMuted}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'track' ? colors.primary : colors.textMuted },
            ]}
          >
            Track Status
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {activeTab === 'upload' ? (
            submitResult ? (
              /* Success Banner */
              <Card style={styles.successCard}>
                <CheckCircle size={64} color={colors.success} />
                <Text style={[styles.successTitle, { color: colors.text }]}>
                  Prescription Received!
                </Text>
                <Text style={[styles.successSub, { color: colors.textMuted }]}>
                  Our licensed pharmacist will review the medication request, check inventory, and contact you via phone or WhatsApp.
                </Text>

                <View style={[styles.refBox, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}>
                  <Text style={[styles.refBoxLabel, { color: colors.textMuted }]}>
                    Tracking Reference
                  </Text>
                  <Text style={[styles.refBoxCode, { color: colors.primary }]}>
                    {submitResult.prescriptionNumber}
                  </Text>
                </View>

                <View style={styles.successActions}>
                  <Button
                    title="Track This Prescription"
                    variant="primary"
                    leftIcon={<Search size={16} color="#ffffff" />}
                    onPress={() => {
                      setTrackRef(submitResult.prescriptionNumber);
                      setActiveTab('track');
                      setSubmitResult(null);
                    }}
                  />
                  <Button
                    title="Submit Another"
                    variant="outline"
                    onPress={resetForm}
                  />
                </View>
              </Card>
            ) : (
              /* Upload Form */
              <View style={{ gap: 16 }}>
                {/* How it works banner */}
                <View style={[styles.workflowCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.workflowStep}>
                    <View style={[styles.stepNum, { backgroundColor: colors.primary }]}>
                      <Text style={styles.stepNumText}>1</Text>
                    </View>
                    <Text style={[styles.stepDesc, { color: colors.text }]}>Upload Photo</Text>
                  </View>
                  <ChevronRight size={16} color={colors.textMuted} />
                  <View style={styles.workflowStep}>
                    <View style={[styles.stepNum, { backgroundColor: colors.primary }]}>
                      <Text style={styles.stepNumText}>2</Text>
                    </View>
                    <Text style={[styles.stepDesc, { color: colors.text }]}>Pharmacist Review</Text>
                  </View>
                  <ChevronRight size={16} color={colors.textMuted} />
                  <View style={styles.workflowStep}>
                    <View style={[styles.stepNum, { backgroundColor: colors.primary }]}>
                      <Text style={styles.stepNumText}>3</Text>
                    </View>
                    <Text style={[styles.stepDesc, { color: colors.text }]}>Doorstep Delivery</Text>
                  </View>
                </View>

                {/* Patient Information */}
                <Card style={styles.formCard}>
                  <Text style={[styles.sectionHeading, { color: colors.text }]}>
                    Patient Information
                  </Text>

                  <Text style={[styles.inputLabel, { color: colors.text }]}>Patient Full Name *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
                    placeholder="e.g. Mwamba Chanda"
                    placeholderTextColor={colors.textMuted}
                    value={patientName}
                    onChangeText={setPatientName}
                  />

                  <Text style={[styles.inputLabel, { color: colors.text }]}>Contact Phone Number *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
                    placeholder="+260 97 1234567"
                    placeholderTextColor={colors.textMuted}
                    value={patientPhone}
                    onChangeText={setPatientPhone}
                    keyboardType="phone-pad"
                  />

                  <Text style={[styles.inputLabel, { color: colors.text }]}>Prescribing Doctor / Clinic</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
                    placeholder="e.g. Dr. Phiri / UTH Lusaka"
                    placeholderTextColor={colors.textMuted}
                    value={doctorName}
                    onChangeText={setDoctorName}
                  />

                  <Text style={[styles.inputLabel, { color: colors.text }]}>Medication Names (if legible)</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
                    placeholder="e.g. Amoxicillin 500mg, Paracetamol"
                    placeholderTextColor={colors.textMuted}
                    value={medications}
                    onChangeText={setMedications}
                  />
                </Card>

                {/* Prescription Image Upload Area */}
                <Card style={styles.formCard}>
                  <Text style={[styles.sectionHeading, { color: colors.text }]}>
                    Prescription Document / Photo
                  </Text>

                  <TouchableOpacity
                    style={[
                      styles.uploadZone,
                      {
                        backgroundColor: fileSimulated ? colors.success + '10' : colors.surfaceMuted,
                        borderColor: fileSimulated ? colors.success : colors.border,
                      },
                    ]}
                    onPress={() => setFileSimulated(!fileSimulated)}
                  >
                    {fileSimulated ? (
                      <CheckCircle size={40} color={colors.success} />
                    ) : (
                      <Camera size={40} color={colors.primary} />
                    )}
                    <Text style={[styles.uploadTitle, { color: colors.text }]}>
                      {fileSimulated ? 'prescription_scan_attached.jpg' : 'Take Photo or Choose File'}
                    </Text>
                    <Text style={[styles.uploadSub, { color: colors.textMuted }]}>
                      {fileSimulated
                        ? 'Tap to replace image'
                        : 'Capture legible picture of the written prescription (JPG, PNG, PDF)'}
                    </Text>
                  </TouchableOpacity>
                </Card>

                {/* Delivery Options */}
                <Card style={styles.formCard}>
                  <Text style={[styles.sectionHeading, { color: colors.text }]}>
                    Fulfilment Preference
                  </Text>

                  <View style={styles.radioRow}>
                    <TouchableOpacity
                      style={[
                        styles.radioChip,
                        {
                          borderColor: deliveryPreference === 'delivery' ? colors.primary : colors.border,
                          backgroundColor: deliveryPreference === 'delivery' ? colors.primary + '15' : colors.surfaceMuted,
                        },
                      ]}
                      onPress={() => setDeliveryPreference('delivery')}
                    >
                      <Truck
                        size={18}
                        color={deliveryPreference === 'delivery' ? colors.primary : colors.textMuted}
                      />
                      <Text
                        style={[
                          styles.radioText,
                          {
                            color: deliveryPreference === 'delivery' ? colors.primary : colors.text,
                            fontWeight: deliveryPreference === 'delivery' ? '700' : '500',
                          },
                        ]}
                      >
                        Home Delivery
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.radioChip,
                        {
                          borderColor: deliveryPreference === 'pickup' ? colors.primary : colors.border,
                          backgroundColor: deliveryPreference === 'pickup' ? colors.primary + '15' : colors.surfaceMuted,
                        },
                      ]}
                      onPress={() => setDeliveryPreference('pickup')}
                    >
                      <Store
                        size={18}
                        color={deliveryPreference === 'pickup' ? colors.primary : colors.textMuted}
                      />
                      <Text
                        style={[
                          styles.radioText,
                          {
                            color: deliveryPreference === 'pickup' ? colors.primary : colors.text,
                            fontWeight: deliveryPreference === 'pickup' ? '700' : '500',
                          },
                        ]}
                      >
                        In-Store Pickup
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {deliveryPreference === 'delivery' && (
                    <>
                      <Text style={[styles.inputLabel, { color: colors.text, marginTop: 12 }]}>
                        Delivery Address
                      </Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
                        placeholder="House number, street, area, town"
                        placeholderTextColor={colors.textMuted}
                        value={deliveryAddress}
                        onChangeText={setDeliveryAddress}
                      />
                    </>
                  )}

                  <Text style={[styles.inputLabel, { color: colors.text, marginTop: 12 }]}>
                    Special Instructions / Notes
                  </Text>
                  <TextInput
                    style={[styles.textArea, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
                    placeholder="Allergies, dosage inquiries, preferred brand..."
                    placeholderTextColor={colors.textMuted}
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    numberOfLines={3}
                  />
                </Card>

                <Button
                  title="Submit Prescription for Review"
                  variant="primary"
                  size="lg"
                  leftIcon={<Send size={18} color="#ffffff" />}
                  onPress={handleSubmit}
                  loading={submitting}
                />
              </View>
            )
          ) : (
            /* Track Tab */
            <View style={{ gap: 16 }}>
              <Card style={styles.formCard}>
                <Text style={[styles.sectionHeading, { color: colors.text }]}>
                  Track Prescription Status
                </Text>
                <Text style={[styles.fieldSub, { color: colors.textMuted }]}>
                  Enter the reference number provided upon uploading your prescription (e.g. RX-123456).
                </Text>

                <TextInput
                  style={[styles.input, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text, marginTop: 12 }]}
                  placeholder="e.g. RX-491023"
                  placeholderTextColor={colors.textMuted}
                  value={trackRef}
                  onChangeText={setTrackRef}
                  autoCapitalize="characters"
                />

                {trackError && (
                  <View style={[styles.errorBanner, { backgroundColor: colors.danger + '15', borderColor: colors.danger + '30' }]}>
                    <AlertCircle size={18} color={colors.danger} />
                    <Text style={[styles.errorText, { color: colors.danger }]}>{trackError}</Text>
                  </View>
                )}

                <Button
                  title="Check Status"
                  variant="primary"
                  leftIcon={<Search size={16} color="#ffffff" />}
                  onPress={handleTrack}
                  loading={tracking}
                  style={{ marginTop: 16 }}
                />
              </Card>

              {trackResult && (
                <Card style={styles.resultCard}>
                  <View style={styles.resultHeader}>
                    <View>
                      <Text style={[styles.refLabel, { color: colors.textMuted }]}>Prescription Ref</Text>
                      <Text style={[styles.refNumber, { color: colors.primary }]}>
                        {trackResult.prescriptionNumber || trackRef}
                      </Text>
                    </View>
                    <Badge
                      label={trackResult.status || 'Under Review'}
                      variant={
                        trackResult.status === 'Approved' || trackResult.status === 'Completed'
                          ? 'success'
                          : trackResult.status === 'Rejected'
                          ? 'danger'
                          : 'primary'
                      }
                      size="sm"
                    />
                  </View>

                  <View style={[styles.metaGrid, { borderTopColor: colors.border }]}>
                    <View style={styles.metaCell}>
                      <Text style={[styles.metaCellLabel, { color: colors.textMuted }]}>Patient</Text>
                      <Text style={[styles.metaCellValue, { color: colors.text }]}>
                        {trackResult.patientName || 'Patient'}
                      </Text>
                    </View>
                    <View style={styles.metaCell}>
                      <Text style={[styles.metaCellLabel, { color: colors.textMuted }]}>Date Submitted</Text>
                      <Text style={[styles.metaCellValue, { color: colors.text }]}>
                        {trackResult.date ? new Date(trackResult.date).toLocaleDateString() : 'Today'}
                      </Text>
                    </View>
                    <View style={styles.metaCell}>
                      <Text style={[styles.metaCellLabel, { color: colors.textMuted }]}>Fulfilment</Text>
                      <Text style={[styles.metaCellValue, { color: colors.text }]}>
                        {trackResult.deliveryPreference || 'Home Delivery'}
                      </Text>
                    </View>
                    <View style={styles.metaCell}>
                      <Text style={[styles.metaCellLabel, { color: colors.textMuted }]}>Doctor</Text>
                      <Text style={[styles.metaCellValue, { color: colors.text }]}>
                        {trackResult.doctorName || 'Not specified'}
                      </Text>
                    </View>
                  </View>
                </Card>
              )}
            </View>
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
  topTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  workflowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  workflowStep: {
    alignItems: 'center',
    gap: 4,
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  stepDesc: {
    fontSize: 11,
    fontWeight: '700',
  },
  formCard: {
    padding: 16,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  fieldSub: {
    fontSize: 13,
    lineHeight: 18,
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
    minHeight: 80,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  uploadZone: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  uploadTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  uploadSub: {
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  radioRow: {
    flexDirection: 'row',
    gap: 10,
  },
  radioChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  radioText: {
    fontSize: 13,
  },
  successCard: {
    padding: 24,
    alignItems: 'center',
    textAlign: 'center',
    gap: 12,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  successSub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  refBox: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginVertical: 12,
  },
  refBoxLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  refBoxCode: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 2,
  },
  successActions: {
    width: '100%',
    gap: 10,
    marginTop: 12,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
  },
  errorText: {
    fontSize: 12,
    flex: 1,
  },
  resultCard: {
    padding: 16,
    gap: 16,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  refLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
  },
  refNumber: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    rowGap: 12,
  },
  metaCell: {
    width: '50%',
    gap: 2,
  },
  metaCellLabel: {
    fontSize: 11,
  },
  metaCellValue: {
    fontSize: 13,
    fontWeight: '700',
  },
});
