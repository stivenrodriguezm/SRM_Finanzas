import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TextInput, ScrollView,
  TouchableOpacity, Switch, Platform, KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePreferences } from '../context/PreferencesContext';
import apiClient from '../services/apiClient';
import { Account } from '../types/models';
import { DEBT_ACCENT } from '../theme/theme';

type Colors = ReturnType<typeof usePreferences>['colors'];

interface AccountFormModalProps {
  visible: boolean;
  mode: 'add' | 'edit';
  account?: Account | null;
  /** Preselecciona "¿Es cuenta de deuda?" al crear (ignorado en modo "edit", que parte del valor de `account`). */
  initialLiability?: boolean;
  onClose: () => void;
  /** Se llama tras crear/editar/eliminar con éxito, para que la pantalla que lo abrió refresque su lista. */
  onSaved: () => void;
}

/** Modal de crear/editar cuenta, compartido entre Balance ("Agregar") y Deudas ("Agregar Cuenta de Deuda"). */
export default function AccountFormModal({
  visible, mode, account = null, initialLiability = false, onClose, onSaved,
}: AccountFormModalProps) {
  const { colors } = usePreferences();
  const styles = getStyles(colors);

  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [description, setDescription] = useState('');
  const [isLiability, setIsLiability] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(account?.name || '');
    setBalance(account?.balance ? String(account.balance) : '');
    setDescription(account?.description || '');
    setIsLiability(account ? account.isLiability : initialLiability);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleSave = async () => {
    if (!name) {
      alert('Por favor ingresa un nombre para la cuenta');
      return;
    }
    setIsSaving(true);
    try {
      if (mode === 'add') {
        await apiClient.post('/accounts', {
          name,
          balance: Number(balance) || 0,
          isLiability,
          description,
          color: isLiability ? DEBT_ACCENT : '#059669',
          icon: isLiability ? 'card' : 'wallet',
        });
      } else if (account) {
        await apiClient.put(`/accounts/${account._id}`, {
          name,
          balance: Number(balance) || 0,
          isLiability,
          description,
        });
      }
      onClose();
      onSaved();
    } catch (error) {
      console.log('Error saving account', error);
      alert('Hubo un error al guardar la cuenta');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!account) return;
    setIsSaving(true);
    try {
      await apiClient.delete(`/accounts/${account._id}`);
      onClose();
      onSaved();
    } catch (error) {
      console.log('Error deleting account', error);
      alert('Hubo un error al eliminar la cuenta');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContent}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {mode === 'add' ? 'Nueva Cuenta' : 'Detalles de la Cuenta'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nombre de la cuenta</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="card-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Ej. Mi Cuenta de Ahorros"
                  placeholderTextColor={colors.textMuted}
                  value={name}
                  onChangeText={setName}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Saldo Actual</Text>
              <View style={styles.amountInputContainer}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0.00"
                  keyboardType="numeric"
                  placeholderTextColor={colors.textMuted}
                  value={balance}
                  onChangeText={setBalance}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Descripción / Notas</Text>
              <View style={[styles.inputContainer, { alignItems: 'flex-start' }]}>
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color={colors.textMuted}
                  style={[styles.inputIcon, { marginTop: 2 }]}
                />
                <TextInput
                  style={[styles.textInput, { minHeight: 60, textAlignVertical: 'top' }]}
                  placeholder="Ej. Cuenta de ahorros para emergencias..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  value={description}
                  onChangeText={setDescription}
                />
              </View>
            </View>

            <View style={[styles.inputGroup, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
              <View>
                <Text style={styles.inputLabel}>¿Es una cuenta de deuda?</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>Ej. Tarjetas de crédito, préstamos.</Text>
              </View>
              <Switch
                value={isLiability}
                onValueChange={setIsLiability}
                trackColor={{ false: colors.border, true: colors.danger }}
                thumbColor={colors.white}
              />
            </View>
          </ScrollView>

          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text style={styles.saveButtonText}>
                {mode === 'add' ? 'Crear Cuenta' : 'Guardar Cambios'}
              </Text>
            )}
          </TouchableOpacity>

          {mode === 'edit' && (
            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} disabled={isSaving}>
              <Text style={styles.deleteButtonText}>Eliminar Cuenta</Text>
            </TouchableOpacity>
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const getStyles = (colors: Colors) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 32,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.iconBg,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.iconBg,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  saveButtonText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: 'bold',
  },
  deleteButton: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: colors.dangerLight,
  },
  deleteButtonText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
