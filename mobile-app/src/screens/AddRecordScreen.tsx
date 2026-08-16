import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  ScrollView, Modal, ActivityIndicator, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { usePreferences } from '../context/PreferencesContext';
import apiClient from '../services/apiClient';
import { getErrorMessage } from '../utils/apiError';
import { Account, Debt } from '../types/models';
import { RootStackParamList, AppNavigation } from '../navigation/types';

type Colors = ReturnType<typeof usePreferences>['colors'];
type RecordType = 'abono_deuda' | 'ingreso' | 'gasto';

const getTransactionTypes = (colors: Colors): { key: RecordType; label: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }[] => [
  {
    key: 'abono_deuda',
    label: 'Abono a Deuda',
    icon: 'return-down-back',
    color: colors.purple,
    bg: colors.purpleLight,
  },
  {
    key: 'ingreso',
    label: 'Ingreso',
    icon: 'arrow-up-circle',
    color: colors.successText,
    bg: colors.successLight,
  },
  {
    key: 'gasto',
    label: 'Gasto',
    icon: 'arrow-down-circle',
    color: colors.danger,
    bg: colors.dangerLight,
  },
];

export default function AddRecordScreen() {
  const { colors } = usePreferences();
  const styles = getStyles(colors);
  const TRANSACTION_TYPES = getTransactionTypes(colors);
  const navigation = useNavigation<AppNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, 'AddRecord'>>();

  // Recibe el tipo inicial y (opcional) la cuenta preseleccionada desde la pantalla de origen
  const initialType = route.params?.initialType || 'gasto';
  const preselectedAccount = route.params?.preselectedAccount;
  const [recordType, setRecordType] = useState<RecordType>(initialType);

  const { token } = useAuth();
  const [amount, setAmount] = useState('');
  const [concept, setConcept] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);

  // Modals state
  const [isAccountModalVisible, setAccountModalVisible] = useState(false);
  const [isDebtModalVisible, setDebtModalVisible] = useState(false);
  const [modalTarget, setModalTarget] = useState<'origin' | 'dest' | null>(null);

  // Selections
  const [selectedOriginAccount, setSelectedOriginAccount] = useState(preselectedAccount || '');
  const [selectedDestAccount, setSelectedDestAccount] = useState(preselectedAccount || '');
  const [selectedDebt, setSelectedDebt] = useState(''); // ID de la deuda a abonar

  React.useEffect(() => {
    fetchAccounts();
    fetchDebts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchAccounts = async () => {
    if (!token) return;
    try {
      const { data } = await apiClient.get<Account[]>('/accounts');
      setAccounts(data);
    } catch (error) {
      console.log('Error fetching accounts', error);
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  const fetchDebts = async () => {
    if (!token) return;
    try {
      const { data } = await apiClient.get<Debt[]>('/debts');
      setDebts(data.filter((d) => d.isActive)); // Solo deudas activas
    } catch (error) {
      console.log('Error fetching debts', error);
    }
  };

  const handleSave = async () => {
    if (!amount) {
      Alert.alert('Error', 'Por favor ingresa un monto.');
      return;
    }
    if (!concept && recordType !== 'abono_deuda') {
      Alert.alert('Error', 'Por favor ingresa un concepto.');
      return;
    }

    // Validar cuenta seleccionada
    const accountSelected = recordType === 'ingreso' ? selectedDestAccount : selectedOriginAccount;
    if (!accountSelected) {
      Alert.alert('Error', 'Por favor selecciona una cuenta.');
      return;
    }

    if (recordType === 'abono_deuda' && !selectedDebt) {
      Alert.alert('Error', 'Por favor selecciona la deuda a abonar.');
      return;
    }

    setIsSubmitting(true);

    // Map 'gasto' to 'egreso' for the backend
    const backendType = recordType === 'gasto' ? 'egreso' : recordType;

    try {
      if (recordType === 'abono_deuda') {
        await apiClient.post(`/debts/${selectedDebt}/payment`, {
          amount: Number(amount.replace(/\D/g, '')),
          accountId: accountSelected,
          date: new Date(),
        });
      } else {
        await apiClient.post('/transactions', {
          title: concept,
          amount: Number(amount.replace(/\D/g, '')),
          type: backendType,
          account: accountSelected,
        });
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error, 'No se pudo guardar la transacción.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAccountModal = (target: 'origin' | 'dest') => {
    setModalTarget(target);
    setAccountModalVisible(true);
  };

  const handleAccountSelection = (accountId: string) => {
    if (modalTarget === 'origin') setSelectedOriginAccount(accountId);
    if (modalTarget === 'dest') setSelectedDestAccount(accountId);
    setAccountModalVisible(false);
  };

  const getAccountName = (id: string) => {
    const acc = accounts.find((a) => a._id === id);
    return acc ? acc.name : '';
  };

  const getDebtName = (id: string) => {
    const d = debts.find((d) => d._id === id);
    return d ? `${d.name} ($${d.remainingAmount.toLocaleString('es-CO')})` : '';
  };

  const activeType = TRANSACTION_TYPES.find((t) => t.key === recordType);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Selector de Tipo de Transacción ── */}
          <Text style={styles.sectionTitle}>Tipo de Transacción</Text>
          <View style={styles.typeCardsRow}>
            {TRANSACTION_TYPES.map((type) => {
              const isActive = recordType === type.key;
              return (
                <TouchableOpacity
                  key={type.key}
                  style={[
                    styles.typeCard,
                    isActive && { borderColor: type.color, borderWidth: 2 },
                    { backgroundColor: isActive ? type.bg : colors.iconBg },
                  ]}
                  onPress={() => setRecordType(type.key)}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={type.icon}
                    size={22}
                    color={isActive ? type.color : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.typeCardLabel,
                      isActive && { color: type.color, fontWeight: '700' },
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Monto ── */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Monto</Text>
            <View style={styles.amountInputContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0"
                keyboardType="numeric"
                placeholderTextColor={colors.textMuted}
                value={amount}
                onChangeText={setAmount}
              />
            </View>
          </View>

          {/* ── Concepto — Oculto en abono_deuda ── */}
          {recordType !== 'abono_deuda' && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Concepto o Descripción</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="document-text-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Ej. Salario, Cena, Pago tarjeta..."
                  placeholderTextColor={colors.textMuted}
                  value={concept}
                  onChangeText={setConcept}
                />
              </View>
            </View>
          )}

          {/* Cuenta Origen — Gasto o Abono a Deuda */}
          {(recordType === 'gasto' || recordType === 'abono_deuda') && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Cuenta Origen</Text>
              <TouchableOpacity
                style={styles.inputContainer}
                onPress={() => openAccountModal('origin')}
              >
                <Ionicons name="wallet-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                <Text style={[styles.textInput, !selectedOriginAccount && { color: colors.textMuted }]}>
                  {getAccountName(selectedOriginAccount) || '¿De dónde sale el dinero?'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          )}

          {/* Cuenta Destino — Ingreso */}
          {recordType === 'ingreso' && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Cuenta Destino</Text>
              <TouchableOpacity
                style={styles.inputContainer}
                onPress={() => openAccountModal('dest')}
              >
                <Ionicons name="log-in-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                <Text style={[styles.textInput, !selectedDestAccount && { color: colors.textMuted }]}>
                  {getAccountName(selectedDestAccount) || '¿A dónde entra el dinero?'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          )}

          {/* Deuda a abonar — solo para Abono a Deuda */}
          {recordType === 'abono_deuda' && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Deuda / Préstamo abonado</Text>
              <TouchableOpacity
                style={styles.inputContainer}
                onPress={() => setDebtModalVisible(true)}
              >
                <Ionicons name="card-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                <Text style={[styles.textInput, !selectedDebt && { color: colors.textMuted }]}>
                  {getDebtName(selectedDebt) || 'Selecciona la deuda a abonar'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          )}

          {/* ── Botón guardar ── */}
          <TouchableOpacity
            style={[styles.saveButton, activeType && { backgroundColor: activeType.color }]}
            onPress={handleSave}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text style={styles.saveButtonText}>Guardar Transacción</Text>
            )}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal Selección de Cuenta */}
      <Modal visible={isAccountModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Selecciona una Cuenta</Text>
            <ScrollView>
              {accounts.map((acc) => (
                <TouchableOpacity
                  key={acc._id}
                  style={styles.modalItem}
                  onPress={() => handleAccountSelection(acc._id)}
                >
                  <Ionicons name={(acc.icon || 'wallet-outline') as any} size={20} color={acc.color || colors.info} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={styles.modalItemName}>{acc.name}</Text>
                    <Text style={styles.modalItemBalance}>
                      $ {acc.balance.toLocaleString('es-CO')}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
              {accounts.length === 0 && (
                <Text style={{ textAlign: 'center', color: colors.textMuted, padding: 20 }}>
                  No tienes cuentas registradas
                </Text>
              )}
            </ScrollView>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setAccountModalVisible(false)}>
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Selección de Deuda */}
      <Modal visible={isDebtModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Selecciona una Deuda</Text>
            <ScrollView>
              {debts.map((debt) => (
                <TouchableOpacity
                  key={debt._id}
                  style={styles.modalItem}
                  onPress={() => {
                    setSelectedDebt(debt._id);
                    setDebtModalVisible(false);
                  }}
                >
                  <Ionicons name={(debt.icon || 'person') as any} size={20} color={debt.color || colors.danger} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={styles.modalItemName}>{debt.name}</Text>
                    <Text style={[styles.modalItemBalance, { color: colors.danger }]}>
                      Restante: $ {debt.remainingAmount.toLocaleString('es-CO')}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
              {debts.length === 0 && (
                <Text style={{ textAlign: 'center', color: colors.textMuted, padding: 20 }}>
                  No tienes deudas activas
                </Text>
              )}
            </ScrollView>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setDebtModalVisible(false)}>
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const getStyles = (colors: Colors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: 24,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  typeCardsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  typeCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 16,
    backgroundColor: colors.iconBg,
    gap: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeCardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
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
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  saveButtonText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  modalItemBalance: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modalCancelBtn: {
    marginTop: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: colors.border,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
