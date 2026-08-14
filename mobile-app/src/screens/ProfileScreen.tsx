import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, Modal, TextInput, Platform, Alert, KeyboardAvoidingView, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { usePreferences } from '../context/PreferencesContext';
import { useAuth } from '../context/AuthContext';
import apiClient from '../services/apiClient';
import { getErrorMessage } from '../utils/apiError';
import { exportAllDataAsJson, exportTransactionsAsCsv } from '../services/exportService';
import { AuthResponse } from '../types/models';
import { AppNavigation } from '../navigation/types';

type Colors = ReturnType<typeof usePreferences>['colors'];

interface SettingRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  rightElement?: React.ReactNode;
}

function SettingRow({ icon, iconBg, iconColor, title, subtitle, onPress, rightElement }: SettingRowProps) {
  const { colors } = usePreferences();
  const styles = getStyles(colors);

  return (
    <TouchableOpacity style={styles.settingRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.settingIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle ? <Text style={styles.settingSubtitle}>{subtitle}</Text> : null}
      </View>
      {rightElement || <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const navigation = useNavigation<AppNavigation>();
  const { preferences, colors } = usePreferences();
  const styles = getStyles(colors);
  const { logout, user, updateUserLocal } = useAuth();

  const [isPwModalVisible, setPwModalVisible] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [isSavingPw, setIsSavingPw] = useState(false);

  const [isInfoModalVisible, setInfoModalVisible] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editUsername, setEditUsername] = useState(user?.username || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [isSavingInfo, setIsSavingInfo] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleSavePw = async () => {
    if (!currentPw || !newPw || newPw !== confirmPw) {
      Alert.alert('Error', 'Revisa que la contraseña actual esté escrita y que la nueva coincida con la confirmación.');
      return;
    }
    setIsSavingPw(true);
    try {
      await apiClient.put('/auth/change-password', { currentPassword: currentPw, newPassword: newPw });
      setPwModalVisible(false);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      Alert.alert('¡Éxito!', 'Tu contraseña ha sido actualizada correctamente.');
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error, 'No se pudo actualizar la contraseña'));
    }
    setIsSavingPw(false);
  };

  const handleSaveInfo = async () => {
    if (!editName.trim() || !editUsername.trim() || !editEmail.trim()) {
      Alert.alert('Error', 'Todos los campos son requeridos');
      return;
    }
    setIsSavingInfo(true);
    try {
      const { data } = await apiClient.put<AuthResponse>('/auth/profile', {
        name: editName.trim(),
        username: editUsername.trim(),
        email: editEmail.trim(),
      });
      await updateUserLocal(data);
      setEditName(data.name);
      setEditUsername(data.username);
      setEditEmail(data.email);
      setInfoModalVisible(false);
      Alert.alert('¡Éxito!', 'Tu información personal ha sido actualizada.');
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error, 'No se pudo actualizar tu información'));
    }
    setIsSavingInfo(false);
  };

  const handleExport = async (kind: 'json' | 'csv') => {
    setIsExporting(true);
    try {
      if (kind === 'json') await exportAllDataAsJson();
      else await exportTransactionsAsCsv();
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error, 'No se pudo exportar la información'));
    }
    setIsExporting(false);
  };

  const themeLabel: Record<string, string> = { light: 'Claro', dark: 'Oscuro', adaptive: 'Sistema' };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{editName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.userName}>{editName}</Text>
          <Text style={styles.userEmail}>{editEmail}</Text>
        </View>

        <Text style={styles.sectionLabel}>Cuenta</Text>
        <View style={styles.group}>
          <SettingRow
            icon="person-outline"
            iconBg="#EFF6FF"
            iconColor="#3B82F6"
            title="Información Personal"
            subtitle={`${editName} · @${editUsername}`}
            onPress={() => setInfoModalVisible(true)}
          />
          <View style={styles.separator} />
          <SettingRow
            icon="lock-closed-outline"
            iconBg="#FEF3C7"
            iconColor="#D97706"
            title="Cambiar Contraseña"
            subtitle="Mantén tu cuenta segura"
            onPress={() => setPwModalVisible(true)}
          />
          <View style={styles.separator} />
          <SettingRow
            icon="download-outline"
            iconBg="#ECFDF5"
            iconColor="#059669"
            title="Exportar mis datos"
            subtitle="Respaldo completo en JSON"
            onPress={() => handleExport('json')}
            rightElement={isExporting ? <ActivityIndicator size="small" color={colors.textMuted} /> : undefined}
          />
          <View style={styles.separator} />
          <SettingRow
            icon="document-text-outline"
            iconBg="#ECFDF5"
            iconColor="#059669"
            title="Exportar transacciones (CSV)"
            subtitle="Para abrir en Excel o Sheets"
            onPress={() => handleExport('csv')}
          />
        </View>

        <Text style={styles.sectionLabel}>Preferencias</Text>
        <View style={styles.group}>
          <SettingRow
            icon="color-palette-outline"
            iconBg="#F5F3FF"
            iconColor="#7C3AED"
            title="Personalización"
            subtitle={`Tema: ${themeLabel[preferences.theme]} · Privacidad, notificaciones y bloqueo`}
            onPress={() => navigation.navigate('Preferences')}
          />
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => Alert.alert('Cerrar Sesión', '¿Estás seguro de que deseas cerrar sesión?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Cerrar Sesión', style: 'destructive', onPress: logout },
          ])}
          activeOpacity={0.75}
        >
          <Ionicons name="log-out-outline" size={20} color="#DC2626" style={{ marginRight: 10 }} />
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Finanzas Personales v1.0.0</Text>

      </ScrollView>

      <Modal visible={isInfoModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContent}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Información Personal</Text>
              <TouchableOpacity onPress={() => setInfoModalVisible(false)}>
                <Ionicons name="close" size={24} color="#4B5563" />
              </TouchableOpacity>
            </View>

            <View style={styles.infoAvatarRow}>
              <View style={styles.infoAvatar}>
                <Text style={styles.infoAvatarText}>{editName.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.infoAvatarName}>{editName}</Text>
                <Text style={styles.infoAvatarSub}>@{editUsername}</Text>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nombre completo</Text>
              <View style={styles.inputRow}>
                <Ionicons name="person-outline" size={18} color="#9CA3AF" style={{ marginRight: 10 }} />
                <TextInput
                  style={styles.textInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Tu nombre"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nombre de usuario</Text>
              <View style={styles.inputRow}>
                <Text style={styles.atSymbol}>@</Text>
                <TextInput
                  style={styles.textInput}
                  value={editUsername}
                  onChangeText={setEditUsername}
                  placeholder="usuario"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Correo electrónico</Text>
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={18} color="#9CA3AF" style={{ marginRight: 10 }} />
                <TextInput
                  style={styles.textInput}
                  value={editEmail}
                  onChangeText={setEditEmail}
                  placeholder="correo@ejemplo.com"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={handleSaveInfo} disabled={isSavingInfo}>
              <Text style={styles.saveButtonText}>{isSavingInfo ? 'Guardando...' : 'Guardar Cambios'}</Text>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={isPwModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContent}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cambiar Contraseña</Text>
              <TouchableOpacity onPress={() => setPwModalVisible(false)}>
                <Ionicons name="close" size={24} color="#4B5563" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Contraseña actual</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.textInput}
                  secureTextEntry={!showCurrentPw}
                  placeholder="••••••••"
                  placeholderTextColor="#9CA3AF"
                  value={currentPw}
                  onChangeText={setCurrentPw}
                />
                <TouchableOpacity onPress={() => setShowCurrentPw(!showCurrentPw)}>
                  <Ionicons name={showCurrentPw ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nueva contraseña</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.textInput}
                  secureTextEntry={!showNewPw}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor="#9CA3AF"
                  value={newPw}
                  onChangeText={setNewPw}
                />
                <TouchableOpacity onPress={() => setShowNewPw(!showNewPw)}>
                  <Ionicons name={showNewPw ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Confirmar nueva contraseña</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.textInput}
                  secureTextEntry={true}
                  placeholder="Repite la nueva contraseña"
                  placeholderTextColor="#9CA3AF"
                  value={confirmPw}
                  onChangeText={setConfirmPw}
                />
              </View>
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={handleSavePw} disabled={isSavingPw}>
              <Text style={styles.saveButtonText}>{isSavingPw ? 'Actualizando...' : 'Actualizar Contraseña'}</Text>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const getStyles = (colors: Colors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { padding: 20, paddingBottom: 40 },

  profileCard: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  avatarContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarText: { fontSize: 30, fontWeight: 'bold', color: colors.card },
  userName: { fontSize: 22, fontWeight: 'bold', color: colors.card, marginBottom: 4 },
  userEmail: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  group: {
    backgroundColor: colors.card,
    borderRadius: 18,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  settingRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  settingIcon: {
    width: 38, height: 38, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  settingInfo: { flex: 1 },
  settingTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  settingSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  separator: { height: 1, backgroundColor: '#F9FAFB', marginLeft: 68 },

  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerLight,
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutText: { fontSize: 16, fontWeight: '600', color: colors.danger },
  version: { textAlign: 'center', fontSize: 12, color: colors.textMuted },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 32,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: colors.textPrimary },

  infoAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
  },
  infoAvatar: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: colors.success,
    justifyContent: 'center', alignItems: 'center',
  },
  infoAvatarText: { fontSize: 22, fontWeight: 'bold', color: colors.card },
  infoAvatarName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  infoAvatarSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  atSymbol: { fontSize: 16, fontWeight: '700', color: colors.textSecondary, marginRight: 6 },

  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginBottom: 8 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textInput: { flex: 1, fontSize: 16, color: colors.textPrimary },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  saveButtonText: { color: colors.card, fontSize: 16, fontWeight: 'bold' },
});
