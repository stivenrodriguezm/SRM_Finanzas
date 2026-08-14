import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ScrollView, Modal, TextInput, Switch, Platform, KeyboardAvoidingView, ActivityIndicator,
  RefreshControl
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import SkeletonLoader from '../components/SkeletonLoader';
import { usePreferences } from '../context/PreferencesContext';
import { useAuth } from '../context/AuthContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { API_URL } from '../config/api';

export default function HomeScreen() {
    const { preferences, colors, isDark } = usePreferences();
  const styles = getStyles(colors);
const navigation = useNavigation();
  const { user, token } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [debts, setDebts] = useState([]);
  const [reminders, setReminders] = useState([]);

  useFocusEffect(
    React.useCallback(() => {
      fetchData();
    }, [token])
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [token]);

  const fetchData = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [accRes, debtsRes, remRes] = await Promise.all([
        axios.get(`${API_URL}/accounts`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/debts`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/reminders`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      // Sort accounts based on user.preferences.accountOrder
      let fetchedAccounts = accRes.data;
      if (user?.preferences?.accountOrder && user.preferences.accountOrder.length > 0) {
        const orderMap = new Map(user.preferences.accountOrder.map((id, index) => [id, index]));
        fetchedAccounts.sort((a, b) => {
          const aIndex = orderMap.has(a._id) ? orderMap.get(a._id) : 999;
          const bIndex = orderMap.has(b._id) ? orderMap.get(b._id) : 999;
          return aIndex - bIndex;
        });
      }
      setAccounts(fetchedAccounts);
      
      // Inicializar selectedAccounts de las preferencias o seleccionar todas por defecto
      if (user?.preferences?.selectedAccounts && user.preferences.selectedAccounts.length > 0) {
        setSelectedAccounts(user.preferences.selectedAccounts);
      } else {
        setSelectedAccounts(fetchedAccounts.map(a => a._id));
      }
      
      setDebts(debtsRes.data);
      setReminders(remRes.data);
    } catch (error) {
      console.log('Error fetching home data', error);
    } finally {
      setIsLoading(false);
    }
  };

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedAccounts, setSelectedAccounts] = useState([]);

  // ── Estado modo privado ──────────────────────────────
  const [isPrivate, setIsPrivate] = useState(preferences.privacy.home);
  
  React.useEffect(() => {
    setIsPrivate(preferences.privacy.home);
  }, [preferences.privacy.home]);

  // ── Estado modal cuentas ────────────────────────────
  const [isAccountModalVisible, setAccountModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [isLiability, setIsLiability] = useState(false);
  const [accountDescription, setAccountDescription] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountBalance, setAccountBalance] = useState('');
  const [isSavingAccount, setIsSavingAccount] = useState(false);

  const openAccountModal = (mode, account = null) => {
    setModalMode(mode);
    setSelectedAccount(account);
    setAccountName(account?.name || '');
    setAccountBalance(account?.balance ? String(account.balance) : '');
    setIsLiability(account?.isLiability || false);
    setAccountDescription(account?.description || '');
    setAccountModalVisible(true);
  };

  
  const handleSaveAccount = async () => {
    if (!accountName) {
      alert('Por favor ingresa un nombre para la cuenta');
      return;
    }
    setIsSavingAccount(true);
    try {
      if (modalMode === 'add') {
        await axios.post(`${API_URL}/accounts`, {
          name: accountName,
          balance: Number(accountBalance) || 0,
          isLiability,
          description: accountDescription,
          color: isLiability ? '#DC2626' : '#059669',
          icon: isLiability ? 'card' : 'wallet'
        }, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        await axios.put(`${API_URL}/accounts/${selectedAccount._id}`, {
          name: accountName,
          balance: Number(accountBalance) || 0,
          isLiability,
          description: accountDescription
        }, { headers: { Authorization: `Bearer ${token}` } });
      }
      setAccountModalVisible(false);
      fetchData(); // Refresh list
    } catch (error) {
      console.log('Error saving account', error);
      alert('Hubo un error al guardar la cuenta');
    } finally {
      setIsSavingAccount(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!selectedAccount) return;
    setIsSavingAccount(true);
    try {
      await axios.delete(`${API_URL}/accounts/${selectedAccount._id}`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      setAccountModalVisible(false);
      fetchData();
    } catch (error) {
      console.log('Error deleting account', error);
      alert('Hubo un error al eliminar la cuenta');
    } finally {
      setIsSavingAccount(false);
    }
  };

  /** Muestra el valor o asteriscos según modo privado */
  const maskValue = (value) => (isPrivate ? '$ ••••••' : value);

  const { updateUserLocal } = useAuth();

  const toggleSelectionMode = () => {
    if (isSelectionMode) {
      setIsSelectionMode(false);
    } else {
      setIsSelectionMode(true);
    }
  };

  const toggleAccountSelection = async (id) => {
    let newSelected;
    if (selectedAccounts.includes(id)) {
      newSelected = selectedAccounts.filter(aId => aId !== id);
    } else {
      newSelected = [...selectedAccounts, id];
    }
    setSelectedAccounts(newSelected);
    
    // Guardar en backend
    try {
      const res = await axios.put(`${API_URL}/auth/preferences`, { selectedAccounts: newSelected }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      updateUserLocal(res.data);
    } catch (e) {
      console.log('Error saving selected accounts', e);
    }
  };

  const handleDragEnd = async ({ data }) => {
    const newOrderIds = data.map(a => a._id);
    const existingOrder = user?.preferences?.accountOrder || [];
    // Preserve order of items not currently rendered (hidden items)
    const missingIds = existingOrder.filter(id => !newOrderIds.includes(id));
    const mergedOrder = [...newOrderIds, ...missingIds];

    if (isSelectionMode) {
      setAccounts(data);
    } else {
      const orderMap = new Map(mergedOrder.map((id, index) => [id, index]));
      const newAccounts = [...accounts].sort((a, b) => {
        const aIndex = orderMap.has(a._id) ? orderMap.get(a._id) : 999;
        const bIndex = orderMap.has(b._id) ? orderMap.get(b._id) : 999;
        return aIndex - bIndex;
      });
      setAccounts(newAccounts);
    }

    try {
      const res = await axios.put(`${API_URL}/auth/preferences`, { accountOrder: mergedOrder }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      updateUserLocal(res.data);
    } catch (e) {
      console.log('Error saving account order', e);
    }
  };

  const calculateNetWorth = () => {
    const relevantAccounts = accounts.filter(a => selectedAccounts.includes(a._id));
      
    return relevantAccounts.reduce((acc, current) => {
      // Las cuentas de deuda restan al patrimonio neto
      return acc + (current.isLiability ? -current.balance : current.balance);
    }, 0);
  };

  const netWorth = calculateNetWorth();
  const allSelected = accounts.length > 0 && selectedAccounts.length === accounts.length;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safeArea}>
        {/* Tarea 2: íconos de sistema oscuros o claros */}
        <StatusBar style={isDark ? "light" : "dark"} />
      {isLoading ? (
        <View style={{ paddingTop: 20 }}>
          <View style={{ paddingHorizontal: 20, marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ height: 28, width: 150, backgroundColor: '#E5E7EB', borderRadius: 8 }} />
            <View style={{ height: 32, width: 32, backgroundColor: '#E5E7EB', borderRadius: 16 }} />
          </View>
          <SkeletonLoader type="card" />
          <SkeletonLoader type="list" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#059669"
              colors={['#059669']}
            />
          }
        >

          {/* ── Cabecera / Patrimonio Neto ── */}
          <View style={styles.header}>
            <View style={styles.headerTopRow}>
              <View>
                <Text style={styles.greeting}>Hola {user?.name?.split(' ')[0] || 'Stiven'} 👋</Text>
                <Text style={styles.netWorthLabel}>{allSelected ? 'Patrimonio Neto' : 'Suma Neta'}</Text>
              </View>
              <View style={styles.headerActions}>
                {/* Botón ojo: modo privado */}
                <TouchableOpacity
                  style={styles.headerIconButton}
                  onPress={() => setIsPrivate(!isPrivate)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isPrivate ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color="#94A3B8"
                  />
                </TouchableOpacity>
                {/* Tarea 3: Botón de Perfil */}
                <TouchableOpacity
                  style={styles.headerIconButton}
                  onPress={() => navigation.navigate('Perfil')}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="person-circle-outline"
                    size={26}
                    color="#94A3B8"
                  />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.netWorthAmount}>{maskValue(`$ ${netWorth.toLocaleString('es-CO')}`)}</Text>
          </View>

          {/* ── Mis Cuentas ── */}
          <View style={styles.sectionContainer}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Mis Cuentas</Text>
              <TouchableOpacity onPress={toggleSelectionMode} style={{ padding: 4 }}>
                <Ionicons name={isSelectionMode ? "checkmark-done-outline" : "options-outline"} size={24} color={isSelectionMode ? colors.primary : colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <DraggableFlatList
              horizontal
              data={isSelectionMode ? accounts : accounts.filter(a => selectedAccounts.includes(a._id))}
              onDragEnd={handleDragEnd}
              keyExtractor={(item) => item._id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.accountsScrollContent}
              renderItem={({ item: account, drag, isActive }) => {
                const isSelected = selectedAccounts.includes(account._id);
                const isHidden = isSelectionMode && !isSelected;
                
                return (
                  <ScaleDecorator>
                    <TouchableOpacity
                      onLongPress={drag}
                      disabled={isActive}
                      style={[styles.accountCard, {
                        backgroundColor: account.color ? `${account.color}25` : '#E5E7EB33',
                        opacity: isHidden ? 0.5 : 1,
                        borderWidth: 1,
                        borderColor: account.color ? `${account.color}40` : '#E5E7EB',
                        elevation: isActive ? 5 : 0,
                      }]}
                      onPress={() => {
                        if (isSelectionMode) toggleAccountSelection(account._id);
                        else navigation.navigate('AccountDetail', { accountId: account._id });
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        <View style={[styles.accountIcon, { marginBottom: 0, marginRight: 8, backgroundColor: account.color || colors.primary }]}>
                          <Ionicons name={account.icon || 'wallet'} size={18} color="#fff" />
                        </View>
                        <Text style={[styles.accountName, { flex: 1, marginBottom: 0 }]} numberOfLines={1}>
                          {account.name}
                        </Text>
                      </View>
                      
                      {account.isLiability && !isHidden && (
                        <View style={{ backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start', marginBottom: 4 }}>
                          <Text style={{ color: account.color || colors.textPrimary, fontSize: 10, fontWeight: '700' }}>DEUDA</Text>
                        </View>
                      )}
                      
                      <Text style={styles.accountBalance}>
                        {maskValue(`$ ${account.balance.toLocaleString('es-CO')}`)}
                      </Text>
                      
                      {isSelectionMode && (
                        <View style={{ position: 'absolute', top: 12, right: 12 }}>
                          <Ionicons name={isSelected ? "eye-outline" : "eye-off-outline"} size={20} color={isSelected ? colors.primary : colors.textMuted} />
                        </View>
                      )}
                    </TouchableOpacity>
                  </ScaleDecorator>
                );
              }}
              ListFooterComponent={() => (
                <TouchableOpacity
                  style={[styles.accountCard, styles.addAccountCard]}
                  onPress={() => openAccountModal('add')}
                >
                  <View style={[styles.accountIcon, { backgroundColor: '#E2E8F0' }]}>
                    <Ionicons name="add" size={24} color="#475569" />
                  </View>
                  <Text style={styles.addAccountText}>Agregar</Text>
                </TouchableOpacity>
              )}
            />
          </View>

          {/* ── Acciones Rápidas — orden: Abono Deuda, Ingreso, Gasto (tarea 1) ── */}
          <View style={styles.quickActionsContainer}>
            {/* 1. Abono a Deuda */}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('AddRecord', { initialType: 'abono_deuda' })}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="return-down-back" size={24} color="#7C3AED" />
              </View>
              <Text style={styles.actionText}>{'Abono\nDeuda'}</Text>
            </TouchableOpacity>

            {/* 2. Ingreso */}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('AddRecord', { initialType: 'ingreso' })}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="arrow-up" size={24} color="#16A34A" />
              </View>
              <Text style={styles.actionText}>Ingreso</Text>
            </TouchableOpacity>

            {/* 3. Gasto */}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('AddRecord', { initialType: 'gasto' })}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="arrow-down" size={24} color="#DC2626" />
              </View>
              <Text style={styles.actionText}>Gasto</Text>
            </TouchableOpacity>
          </View>

          {/* ── Gestión de Préstamos y Deudas ── */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Préstamos y Deudas</Text>
            <View style={styles.debtsColumnsContainer}>

              {/* Columna "Me deben" */}
              <TouchableOpacity
                style={styles.debtColumn}
                onPress={() => navigation.navigate('Receivables')}
                activeOpacity={0.7}
              >
                <View style={styles.columnHeaderContainer}>
                  <Text style={styles.columnTitle}>Me deben</Text>
                  <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                </View>
                {debts.filter(d => d.type === 'me_deben').slice(0, 2).map((debt) => (
                  <View key={debt._id} style={[styles.debtItem, { borderLeftColor: 'rgba(5,150,105,0.5)' }]}>
                    <Text style={styles.debtItemName} numberOfLines={1}>{debt.name}</Text>
                    <Text style={[styles.debtItemAmount, { color: '#059669' }]}>
                      {maskValue(`+ $ ${debt.remainingAmount.toLocaleString('es-CO')}`)}
                    </Text>
                  </View>
                ))}
                {debts.filter(d => d.type === 'me_deben').length === 0 && (
                  <Text style={{color: '#9CA3AF', fontSize: 13, marginTop: 4}}>Ninguna activa</Text>
                )}
              </TouchableOpacity>

              {/* Columna "Debo" */}
              <TouchableOpacity
                style={styles.debtColumn}
                onPress={() => navigation.navigate('Deudas')}
                activeOpacity={0.7}
              >
                <View style={styles.columnHeaderContainer}>
                  <Text style={styles.columnTitle}>Debo</Text>
                  <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                </View>
                {debts.filter(d => d.type === 'debo').slice(0, 2).map((debt) => (
                  <View key={debt._id} style={[styles.debtItem, { borderLeftColor: 'rgba(180,83,9,0.5)' }]}>
                    <Text style={styles.debtItemName} numberOfLines={1}>{debt.name}</Text>
                    <Text style={[styles.debtItemAmount, { color: '#B45309' }]}>
                      {maskValue(`- $ ${debt.remainingAmount.toLocaleString('es-CO')}`)}
                    </Text>
                  </View>
                ))}
                {debts.filter(d => d.type === 'debo').length === 0 && (
                  <Text style={{color: '#9CA3AF', fontSize: 13, marginTop: 4}}>Ninguna activa</Text>
                )}
              </TouchableOpacity>

            </View>
          </View>

          {/* ── Recordatorios Pendientes ── */}
          <View style={styles.remindersSection}>
            <View style={styles.remindersHeader}>
              <Text style={styles.sectionTitle}>Recordatorios Pendientes</Text>
              <TouchableOpacity onPress={() => navigation.navigate('AddReminder')}>
                <Ionicons name="add-circle" size={28} color="#059669" />
              </TouchableOpacity>
            </View>

            {reminders.length === 0 ? (
              <Text style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 10 }}>No tienes recordatorios</Text>
            ) : (
              reminders.slice(0, 3).map((reminder) => {
                const diffTime = new Date(reminder.date) - new Date();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const isUrgent = diffDays <= 1;

                let dateText = `Vence en ${diffDays} días`;
                if (diffDays === 0) dateText = 'Vence Hoy';
                if (diffDays === 1) dateText = 'Vence Mañana';
                if (diffDays < 0) dateText = `Vencido hace ${Math.abs(diffDays)} días`;

                return (
                  <TouchableOpacity
                    key={reminder._id}
                    style={styles.reminderCard}
                    onPress={() => navigation.navigate('ReminderDetail', {
                      title: reminder.title, 
                      amount: reminder.amount ? `$ ${reminder.amount.toLocaleString('es-CO')}` : 'N/A',
                      date: dateText, 
                      isUrgent
                    })}
                  >
                    <View style={[styles.reminderIcon, { backgroundColor: isUrgent ? '#FEF2F2' : '#F3F4F6' }]}>
                      <Ionicons name="notifications" size={20} color={isUrgent ? '#EF4444' : '#4B5563'} />
                    </View>
                    <View style={styles.reminderInfo}>
                      <Text style={styles.reminderName}>{reminder.title}</Text>
                      <Text style={styles.reminderDate}>{dateText}</Text>
                    </View>
                    <Text style={styles.reminderAmount}>
                      {maskValue(reminder.amount ? `$ ${reminder.amount.toLocaleString('es-CO')}` : 'Sin monto')}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      {/* ── Modal Crear / Editar Cuentas ── */}
      <Modal visible={isAccountModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContent}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {modalMode === 'add' ? 'Nueva Cuenta' : 'Detalles de la Cuenta'}
              </Text>
              <TouchableOpacity onPress={() => setAccountModalVisible(false)}>
                <Ionicons name="close" size={24} color="#4B5563" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Nombre */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nombre de la cuenta</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="card-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Ej. Mi Cuenta de Ahorros"
                    placeholderTextColor="#9CA3AF"
                    value={accountName}
                    onChangeText={setAccountName}
                  />
                </View>
              </View>

              {/* Saldo */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Saldo Actual</Text>
                <View style={styles.amountInputContainer}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.amountInput}
                    placeholder="0.00"
                    keyboardType="numeric"
                    placeholderTextColor="#9CA3AF"
                    value={accountBalance}
                    onChangeText={setAccountBalance}
                  />
                </View>
              </View>

              {/* Campo Descripción — NUEVO */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Descripción / Notas</Text>
                <View style={[styles.inputContainer, { alignItems: 'flex-start' }]}>
                  <Ionicons
                    name="document-text-outline"
                    size={20}
                    color="#9CA3AF"
                    style={[styles.inputIcon, { marginTop: 2 }]}
                  />
                  <TextInput
                    style={[styles.textInput, { minHeight: 60, textAlignVertical: 'top' }]}
                    placeholder="Ej. Cuenta de ahorros para emergencias..."
                    placeholderTextColor="#9CA3AF"
                    multiline
                    value={accountDescription}
                    onChangeText={setAccountDescription}
                  />
                </View>
              </View>

              {/* ¿Es deuda? */}
              <View style={[styles.inputGroup, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                <View>
                  <Text style={styles.inputLabel}>¿Es una cuenta de deuda?</Text>
                  <Text style={{ fontSize: 12, color: '#6B7280' }}>Ej. Tarjetas de crédito, préstamos.</Text>
                </View>
                <Switch
                  value={isLiability}
                  onValueChange={setIsLiability}
                  trackColor={{ false: '#E5E7EB', true: '#DC2626' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.saveButton} onPress={handleSaveAccount} disabled={isSavingAccount}>
              {isSavingAccount ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>
                  {modalMode === 'add' ? 'Crear Cuenta' : 'Guardar Cambios'}
                </Text>
              )}
            </TouchableOpacity>

            {modalMode === 'edit' && (
              <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount} disabled={isSavingAccount}>
                <Text style={styles.deleteButtonText}>Eliminar Cuenta</Text>
              </TouchableOpacity>
            )}

          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
    marginTop: Platform.OS === 'android' ? 12 : 4,
    backgroundColor: colors.primary,
    padding: 24,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 8,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconButton: {
    padding: 4,
  },
  eyeButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.transparentBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 16,
    color: colors.primaryText,
    marginBottom: 4,
  },
  netWorthLabel: {
    fontSize: 14,
    color: '#CBD5E1',
    fontWeight: '500',
  },
  netWorthAmount: {
    fontSize: 34,
    fontWeight: 'bold',
    color: colors.card,
    marginTop: 4,
    letterSpacing: -0.5,
  },
  sectionContainer: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 14,
  },
  accountsScroll: {
    marginHorizontal: -20,
  },
  accountsScrollContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  accountCard: {
    width: 160,
    padding: 16,
    borderRadius: 16,
    marginRight: 12,
  },
  accountIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  accountName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  accountBalance: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  addAccountCard: {
    backgroundColor: colors.transparentBg,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addAccountText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 28,
    paddingHorizontal: 4,
  },
  actionButton: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 2,
  },
  actionText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
  },
  debtsColumnsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  debtColumn: {
    flex: 1,
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  columnHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  columnTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  debtItem: {
    borderLeftWidth: 3,
    paddingLeft: 10,
    marginBottom: 10,
  },
  debtItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  debtItemAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 2,
  },
  remindersSection: {
    marginBottom: 8,
  },
  remindersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  reminderIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  reminderInfo: {
    flex: 1,
  },
  reminderName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  reminderDate: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  reminderAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
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
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
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
    color: colors.card,
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
