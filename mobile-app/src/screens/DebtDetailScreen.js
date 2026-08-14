import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ScrollView, Modal, TextInput, Platform, ActivityIndicator, KeyboardAvoidingView, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import { usePreferences } from '../context/PreferencesContext';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';

const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// Ítem de transacción real
function TransactionItem({ tx, colors }) {
  const styles = getStyles(colors);
  const isAbono = tx.type === 'abono_deuda';
  return (
    <View style={styles.txItem}>
      <View style={[styles.txIcon, { backgroundColor: isAbono ? '#DCFCE7' : '#FEE2E2' }]}>
        <Ionicons
          name={isAbono ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'}
          size={18}
          color={isAbono ? '#16A34A' : '#DC2626'}
        />
      </View>
      <View style={styles.txInfo}>
        <Text style={styles.txTitle}>{tx.title}</Text>
        <Text style={styles.txDate}>{formatDate(tx.date)}</Text>
        {tx.account?.name && (
          <Text style={[styles.txDate, { color: '#6B7280' }]}>
            Cuenta: {tx.account.name}
          </Text>
        )}
      </View>
      <Text style={[styles.txAmount, { color: isAbono ? '#16A34A' : '#DC2626' }]}>
        {isAbono ? '- ' : '+ '}$ {Number(tx.amount).toLocaleString('es-CO')}
      </Text>
    </View>
  );
}

export default function DebtDetailScreen() {
  const { colors, isDark } = usePreferences();
  const styles = getStyles(colors);
  const route = useRoute();
  const navigation = useNavigation();

  const {
    title: routeTitle = 'Detalle de Deuda',
    total = '$ 0',
    color = '#3B82F6',
    icon: initialIcon = 'person',
    iconColor: initialIconColor = '#3B82F6',
    iconBg: initialIconBg = '#FEE2E2',
    type = 'debo',
  } = route.params || {};

  const isDebo = type === 'debo';

  // Personalizar ícono
  const [currentIcon, setCurrentIcon] = useState(initialIcon);
  const [currentColor, setCurrentColor] = useState(initialIconColor);
  const [currentBg, setCurrentBg] = useState(initialIconBg);
  const [isIconModalVisible, setIconModalVisible] = useState(false);

  const ICONS = ['card', 'car', 'home', 'school', 'airplane', 'bag-handle', 'cart', 'fitness', 'cash', 'person'];
  const COLORS = [
    { color: '#DC2626', bg: '#FEE2E2' },
    { color: '#3B82F6', bg: '#DBEAFE' },
    { color: '#10B981', bg: '#D1FAE5' },
    { color: '#4F46E5', bg: '#E0E7FF' },
    { color: '#F59E0B', bg: '#FEF3C7' },
    { color: '#8B5CF6', bg: '#EDE9FE' },
    { color: '#111827', bg: '#F3F4F6' },
  ];

  const { token } = useAuth();
  const [isIncreaseModalVisible, setIncreaseModalVisible] = useState(false);
  const [isDecreaseModalVisible, setDecreaseModalVisible] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [increaseAmount, setIncreaseAmount] = useState('');
  const [increaseConcept, setIncreaseConcept] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [debtDetails, setDebtDetails] = useState(null);
  const [isLoadingDebt, setIsLoadingDebt] = useState(true);

  // Cuentas y selección para abonos
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);

  // Transacciones REALES de la deuda
  const [transactions, setTransactions] = useState([]);
  const [isLoadingTx, setIsLoadingTx] = useState(true);
  const [visibleCount, setVisibleCount] = useState(10);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Carga inicial: cuentas (una sola vez)
  React.useEffect(() => {
    fetchAccounts();
  }, [token]);

  // Recarga al hacer focus: deuda y transacciones
  useFocusEffect(
    React.useCallback(() => {
      fetchDebt();
      fetchDebtTransactions();
    }, [token])
  );

  const fetchDebt = async () => {
    if (!token || !route.params?.id) return;
    setIsLoadingDebt(true);
    try {
      const { data } = await axios.get(`${API_URL}/debts/${route.params.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDebtDetails(data);
    } catch (e) {
      console.log('Error fetching debt', e?.response?.data || e.message);
    } finally {
      setIsLoadingDebt(false);
    }
  };

  const fetchDebtTransactions = async () => {
    if (!token || !route.params?.id) return;
    setIsLoadingTx(true);
    try {
      const { data } = await axios.get(`${API_URL}/debts/${route.params.id}/transactions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTransactions(data);
    } catch (e) {
      console.log('Error fetching debt transactions', e?.response?.data || e.message);
    } finally {
      setIsLoadingTx(false);
    }
  };

  const fetchAccounts = async () => {
    if (!token) return;
    try {
      const { data } = await axios.get(`${API_URL}/accounts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAccounts(data);
      if (data.length > 0) setSelectedAccount(data[0]._id);
    } catch (error) {
      console.log('Error fetching accounts for debt', error);
    }
  };

  const handlePayment = async () => {
    if (!amountInput || !selectedAccount) {
      Alert.alert('Error', 'Por favor ingresa un monto y selecciona una cuenta.');
      return;
    }
    setIsSubmitting(true);
    try {
      await axios.post(`${API_URL}/debts/${route.params.id}/payment`, {
        amount: Number(amountInput.replace(/\D/g, '')),
        accountId: selectedAccount
      }, { headers: { Authorization: `Bearer ${token}` } });

      setDecreaseModalVisible(false);
      setAmountInput('');
      fetchDebt();
      fetchDebtTransactions();
      Alert.alert('✅ Éxito', 'Abono registrado correctamente');
    } catch (e) {
      console.log('Error abonando a deuda', e?.response?.data || e.message);
      Alert.alert('Error', e?.response?.data?.message || 'No se pudo registrar el abono');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmIncrease = async () => {
    if (!increaseAmount || !debtDetails) return;
    setIsSubmitting(true);
    try {
      const amountNumber = Number(increaseAmount.replace(/\D/g, ''));
      const newTotal = debtDetails.totalAmount + amountNumber;
      const newRemaining = debtDetails.remainingAmount + amountNumber;
      await axios.put(`${API_URL}/debts/${route.params.id}`, {
        totalAmount: newTotal,
        remainingAmount: newRemaining,
        isActive: true,
      }, { headers: { Authorization: `Bearer ${token}` } });

      setIncreaseAmount('');
      setIncreaseConcept('');
      setIncreaseModalVisible(false);
      fetchDebt();
      Alert.alert('✅ Éxito', 'Aumento de deuda registrado correctamente');
    } catch (e) {
      console.log('Error aumentando deuda', e?.response?.data || e.message);
      Alert.alert('Error', 'No se pudo registrar el aumento');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveIcon = async () => {
    setIconModalVisible(false);
    // Guardar icono y color en el backend
    if (route.params?.id) {
      try {
        await axios.put(`${API_URL}/debts/${route.params.id}`, {
          icon: currentIcon,
          color: currentColor,
        }, { headers: { Authorization: `Bearer ${token}` } });
      } catch (e) {
        console.log('Error saving icon', e?.response?.data);
      }
    }
  };

  const visibleTx = transactions.slice(0, visibleCount);
  const hasMore = visibleCount < transactions.length;

  const handleLoadMore = useCallback(() => {
    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleCount(prev => Math.min(prev + 10, transactions.length));
      setIsLoadingMore(false);
    }, 400);
  }, [transactions.length]);

  const debtName = debtDetails?.name || routeTitle;
  const debtRemaining = debtDetails
    ? `$ ${debtDetails.remainingAmount.toLocaleString('es-CO')}`
    : total;
  const debtTotal = debtDetails
    ? `$ ${debtDetails.totalAmount.toLocaleString('es-CO')}`
    : total;
  const progress = debtDetails && debtDetails.totalAmount > 0
    ? Math.max(0, Math.min(1, (debtDetails.totalAmount - debtDetails.remainingAmount) / debtDetails.totalAmount))
    : 0;

  return (
    <SafeAreaView style={styles.safeArea}>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Tarjeta principal ── */}
        <View style={styles.card}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setIconModalVisible(true)}
            style={styles.iconWrapper}
          >
            <View style={[styles.iconContainer, { backgroundColor: currentBg }]}>
              <Ionicons name={debtDetails?.icon || currentIcon} size={36} color={debtDetails?.color || currentColor} />
            </View>
            <View style={styles.editIconBadge}>
              <Ionicons name="pencil" size={12} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          <Text style={styles.typeLabel}>{isDebo ? 'Yo debo a' : 'Me deben'}</Text>
          <Text style={styles.title}>{debtName}</Text>

          {/* Barra de progreso de pago */}
          {debtDetails && (
            <View style={styles.progressContainer}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: color }]} />
              </View>
              <Text style={styles.progressText}>
                {Math.round(progress * 100)}% pagado
              </Text>
            </View>
          )}

          <View style={styles.divider} />

          <Text style={styles.amountLabel}>Valor adeudado</Text>
          {isLoadingDebt ? (
            <ActivityIndicator color={color} size="small" style={{ marginTop: 8 }} />
          ) : (
            <Text style={[styles.amountValue, { color }]}>{debtRemaining}</Text>
          )}

          <Text style={[styles.amountLabel, { marginTop: 12 }]}>Total original</Text>
          <Text style={[styles.amountValueSmall, { color: colors.textSecondary }]}>{debtTotal}</Text>

          {debtDetails?.dueDate && (
            <View style={styles.dueDateBadge}>
              <Ionicons name="calendar-outline" size={14} color="#F59E0B" />
              <Text style={styles.dueDateText}>
                Vence: {formatDate(debtDetails.dueDate)}
              </Text>
            </View>
          )}

          {debtDetails && !debtDetails.isActive && (
            <View style={[styles.dueDateBadge, { backgroundColor: '#DCFCE7', marginTop: 8 }]}>
              <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
              <Text style={[styles.dueDateText, { color: '#16A34A' }]}>Deuda Saldada ✅</Text>
            </View>
          )}
        </View>

        {/* ── Movimientos Relacionados REALES ── */}
        <View style={styles.txSection}>
          <Text style={styles.txSectionTitle}>Movimientos Relacionados</Text>

          {isLoadingTx ? (
            <View style={styles.txEmpty}>
              <ActivityIndicator color={color} size="small" />
              <Text style={styles.txEmptyText}>Cargando movimientos...</Text>
            </View>
          ) : visibleTx.length === 0 ? (
            <View style={styles.txEmpty}>
              <Ionicons name="document-text-outline" size={40} color="#D1D5DB" />
              <Text style={styles.txEmptyText}>No hay movimientos aún</Text>
              <Text style={[styles.txEmptyText, { fontSize: 13, marginTop: 4 }]}>
                Registra un abono para verlo aquí
              </Text>
            </View>
          ) : (
            <View style={styles.txList}>
              {visibleTx.map((tx, idx) => (
                <View key={tx._id}>
                  <TransactionItem tx={tx} colors={colors} />
                  {idx < visibleTx.length - 1 && <View style={styles.txDivider} />}
                </View>
              ))}
            </View>
          )}

          {isLoadingMore && (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="small" color="#059669" />
              <Text style={styles.loaderText}>Cargando más...</Text>
            </View>
          )}

          {hasMore && !isLoadingMore && (
            <TouchableOpacity
              style={styles.loadMoreButton}
              onPress={handleLoadMore}
              activeOpacity={0.7}
            >
              <Text style={styles.loadMoreText}>
                Ver más ({transactions.length - visibleCount} restantes)
              </Text>
              <Ionicons name="chevron-down" size={16} color="#059669" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* ── Botonera anclada al fondo ── */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.barBtn}
          onPress={() => setDecreaseModalVisible(true)}
          activeOpacity={0.7}
        >
          <View style={[styles.barBtnIcon, { backgroundColor: '#DCFCE7' }]}>
            <Ionicons name="arrow-down-circle-outline" size={22} color="#16A34A" />
          </View>
          <Text style={[styles.barBtnLabel, { color: '#16A34A' }]}>Disminuir</Text>
        </TouchableOpacity>

        <View style={styles.barSeparator} />

        <TouchableOpacity
          style={styles.barBtn}
          onPress={() => setIncreaseModalVisible(true)}
          activeOpacity={0.7}
        >
          <View style={[styles.barBtnIcon, { backgroundColor: '#FEE2E2' }]}>
            <Ionicons name="arrow-up-circle-outline" size={22} color="#DC2626" />
          </View>
          <Text style={[styles.barBtnLabel, { color: '#DC2626' }]}>Aumentar</Text>
        </TouchableOpacity>

        <View style={styles.barSeparator} />

        <TouchableOpacity
          style={styles.barBtn}
          onPress={() =>
            navigation.navigate('AddDebt', {
              isModifyMode: true,
              initialDebtType: type,
              debtId: route.params?.id,
            })
          }
          activeOpacity={0.7}
        >
          <View style={[styles.barBtnIcon, { backgroundColor: '#F3F4F6' }]}>
            <Ionicons name="pencil-outline" size={22} color="#374151" />
          </View>
          <Text style={[styles.barBtnLabel, { color: '#374151' }]}>Modificar</Text>
        </TouchableOpacity>
      </View>

      {/* ── Modal Aumentar Deuda ── */}
      <Modal visible={isIncreaseModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Registrar Aumento</Text>
              <TouchableOpacity onPress={() => setIncreaseModalVisible(false)}>
                <Ionicons name="close" size={24} color="#4B5563" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Aumenta el monto total de la deuda (p. ej. por intereses o nuevos cargos).
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Monto a aumentar</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                placeholder="Ej. 50000"
                placeholderTextColor="#9CA3AF"
                value={increaseAmount}
                onChangeText={setIncreaseAmount}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Concepto (opcional)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ej. Intereses generados"
                placeholderTextColor="#9CA3AF"
                value={increaseConcept}
                onChangeText={setIncreaseConcept}
              />
            </View>

            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: '#DC2626' }]}
              onPress={handleConfirmIncrease}
              disabled={isSubmitting}
            >
              {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>Registrar Aumento</Text>}
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── Modal Personalizar Ícono ── */}
      <Modal visible={isIconModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Personalizar Ícono</Text>
              <TouchableOpacity onPress={() => setIconModalVisible(false)}>
                <Ionicons name="close" size={24} color="#4B5563" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Selecciona un Ícono</Text>
            <View style={styles.iconGrid}>
              {ICONS.map((ico) => (
                <TouchableOpacity
                  key={ico}
                  style={[styles.iconChoice, currentIcon === ico && { borderColor: currentColor, borderWidth: 2 }]}
                  onPress={() => setCurrentIcon(ico)}
                >
                  <Ionicons name={ico} size={28} color={currentIcon === ico ? currentColor : '#9CA3AF'} />
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.inputLabel, { marginTop: 16 }]}>Selecciona un Color</Text>
            <View style={styles.colorGrid}>
              {COLORS.map((c, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.colorChoice, { backgroundColor: c.color }, currentColor === c.color && styles.colorChoiceActive]}
                  onPress={() => { setCurrentColor(c.color); setCurrentBg(c.bg); }}
                >
                  {currentColor === c.color && <Ionicons name="checkmark" size={20} color="#FFFFFF" />}
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={handleSaveIcon}>
              <Text style={styles.saveButtonText}>Aceptar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Modal de Abono (Disminuir) ── */}
      <Modal visible={isDecreaseModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Abonar a Deuda</Text>
              <TouchableOpacity onPress={() => setDecreaseModalVisible(false)}>
                <Ionicons name="close" size={24} color="#4B5563" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Restante: <Text style={{ fontWeight: 'bold', color }}>{debtRemaining}</Text>
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Monto a abonar</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                placeholder="Ej. 100000"
                placeholderTextColor="#9CA3AF"
                value={amountInput}
                onChangeText={setAmountInput}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Cuenta de Origen</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                {accounts.map(acc => (
                  <TouchableOpacity
                    key={acc._id}
                    style={{
                      padding: 12,
                      backgroundColor: selectedAccount === acc._id ? (acc.color || '#059669') : '#F3F4F6',
                      borderRadius: 12,
                      marginRight: 10,
                      borderWidth: selectedAccount === acc._id ? 2 : 0,
                      borderColor: '#111827'
                    }}
                    onPress={() => setSelectedAccount(acc._id)}
                  >
                    <Text style={{ color: selectedAccount === acc._id ? '#FFFFFF' : '#4B5563', fontWeight: 'bold' }}>
                      {acc.name}
                    </Text>
                    <Text style={{ color: selectedAccount === acc._id ? '#F0FFF4' : '#9CA3AF', fontSize: 12 }}>
                      $ {acc.balance?.toLocaleString('es-CO')}
                    </Text>
                  </TouchableOpacity>
                ))}
                {accounts.length === 0 && (
                  <Text style={{ color: '#9CA3AF', fontSize: 14 }}>No tienes cuentas</Text>
                )}
              </ScrollView>
            </View>

            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: '#059669' }]}
              onPress={handlePayment}
              disabled={isSubmitting}
            >
              {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveButtonText}>Confirmar Abono</Text>}
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: {
    padding: 24,
    paddingBottom: 120,
  },

  // Tarjeta principal
  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 30,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  iconWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.card,
  },
  typeLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    marginBottom: 16,
    alignItems: 'center',
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    width: '100%',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: colors.iconBg || '#F3F4F6',
    width: '100%',
    marginBottom: 20,
  },
  amountLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountValue: {
    fontSize: 36,
    fontWeight: 'bold',
    letterSpacing: -0.5,
  },
  amountValueSmall: {
    fontSize: 18,
    fontWeight: '600',
  },
  dueDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
  },
  dueDateText: {
    fontSize: 13,
    color: '#D97706',
    fontWeight: '600',
  },

  // Sección transacciones
  txSection: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  txSectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  txList: {},
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  txIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  txInfo: { flex: 1 },
  txTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  txDate: { fontSize: 12, color: colors.textMuted || '#9CA3AF', marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: 'bold' },
  txDivider: { height: 1, backgroundColor: colors.border || '#F3F4F6', marginLeft: 50 },
  txEmpty: {
    alignItems: 'center',
    paddingVertical: 30,
    gap: 10,
  },
  txEmptyText: { fontSize: 15, color: colors.textMuted || '#9CA3AF', textAlign: 'center' },
  loaderContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  loaderText: { fontSize: 14, color: colors.textSecondary },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: colors.iconBg || '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 20,
  },
  barBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  barBtnIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  barBtnLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  barSeparator: {
    width: 1,
    height: 40,
    backgroundColor: colors.iconBg || '#F3F4F6',
  },

  // Modal
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
    marginBottom: 8,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: colors.textPrimary },
  modalSubtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 20, lineHeight: 20 },
  inputGroup: { marginBottom: 18 },
  inputLabel: { fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginBottom: 8 },
  textInput: {
    backgroundColor: colors.background || '#F9FAFB',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 16,
    color: colors.textPrimary,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Icon / Color grid
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 10,
  },
  iconChoice: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
  },
  colorChoice: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorChoiceActive: {
    borderColor: colors.textPrimary,
  },
});
