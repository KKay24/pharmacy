import React, { useEffect, useState } from 'react';
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
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { File as ExpoFile } from 'expo-file-system';
import {
  UploadCloud,
  Search,
  CheckCircle,
  Camera,
  Image as ImageIcon,
  FileText,
  Trash2,
  ChevronRight,
  Truck,
  Store,
  Send,
  AlertCircle,
} from 'lucide-react-native';
import { useTheme } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import { ERROR_MESSAGES, resolveMobileErrorMessage } from '../utils/errorMessages';
import {
  MAX_PRESCRIPTION_FILE_BYTES,
  PrescriptionTrackResult,
  SelectedPrescriptionAttachment,
  buildPrescriptionFileDataUri,
  buildPrescriptionUploadPayload,
  extractPrescriptionTrackError,
  formatDeliveryPreferenceLabel,
  formatFileSize,
} from '../utils/prescriptionUpload';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';

async function readWebFileAsDataUri(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Unable to read selected file.'));
      }
    };
    reader.onerror = () => reject(new Error('Unable to read selected file.'));
    reader.readAsDataURL(file);
  });
}

async function readNativeUriAsBase64(uri: string): Promise<string> {
  const file = new ExpoFile(uri);
  return file.base64();
}

export default function PrescriptionUploadScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ tab?: string; ref?: string }>();

  const initialTab: 'upload' | 'track' = params.tab === 'track' ? 'track' : 'upload';
  const [activeTab, setActiveTab] = useState<'upload' | 'track'>(initialTab);

  // Form states
  const [patientName, setPatientName] = useState(user?.username || '');
  const [patientPhone, setPatientPhone] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [medications, setMedications] = useState('');
  const [deliveryPreference, setDeliveryPreference] = useState<'delivery' | 'pickup'>('delivery');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [attachment, setAttachment] = useState<SelectedPrescriptionAttachment | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [pickingFile, setPickingFile] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ prescriptionNumber: string } | null>(null);

  // Track tab states
  const [trackRef, setTrackRef] = useState(typeof params.ref === 'string' ? params.ref : '');
  const [tracking, setTracking] = useState(false);
  const [trackResult, setTrackResult] = useState<PrescriptionTrackResult | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);

  useEffect(() => {
    if (params.tab === 'track') {
      setActiveTab('track');
    } else if (params.tab === 'upload') {
      setActiveTab('upload');
    }
  }, [params.tab]);

  useEffect(() => {
    if (typeof params.ref === 'string' && params.ref.trim()) {
      setTrackRef(params.ref.trim());
    }
  }, [params.ref]);

  const applyPickedImage = async (asset: ImagePicker.ImagePickerAsset) => {
    setAttachmentError(null);
    const fileName = asset.fileName || `prescription_${Date.now()}.jpg`;

    if (typeof asset.fileSize === 'number' && asset.fileSize > MAX_PRESCRIPTION_FILE_BYTES) {
      setAttachmentError('Selected photo exceeds the 5 MB limit. Please take a lower-resolution photo.');
      return;
    }

    let base64 = asset.base64 ?? null;
    if (!base64 && Platform.OS !== 'web' && asset.uri) {
      base64 = await readNativeUriAsBase64(asset.uri);
    }

    const built = buildPrescriptionFileDataUri({
      base64,
      dataUri: asset.uri?.startsWith('data:') ? asset.uri : null,
      mimeType: asset.mimeType,
      fileName,
      byteSize: asset.fileSize,
    });

    if (!built.ok) {
      setAttachmentError(built.error);
      return;
    }

    setAttachment({
      uri: asset.uri,
      fileName,
      mimeType: built.mimeType,
      byteSize: built.byteSize,
      fileData: built.fileData,
      isImage: built.isImage,
    });
  };

  const handleTakePhoto = async () => {
    setAttachmentError(null);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Camera Permission Needed',
          'Please allow camera access in your device settings to photograph your prescription.'
        );
        return;
      }

      setPickingFile(true);
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.75,
        base64: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        await applyPickedImage(result.assets[0]);
      }
    } catch {
      setAttachmentError('Unable to open the camera. Please try choosing an image or PDF instead.');
    } finally {
      setPickingFile(false);
    }
  };

  const handleChoosePhoto = async () => {
    setAttachmentError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Photo Library Permission Needed',
          'Please allow photo library access in your device settings to select a prescription photo.'
        );
        return;
      }

      setPickingFile(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        await applyPickedImage(result.assets[0]);
      }
    } catch {
      setAttachmentError('Unable to open your photo library. Please try again.');
    } finally {
      setPickingFile(false);
    }
  };

  const handleChooseDocument = async () => {
    setAttachmentError(null);
    try {
      setPickingFile(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];
      if (typeof asset.size === 'number' && asset.size > MAX_PRESCRIPTION_FILE_BYTES) {
        setAttachmentError('Prescription file must be 5 MB or smaller. Please select a smaller file.');
        return;
      }

      let base64: string | null = asset.base64 ?? null;
      let dataUri: string | null = null;

      if (!base64) {
        if (Platform.OS === 'web' && asset.file) {
          dataUri = await readWebFileAsDataUri(asset.file);
        } else if (asset.uri.startsWith('data:')) {
          dataUri = asset.uri;
        } else {
          base64 = await readNativeUriAsBase64(asset.uri);
        }
      }

      const built = buildPrescriptionFileDataUri({
        base64,
        dataUri,
        mimeType: asset.mimeType,
        fileName: asset.name,
        byteSize: asset.size,
      });

      if (!built.ok) {
        setAttachmentError(built.error);
        return;
      }

      setAttachment({
        uri: asset.uri,
        fileName: asset.name,
        mimeType: built.mimeType,
        byteSize: built.byteSize,
        fileData: built.fileData,
        isImage: built.isImage,
      });
    } catch {
      setAttachmentError('Unable to read the selected document. Please choose a valid JPG, PNG, or PDF.');
    } finally {
      setPickingFile(false);
    }
  };

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
      const payload = buildPrescriptionUploadPayload({
        patientName,
        patientPhone,
        doctorName,
        medications,
        deliveryPreference,
        deliveryAddress,
        notes,
        attachment,
      });

      const res = await apiClient.post('/api/prescriptions/upload', payload);
      const data = res.data as { prescriptionNumber?: string; referenceNumber?: string };
      const rxNum =
        data.prescriptionNumber ||
        data.referenceNumber ||
        `RX-${Math.floor(100000 + Math.random() * 900000)}`;
      setSubmitResult({ prescriptionNumber: rxNum });
    } catch (e: unknown) {
      Alert.alert(
        'Upload Failed',
        resolveMobileErrorMessage(e, {
          context: 'prescription-upload',
          fallback: ERROR_MESSAGES.UPLOAD_FAILED,
        })
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleTrack = async (overrideRef?: string) => {
    const queryRef = (overrideRef ?? trackRef).trim();
    if (!queryRef) {
      setTrackError('Please enter your prescription tracking reference.');
      return;
    }

    setTracking(true);
    setTrackError(null);
    setTrackResult(null);

    try {
      const res = await apiClient.get<PrescriptionTrackResult>(
        `/api/prescriptions/track/${encodeURIComponent(queryRef)}`
      );
      setTrackResult(res.data);
    } catch (e: unknown) {
      setTrackError(extractPrescriptionTrackError(e));
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
    setAttachment(null);
    setAttachmentError(null);
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
                  Our licensed pharmacist will review your prescription, check inventory, and contact you via phone or WhatsApp.
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
                      const refCode = submitResult.prescriptionNumber;
                      setTrackRef(refCode);
                      setActiveTab('track');
                      setSubmitResult(null);
                      void handleTrack(refCode);
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

                {/* Prescription Document / Photo Picker */}
                <Card style={styles.formCard}>
                  <Text style={[styles.sectionHeading, { color: colors.text }]}>
                    Prescription Document / Photo
                  </Text>
                  <Text style={[styles.fieldSub, { color: colors.textMuted, marginBottom: 12 }]}>
                    Attach a clear photo or PDF of your written prescription (JPG, PNG, or PDF up to 5 MB).
                  </Text>

                  {attachment ? (
                    <View
                      style={[
                        styles.attachmentPreview,
                        {
                          backgroundColor: colors.success + '10',
                          borderColor: colors.success,
                        },
                      ]}
                    >
                      <View style={styles.attachmentTopRow}>
                        {attachment.isImage ? (
                          <Image
                            source={{ uri: attachment.uri }}
                            style={styles.attachmentThumb}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={[styles.pdfBadge, { backgroundColor: colors.primary + '15' }]}>
                            <FileText size={28} color={colors.primary} />
                          </View>
                        )}
                        <View style={styles.attachmentMeta}>
                          <View style={styles.attachmentTitleRow}>
                            <CheckCircle size={15} color={colors.success} />
                            <Text
                              style={[styles.attachmentName, { color: colors.text }]}
                              numberOfLines={1}
                            >
                              {attachment.fileName}
                            </Text>
                          </View>
                          <Text style={[styles.attachmentDetails, { color: colors.textMuted }]}>
                            {attachment.mimeType === 'application/pdf' ? 'PDF Document' : 'Image'} •{' '}
                            {formatFileSize(attachment.byteSize)}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={[styles.removeAttachmentBtn, { backgroundColor: colors.danger + '15' }]}
                          onPress={() => {
                            setAttachment(null);
                            setAttachmentError(null);
                          }}
                          accessibilityLabel="Remove prescription attachment"
                        >
                          <Trash2 size={18} color={colors.danger} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : null}

                  <View style={styles.pickerActionsRow}>
                    <TouchableOpacity
                      style={[
                        styles.pickerActionBtn,
                        { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                      ]}
                      onPress={handleTakePhoto}
                      disabled={pickingFile}
                    >
                      <Camera size={22} color={colors.primary} />
                      <Text style={[styles.pickerActionLabel, { color: colors.text }]}>
                        Take Photo
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.pickerActionBtn,
                        { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                      ]}
                      onPress={handleChoosePhoto}
                      disabled={pickingFile}
                    >
                      <ImageIcon size={22} color={colors.primary} />
                      <Text style={[styles.pickerActionLabel, { color: colors.text }]}>
                        Gallery
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.pickerActionBtn,
                        { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                      ]}
                      onPress={handleChooseDocument}
                      disabled={pickingFile}
                    >
                      <FileText size={22} color={colors.primary} />
                      <Text style={[styles.pickerActionLabel, { color: colors.text }]}>
                        PDF / File
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {pickingFile && (
                    <View style={styles.pickingRow}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={[styles.pickingText, { color: colors.textMuted }]}>
                        Preparing prescription file...
                      </Text>
                    </View>
                  )}

                  {attachmentError && (
                    <View style={[styles.errorBanner, { backgroundColor: colors.danger + '15', borderColor: colors.danger + '30' }]}>
                      <AlertCircle size={18} color={colors.danger} />
                      <Text style={[styles.errorText, { color: colors.danger }]}>{attachmentError}</Text>
                    </View>
                  )}
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
                  disabled={pickingFile}
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
                  onPress={() => void handleTrack()}
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
                        trackResult.status === 'Approved' ||
                        trackResult.status === 'Ready for Pickup' ||
                        trackResult.status === 'Completed'
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
                      <Text style={[styles.metaCellLabel, { color: colors.textMuted }]}>Date Submitted</Text>
                      <Text style={[styles.metaCellValue, { color: colors.text }]}>
                        {trackResult.date ? new Date(trackResult.date).toLocaleDateString() : '—'}
                      </Text>
                    </View>
                    <View style={styles.metaCell}>
                      <Text style={[styles.metaCellLabel, { color: colors.textMuted }]}>Fulfilment</Text>
                      <Text style={[styles.metaCellValue, { color: colors.text }]}>
                        {formatDeliveryPreferenceLabel(trackResult.deliveryPreference)}
                      </Text>
                    </View>
                    {trackResult.dueDate ? (
                      <View style={styles.metaCell}>
                        <Text style={[styles.metaCellLabel, { color: colors.textMuted }]}>Target Date</Text>
                        <Text style={[styles.metaCellValue, { color: colors.text }]}>
                          {new Date(trackResult.dueDate).toLocaleDateString()}
                        </Text>
                      </View>
                    ) : null}
                    {trackResult.patientName ? (
                      <View style={styles.metaCell}>
                        <Text style={[styles.metaCellLabel, { color: colors.textMuted }]}>Patient</Text>
                        <Text style={[styles.metaCellValue, { color: colors.text }]}>
                          {trackResult.patientName}
                        </Text>
                      </View>
                    ) : null}
                    {trackResult.doctorName ? (
                      <View style={styles.metaCell}>
                        <Text style={[styles.metaCellLabel, { color: colors.textMuted }]}>Doctor</Text>
                        <Text style={[styles.metaCellValue, { color: colors.text }]}>
                          {trackResult.doctorName}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <Text style={[styles.privacyNote, { color: colors.textMuted }]}>
                    Personal details are hidden on public status lookups to protect patient privacy.
                  </Text>
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
    marginBottom: 8,
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
  attachmentPreview: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  attachmentTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  attachmentThumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  pdfBadge: {
    width: 56,
    height: 56,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentMeta: {
    flex: 1,
    gap: 4,
  },
  attachmentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  attachmentName: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  attachmentDetails: {
    fontSize: 12,
  },
  removeAttachmentBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pickerActionBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pickerActionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  pickingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  pickingText: {
    fontSize: 12,
    fontWeight: '600',
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
  privacyNote: {
    fontSize: 11,
    lineHeight: 16,
  },
});
