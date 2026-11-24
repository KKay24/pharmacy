import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Key,
  ShieldCheck,
  Stethoscope,
  Package,
  MapPin,
  X,
  Lock,
  CheckCircle2,
  XCircle,
  UserPlus,
  Edit,
  KeyRound,
  Trash2,
} from 'lucide-react-native';
import { useTheme } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import SearchInput from '../components/ui/SearchInput';
import EmptyState from '../components/ui/EmptyState';
import { RoleGuard } from '@/components/ui/RoleGuard';

interface StaffUser {
  id: string | number;
  username: string;
  email?: string;
  role: 'admin' | 'manager' | 'user';
  status?: string;
  locations?: string[];
  lastLogin?: string;
}

const ROLE_CONFIG = {
  admin: { label: 'Administrator', variant: 'danger' as const, Icon: ShieldCheck },
  manager: { label: 'Manager', variant: 'warning' as const, Icon: Stethoscope },
  user: { label: 'Staff Pharmacist', variant: 'primary' as const, Icon: Package },
};

const PERMISSIONS = [
  { feature: 'POS & Sales Checkout', admin: true, manager: true, user: true },
  { feature: 'Inventory & Restock Control', admin: true, manager: true, user: true },
  { feature: 'Prescription Queue Management', admin: true, manager: true, user: false },
  { feature: 'Financial Reports & Profit/Loss', admin: true, manager: true, user: false },
  { feature: 'Supplier Accounts & Purchasing', admin: true, manager: true, user: false },
  { feature: 'Staff Account Provisioning', admin: true, manager: false, user: false },
];

export default function TeamScreen() {
  const { colors } = useTheme();
  const { token, user: currentUser } = useAuth();

  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMatrixModal, setShowMatrixModal] = useState(false);

  // Form modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'manager' | 'user'>('user');
  const [saving, setSaving] = useState(false);

  // Password reset modal
  const [passwordTarget, setPasswordTarget] = useState<StaffUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | number | null>(null);

  const fetchUsers = async () => {
    try {
      const res = await apiClient.get('/api/auth/users');
      const data = res.data;
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.log('Error fetching users, using fallback demo', e);
      setUsers([
        { id: 1, username: 'admin', email: 'admin@mediquick.com', role: 'admin', status: 'active', locations: ['Main Pharmacy'] },
        { id: 2, username: 'pharmacist_jane', email: 'jane@mediquick.com', role: 'manager', status: 'active', locations: ['Main Pharmacy'] },
        { id: 3, username: 'dispenser_john', email: 'john@mediquick.com', role: 'user', status: 'active', locations: ['Main Pharmacy'] },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [token]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase();
      return (
        u.username?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q)
      );
    });
  }, [users, searchQuery]);

  const openAddModal = () => {
    setEditingUser(null);
    setUsername('');
    setEmail('');
    setPassword('');
    setRole('user');
    setModalVisible(true);
  };

  const openEditModal = (u: StaffUser) => {
    setEditingUser(u);
    setUsername(u.username);
    setEmail(u.email || '');
    setPassword('');
    setRole(u.role || 'user');
    setModalVisible(true);
  };

  const canManageCredentialsOrDelete = (u: StaffUser) => {
    const isSelf =
      Boolean(currentUser?.username) &&
      u.username.trim().toLowerCase() === currentUser!.username.trim().toLowerCase();
    return u.role !== 'admin' && !isSelf;
  };

  const openPasswordModal = (u: StaffUser) => {
    setPasswordTarget(u);
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleResetPassword = async () => {
    if (!passwordTarget || savingPassword) return;
    const trimmed = newPassword.trim();
    if (trimmed.length < 12) {
      Alert.alert('Invalid Password', 'New password must be at least 12 characters long.');
      return;
    }
    if (trimmed !== confirmPassword.trim()) {
      Alert.alert('Password Mismatch', 'New password and confirmation do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      await apiClient.patch(`/api/auth/users/${passwordTarget.id}/password`, {
        newPassword: trimmed,
      });
      Alert.alert('Success', `Password updated for @${passwordTarget.username}.`);
      setPasswordTarget(null);
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string; error?: string } }; message?: string };
      Alert.alert(
        'Error',
        err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to update password.'
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeleteUser = (u: StaffUser) => {
    if (!canManageCredentialsOrDelete(u) || deletingUserId !== null) return;
    Alert.alert(
      'Delete User Account',
      `Permanently delete @${u.username}? Historical sales and orders will be preserved, but this user will lose access immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingUserId(u.id);
            try {
              await apiClient.delete(`/api/auth/users/${u.id}`);
              Alert.alert('Deleted', `User @${u.username} has been deleted.`);
              fetchUsers();
            } catch (e: unknown) {
              const err = e as { response?: { data?: { message?: string; error?: string } }; message?: string };
              Alert.alert(
                'Cannot Delete User',
                err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to delete user.'
              );
            } finally {
              setDeletingUserId(null);
            }
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    if (!username.trim()) {
      Alert.alert('Required Field', 'Please enter a valid staff username.');
      return;
    }
    const trimmedPassword = password.trim();
    if (!editingUser && trimmedPassword.length < 12) {
      Alert.alert('Invalid Password', 'Initial password must be at least 12 characters long.');
      return;
    }
    if (editingUser && trimmedPassword && trimmedPassword.length < 12) {
      Alert.alert('Invalid Password', 'New password must be at least 12 characters long.');
      return;
    }

    setSaving(true);
    try {
      const payload: {
        username: string;
        email: string | null;
        role: 'admin' | 'manager' | 'user';
        locations: string[];
        password?: string;
      } = {
        username: username.trim(),
        email: email.trim() || null,
        role,
        locations: editingUser?.locations?.length ? editingUser.locations : ['Main Pharmacy'],
      };
      if (trimmedPassword) {
        payload.password = trimmedPassword;
      }

      if (editingUser) {
        await apiClient.put(`/api/auth/users/${editingUser.id}`, payload);
      } else {
        await apiClient.post('/api/auth/users', payload);
      }

      Alert.alert(
        'Success',
        editingUser ? 'Staff profile updated successfully.' : 'New staff account provisioned.'
      );
      setModalVisible(false);
      fetchUsers();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string; error?: string } }; message?: string };
      Alert.alert(
        'Error',
        err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to save staff account.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <RoleGuard page="team">
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
        {/* Search & Actions Header */}
        <View style={[styles.headerContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <View style={styles.topRow}>
            <SearchInput
              placeholder="Search staff by username, email, role..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchBar}
            />
            <TouchableOpacity
              style={[styles.matrixBtn, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
              onPress={() => setShowMatrixModal(true)}
              accessibilityLabel="View access matrix"
            >
              <Key size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
  
          <View style={styles.actionRow}>
            <Text style={[styles.countText, { color: colors.textMuted }]}>
              {filteredUsers.length} active staff profiles
            </Text>
            <Button
              title="Onboard Staff"
              variant="primary"
              size="sm"
              leftIcon={<UserPlus size={15} color="#ffffff" />}
              onPress={openAddModal}
            />
          </View>
        </View>
  
        {/* Staff List */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading team members...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredUsers}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            refreshing={refreshing}
            onRefresh={onRefresh}
            ListEmptyComponent={
              <EmptyState
                title="No Staff Profiles Found"
                description="No staff profiles match your search criteria. Tap 'Onboard Staff' to add a new team member."
                actionLabel="Onboard Staff"
                onAction={openAddModal}
              />
            }
            renderItem={({ item }) => {
              const roleConf = ROLE_CONFIG[item.role] || ROLE_CONFIG.user;
              const RoleIcon = roleConf.Icon;
              return (
                <Card style={styles.staffCard}>
                  <View style={styles.staffCardHeader}>
                    <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
                      <Text style={[styles.avatarText, { color: colors.primary }]}>
                        {item.username.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.staffMainInfo}>
                      <View style={styles.nameRow}>
                        <Text style={[styles.staffName, { color: colors.text }]}>{item.username}</Text>
                        <Badge
                          label={roleConf.label}
                          variant={roleConf.variant}
                          size="sm"
                          icon={<RoleIcon size={12} color={colors.primary} />}
                        />
                      </View>
                      <Text style={[styles.staffEmail, { color: colors.textMuted }]}>
                        {item.email || 'No email attached'}
                      </Text>
                    </View>
                  </View>
  
                  <View style={[styles.staffMetaRow, { borderTopColor: colors.border }]}>
                    <View style={styles.metaItem}>
                      <MapPin size={14} color={colors.textMuted} />
                      <Text style={[styles.metaText, { color: colors.textMuted }]}>
                        {item.locations?.join(', ') || 'Main Pharmacy'}
                      </Text>
                    </View>
                    <View style={styles.metaItem}>
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: item.status !== 'inactive' ? colors.success : colors.danger },
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusText,
                          { color: item.status !== 'inactive' ? colors.success : colors.danger },
                        ]}
                      >
                        {item.status !== 'inactive' ? 'Active' : 'Revoked'}
                      </Text>
                    </View>
                  </View>
  
                  <View style={styles.cardActions}>
                    <Button
                      title="Edit"
                      variant="outline"
                      size="sm"
                      leftIcon={<Edit size={14} color={colors.primary} />}
                      onPress={() => openEditModal(item)}
                      style={styles.editBtn}
                    />
                    {canManageCredentialsOrDelete(item) && (
                      <>
                        <Button
                          title="Password"
                          variant="outline"
                          size="sm"
                          leftIcon={<KeyRound size={14} color={colors.primary} />}
                          onPress={() => openPasswordModal(item)}
                          style={styles.editBtn}
                        />
                        <Button
                          title="Delete"
                          variant="danger"
                          size="sm"
                          loading={deletingUserId === item.id}
                          leftIcon={<Trash2 size={14} color="#ffffff" />}
                          onPress={() => handleDeleteUser(item)}
                          style={styles.editBtn}
                        />
                      </>
                    )}
                  </View>
                </Card>
              );
            }}
          />
        )}
  
        {/* Onboard / Edit Staff Modal */}
        <Modal visible={modalVisible} animationType="slide" transparent>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalOverlay}
          >
            <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    {editingUser ? 'Edit Staff Profile' : 'Staff Onboarding'}
                  </Text>
                  <Text style={[styles.modalSub, { color: colors.textMuted }]}>
                    {editingUser
                      ? `Update system credentials for @${editingUser.username}`
                      : 'Provision new credentials and assign operational role'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <X size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
  
              <ScrollView contentContainerStyle={styles.modalBody}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Username *</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surfaceMuted,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  placeholder="e.g. pharmacist_sarah"
                  placeholderTextColor={colors.textMuted}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  editable={!editingUser}
                />
  
                <Text style={[styles.inputLabel, { color: colors.text }]}>Email Address</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surfaceMuted,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  placeholder="sarah@mediquick.com"
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
  
                <Text style={[styles.inputLabel, { color: colors.text }]}>
                  {editingUser ? 'Change Password (leave blank to keep)' : 'System Password *'}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surfaceMuted,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  placeholder={editingUser ? 'Minimum 12 characters (optional)' : 'Minimum 12 characters'}
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
  
                <Text style={[styles.inputLabel, { color: colors.text }]}>Operational Role</Text>
                <View style={styles.rolePickerRow}>
                  {(['user', 'manager', 'admin'] as const).map((r) => {
                    const conf = ROLE_CONFIG[r];
                    const RoleIcon = conf.Icon;
                    const selected = role === r;
                    return (
                      <TouchableOpacity
                        key={r}
                        style={[
                          styles.roleChip,
                          {
                            borderColor: selected ? colors.primary : colors.border,
                            backgroundColor: selected ? colors.primary + '15' : colors.surfaceMuted,
                          },
                        ]}
                        onPress={() => setRole(r)}
                      >
                        <RoleIcon
                          size={16}
                          color={selected ? colors.primary : colors.textMuted}
                        />
                        <Text
                          style={[
                            styles.roleChipText,
                            { color: selected ? colors.primary : colors.text, fontWeight: selected ? '700' : '500' },
                          ]}
                        >
                          {r === 'user' ? 'Staff' : conf.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
  
                <View style={[styles.advisoryBanner, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
                  <Lock size={18} color={colors.primary} />
                  <Text style={[styles.advisoryText, { color: colors.text }]}>
                    Staff access will be provisioned instantly. The user will be restricted to designated modules based on their assigned role permissions.
                  </Text>
                </View>
              </ScrollView>
  
              <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
                <Button
                  title="Cancel"
                  variant="ghost"
                  onPress={() => setModalVisible(false)}
                  style={styles.modalCancelBtn}
                />
                <Button
                  title={editingUser ? 'Update Profile' : 'Save Staff Account'}
                  variant="primary"
                  onPress={handleSave}
                  loading={saving}
                  style={styles.modalSaveBtn}
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
  
        {/* Reset User Password Modal */}
        <Modal visible={Boolean(passwordTarget)} animationType="slide" transparent>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalOverlay}
          >
            <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Change User Password</Text>
                  <Text style={[styles.modalSub, { color: colors.textMuted }]}>
                    Set a new password for @{passwordTarget?.username}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => !savingPassword && setPasswordTarget(null)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.modalBody}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>New Password *</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surfaceMuted,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  placeholder="Minimum 12 characters"
                  placeholderTextColor={colors.textMuted}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                />

                <Text style={[styles.inputLabel, { color: colors.text }]}>Confirm New Password *</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surfaceMuted,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  placeholder="Re-enter new password"
                  placeholderTextColor={colors.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                />

                <View style={[styles.advisoryBanner, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
                  <Lock size={18} color={colors.primary} />
                  <Text style={[styles.advisoryText, { color: colors.text }]}>
                    Passwords must be at least 12 characters. Share the updated password securely with the user.
                  </Text>
                </View>
              </ScrollView>

              <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
                <Button
                  title="Cancel"
                  variant="ghost"
                  onPress={() => setPasswordTarget(null)}
                  style={styles.modalCancelBtn}
                />
                <Button
                  title="Update Password"
                  variant="primary"
                  onPress={handleResetPassword}
                  loading={savingPassword}
                  style={styles.modalSaveBtn}
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Permissions Matrix Modal */}
        <Modal visible={showMatrixModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.matrixCard, { backgroundColor: colors.surface }]}>
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Key size={20} color={colors.primary} />
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Access Permissions Matrix</Text>
                </View>
                <TouchableOpacity onPress={() => setShowMatrixModal(false)}>
                  <X size={24} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
  
              <ScrollView contentContainerStyle={{ padding: 16 }}>
                <View style={[styles.matrixHeaderRow, { backgroundColor: colors.surfaceMuted }]}>
                  <Text style={[styles.matrixColHeader, { flex: 2, color: colors.text }]}>Feature Module</Text>
                  <Text style={[styles.matrixColHeader, { flex: 1, color: colors.text }]}>Admin</Text>
                  <Text style={[styles.matrixColHeader, { flex: 1, color: colors.text }]}>Manager</Text>
                  <Text style={[styles.matrixColHeader, { flex: 1, color: colors.text }]}>Staff</Text>
                </View>
  
                {PERMISSIONS.map((perm, index) => (
                  <View
                    key={perm.feature}
                    style={[
                      styles.matrixRow,
                      {
                        borderBottomColor: colors.border,
                        backgroundColor: index % 2 === 0 ? 'transparent' : colors.surfaceMuted + '40',
                      },
                    ]}
                  >
                    <Text style={[styles.matrixFeatureText, { flex: 2, color: colors.text }]}>
                      {perm.feature}
                    </Text>
                    <View style={[styles.matrixIconCell, { flex: 1 }]}>
                      {perm.admin ? (
                        <CheckCircle2 size={18} color={colors.success} />
                      ) : (
                        <XCircle size={18} color={colors.border} />
                      )}
                    </View>
                    <View style={[styles.matrixIconCell, { flex: 1 }]}>
                      {perm.manager ? (
                        <CheckCircle2 size={18} color={colors.success} />
                      ) : (
                        <XCircle size={18} color={colors.border} />
                      )}
                    </View>
                    <View style={[styles.matrixIconCell, { flex: 1 }]}>
                      {perm.user ? (
                        <CheckCircle2 size={18} color={colors.success} />
                      ) : (
                        <XCircle size={18} color={colors.border} />
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>
  
              <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
                <Button
                  title="Close"
                  variant="primary"
                  onPress={() => setShowMatrixModal(false)}
                  style={{ width: '100%' }}
                />
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </RoleGuard>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBar: {
    flex: 1,
  },
  matrixBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countText: {
    fontSize: 13,
    fontWeight: '600',
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  staffCard: {
    padding: 16,
    gap: 12,
  },
  staffCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
  },
  staffMainInfo: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  staffName: {
    fontSize: 16,
    fontWeight: '700',
  },
  staffEmail: {
    fontSize: 13,
  },
  staffMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  editBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalSub: {
    fontSize: 12,
    marginTop: 2,
    maxWidth: 280,
  },
  modalBody: {
    padding: 16,
    gap: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  input: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  rolePickerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roleChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  roleChipText: {
    fontSize: 13,
  },
  advisoryBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 6,
  },
  advisoryText: {
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
  },
  modalSaveBtn: {
    flex: 2,
  },
  matrixCard: {
    borderRadius: 20,
    marginHorizontal: 16,
    marginVertical: 40,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  matrixHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  matrixColHeader: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  matrixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  matrixFeatureText: {
    fontSize: 13,
    fontWeight: '600',
  },
  matrixIconCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
