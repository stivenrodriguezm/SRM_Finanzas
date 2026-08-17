import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Modal, TextInput, Switch, Alert, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePreferences } from '../context/PreferencesContext';
import { useAuth } from '../context/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import SkeletonLoader from '../components/SkeletonLoader';
import apiClient from '../services/apiClient';
import { getErrorMessage } from '../utils/apiError';
import { Transaction, Account, TransactionType } from '../types/models';

type Colors = ReturnType<typeof usePreferences>['colors'];

const getTypeIcon = (colors: Colors): Record<TransactionType, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> => ({
  ingreso: { icon: 'arrow-up', color: colors.successText, bg: colors.successLight },
  egreso: { icon: 'arrow-down', color: colors.danger, bg: colors.dangerLight },
  abono_deuda: { icon: 'return-down-back', color: colors.purple, bg: colors.purpleLight },
});

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

interface DisplayTransaction {
  id: string;
  title: string;
  date: string;
  rawDate: string;
  account: string;
  accountId: string;
  amount: string;
  rawAmount: number;
  type: TransactionType;
}

interface AccountAccordionProps {
  account: string;
  transactions: DisplayTransaction[];
  renderTransaction: (tx: DisplayTransaction, isInsideAccordion?: boolean) => React.ReactNode;
}

const AccountAccordion = ({ account, transactions, renderTransaction }: AccountAccordionProps) => {
  const { colors } = usePreferences();
  const styles = getStyles(colors);

  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.accordionContainer}>
      <TouchableOpacity style={styles.accordionHeader} onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
        <View style={styles.accordionHeaderLeft}>
          <View style={styles.accordionIcon}>
            <Ionicons name="wallet-outline" size={20} color={colors.info} />
          </View>
          <View>
            <Text style={styles.accordionTitle}>{account}</Text>
            <Text style={styles.accordionSubtitle}>{transactions.length} transacciones</Text>
          </View>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={24} color={colors.textSecondary} />
      </TouchableOpacity>
      {expanded && (
        <View style={styles.accordionContent}>
          {transactions.map((tx) => (
            <View key={tx.id} style={{ marginTop: 12 }}>
              {renderTransaction(tx, true)}
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

export default function TransactionsScreen() {
  const { preferences, colors } = usePreferences();
  const styles = getStyles(colors);
  const typeIcon = getTypeIcon(colors);
  const { token } = useAuth();
  const [activeFilter, setActiveFilter] = useState('Todos');
  const [isOptionsModalVisible, setOptionsModalVisible] = useState(false);
  const [isGrouped, setIsGrouped] = useState(false);

  const [transactions, setTransactions] = useState<DisplayTransaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);
  const [itemLimit, setItemLimit] = useState(50);

  useFocusEffect(
    React.useCallback(() => {
      fetchTransactions();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token])
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchTransactions();
    setRefreshing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchTransactions = async () => {
    if (!token) return;
    try {
      const [{ data: txData }, { data: accData }] = await Promise.all([
        apiClient.get<Transaction[]>('/transactions'),
        apiClient.get<Account[]>('/accounts'),
      ]);
      setAccounts(accData);

      const mapped: DisplayTransaction[] = txData.map((tx) => {
        const txDate = new Date(tx.date);
        const day = txDate.getDate();
        const monthShort = MONTHS[txDate.getMonth()].substring(0, 3);
        const year = txDate.getFullYear();
        const formattedDate = `${day} ${monthShort} ${year}`;
        const prefix = tx.type === 'ingreso' ? '+ ' : '- ';

        return {
          id: tx._id,
          title: tx.title,
          date: formattedDate,
          rawDate: tx.date,
          account: tx.account?.name || 'Desconocida',
          accountId: tx.account?._id || '',
          amount: `${prefix}$ ${tx.amount.toLocaleString('es-CO')}`,
          rawAmount: tx.amount,
          type: tx.type,
        };
      });
      setTransactions(mapped);
    } catch (error) {
      console.log('Error fetching transactions', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Filtro Dinámico (Año y Mes) ──
  const availableData = useMemo(() => {
    const data: Record<string, Set<string>> = {};
    transactions.forEach((tx) => {
      const parts = tx.date.split(' ');
      if (parts.length === 3) {
        const [, monthShort, year] = parts;
        const fullMonth = MONTHS.find((m) => m.startsWith(monthShort));
        if (fullMonth && year) {
          if (!data[year]) data[year] = new Set();
          data[year].add(fullMonth);
        }
      }
    });
    const result: Record<string, string[]> = {};
    Object.keys(data).forEach((y) => {
      result[y] = Array.from(data[y]);
    });
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions]);

  const availableYears = useMemo(() => Object.keys(availableData).sort((a, b) => Number(b) - Number(a)), [availableData]);

  const currentYearStr = new Date().getFullYear().toString();
  const defaultYear = availableYears.includes(currentYearStr) ? currentYearStr : availableYears[0] || currentYearStr;
  const [selectedYear, setSelectedYear] = useState(defaultYear);

  const availableMonthsForYear = availableData[selectedYear] || [];
  const defaultMonth = availableMonthsForYear.length > 0 ? availableMonthsForYear[0] : MONTHS[new Date().getMonth()];
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    const monthsForNewYear = availableData[year] || [];
    if (!monthsForNewYear.includes(selectedMonth)) {
      setSelectedMonth(monthsForNewYear[0] || MONTHS[new Date().getMonth()]);
    }
  };

  const [isPrivate, setIsPrivate] = useState(preferences.privacy.transactions);

  React.useEffect(() => {
    setIsPrivate(preferences.privacy.transactions);
  }, [preferences.privacy.transactions]);
  const maskValue = (val: string) => (isPrivate ? '****' : val);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const monthPrefix = selectedMonth.substring(0, 3);
      if (!tx.date.includes(monthPrefix)) return false;
      if (!tx.date.includes(selectedYear)) return false;

      if (activeFilter === 'Ingresos' && tx.type !== 'ingreso') return false;
      if (activeFilter === 'Egresos' && tx.type !== 'egreso') return false;
      if (activeFilter === 'Pagos Deuda' && tx.type !== 'abono_deuda') return false;

      if (searchQuery.trim()) {
        return tx.title.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    });
  }, [transactions, activeFilter, selectedMonth, selectedYear, searchQuery]);

  // ── Edición / borrado de transacción ──
  const [editingTx, setEditingTx] = useState<DisplayTransaction | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editAccountId, setEditAccountId] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeletingTx, setIsDeletingTx] = useState(false);

  const openEditModal = (tx: DisplayTransaction) => {
    if (tx.type === 'abono_deuda') {
      Alert.alert(
        'Abono a deuda',
        'El monto se puede editar, pero no la cuenta ni el tipo (afecta el saldo pendiente de la deuda).'
      );
    }
    setEditingTx(tx);
    setEditTitle(tx.title);
    setEditAmount(String(tx.rawAmount));
    setEditAccountId(tx.accountId);
  };

  const closeEditModal = () => setEditingTx(null);

  const handleSaveEdit = async () => {
    if (!editingTx) return;
    const amountNumber = Number(editAmount);
    if (!editTitle.trim() || !amountNumber || amountNumber <= 0) {
      Alert.alert('Error', 'Revisa el título y el monto (debe ser mayor a cero)');
      return;
    }
    setIsSavingEdit(true);
    try {
      const payload: Record<string, unknown> = { title: editTitle.trim(), amount: amountNumber };
      if (editingTx.type !== 'abono_deuda' && editAccountId && editAccountId !== editingTx.accountId) {
        payload.account = editAccountId;
      }
      await apiClient.put(`/transactions/${editingTx.id}`, payload);
      closeEditModal();
      fetchTransactions();
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error, 'No se pudo editar la transacción'));
    }
    setIsSavingEdit(false);
  };

  const handleDeleteTx = () => {
    if (!editingTx) return;
    Alert.alert('Eliminar transacción', '¿Seguro que quieres eliminarla? Esto revierte el balance de la cuenta.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setIsDeletingTx(true);
          try {
            await apiClient.delete(`/transactions/${editingTx.id}`);
            closeEditModal();
            fetchTransactions();
          } catch (error) {
            Alert.alert('Error', getErrorMessage(error, 'No se pudo eliminar la transacción'));
          }
          setIsDeletingTx(false);
        },
      },
    ]);
  };

  const renderTransaction = (tx: DisplayTransaction, isInsideAccordion = false) => {
    const meta = typeIcon[tx.type] || typeIcon.egreso;
    return (
      <TouchableOpacity
        key={tx.id}
        style={[styles.transactionCard, isInsideAccordion && styles.transactionCardInner]}
        onPress={() => openEditModal(tx)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon} size={20} color={meta.color} />
        </View>
        <View style={styles.transactionInfo}>
          <Text style={styles.transactionTitle}>{tx.title}</Text>
          <View style={styles.dateAndAccountContainer}>
            <Text style={styles.transactionDate}>{tx.date}</Text>
            {!isInsideAccordion && (
              <View style={styles.accountBadge}>
                <Text style={styles.accountBadgeText}>{tx.account}</Text>
              </View>
            )}
          </View>
        </View>
        <Text style={[styles.transactionAmount, { color: tx.type === 'ingreso' ? colors.successText : tx.type === 'abono_deuda' ? colors.purple : colors.textPrimary }]}>
          {maskValue(tx.amount)}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return <SkeletonLoader type="list" />;
    }
    const displayedTransactions = filteredTransactions.slice(0, itemLimit);

    if (displayedTransactions.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>Sin transacciones</Text>
        </View>
      );
    }

    let content;
    if (!isGrouped) {
      content = displayedTransactions.map((tx) => renderTransaction(tx));
    } else {
      const grouped: Record<string, DisplayTransaction[]> = {};
      displayedTransactions.forEach((tx) => {
        if (!grouped[tx.account]) grouped[tx.account] = [];
        grouped[tx.account].push(tx);
      });
      content = Object.keys(grouped).map((account) => (
        <AccountAccordion key={account} account={account} transactions={grouped[account]} renderTransaction={renderTransaction} />
      ));
    }

    return (
      <View>
        {content}
        {filteredTransactions.length > itemLimit && (
          <TouchableOpacity
            style={{ padding: 16, alignItems: 'center', marginTop: 10, backgroundColor: colors.card, borderRadius: 12 }}
            onPress={() => setItemLimit((prev) => prev + 50)}
          >
            <Text style={{ color: colors.primary, fontWeight: '600' }}>Cargar más ({filteredTransactions.length - itemLimit} restantes)</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>

      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">Historial de Transacciones</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => setIsPrivate(!isPrivate)} activeOpacity={0.7}>
              <Ionicons name={isPrivate ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => {
                setIsSearchOpen(!isSearchOpen);
                if (isSearchOpen) setSearchQuery('');
              }}
              activeOpacity={0.7}
            >
              <Ionicons name={isSearchOpen ? 'close-circle' : 'search'} size={22} color={isSearchOpen ? colors.danger : colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.headerIconBtn} onPress={() => setOptionsModalVisible(true)} activeOpacity={0.7}>
              <Ionicons name="options-outline" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {isSearchOpen && (
          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por concepto o nombre..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
          </View>
        )}
      </View>

      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
          {['Todos', 'Ingresos', 'Egresos', 'Pagos Deuda'].map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[styles.filterPill, activeFilter === filter && styles.filterPillActive]}
              onPress={() => { setActiveFilter(filter); setIsGrouped(false); }}
            >
              <Text style={[styles.filterText, activeFilter === filter && styles.filterTextActive]}>{filter}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
        {renderContent()}
      </ScrollView>

      {/* Modal de Opciones (Mes y Agrupación) */}
      <Modal visible={isOptionsModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Opciones de Vista</Text>
              <TouchableOpacity onPress={() => setOptionsModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.optionsGroupRow}>
              <View>
                <Text style={styles.optionsGroupTitle}>Agrupar por Cuenta</Text>
                <Text style={styles.optionsGroupSub}>Ver transacciones separadas por cuenta</Text>
              </View>
              <Switch value={isGrouped} onValueChange={setIsGrouped} trackColor={{ false: colors.border, true: colors.success }} thumbColor={colors.white} />
            </View>

            <Text style={styles.optionsSectionTitle}>Filtrar por Año</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 50, marginBottom: 16 }}>
              {availableYears.map((year) => (
                <TouchableOpacity key={year} style={[styles.yearPill, selectedYear === year && styles.yearPillActive]} onPress={() => handleYearChange(year)}>
                  <Text style={[styles.yearPillText, selectedYear === year && styles.yearPillTextActive]}>{year}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.optionsSectionTitle}>Filtrar por Mes</Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 200 }}>
              {availableMonthsForYear.length === 0 ? (
                <View style={{ padding: 16, alignItems: 'center' }}>
                  <Text style={{ color: colors.textMuted }}>Sin meses disponibles</Text>
                </View>
              ) : (
                availableMonthsForYear.map((month) => (
                  <TouchableOpacity
                    key={month}
                    style={[styles.modalItem, selectedMonth === month && { backgroundColor: colors.iconBg }]}
                    onPress={() => { setSelectedMonth(month); setOptionsModalVisible(false); }}
                  >
                    <Text style={[styles.modalItemText, selectedMonth === month && { fontWeight: 'bold', color: colors.textPrimary }]}>{month}</Text>
                    {selectedMonth === month && <Ionicons name="checkmark" size={20} color={colors.success} />}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal de edición / borrado de transacción */}
      <Modal visible={!!editingTx} animationType="slide" transparent={true} onRequestClose={closeEditModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar transacción</Text>
              <TouchableOpacity onPress={closeEditModal}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.editInputGroup}>
              <Text style={styles.optionsGroupSub}>Título</Text>
              <TextInput style={styles.editTextInput} value={editTitle} onChangeText={setEditTitle} placeholder="Título" />
            </View>

            <View style={styles.editInputGroup}>
              <Text style={styles.optionsGroupSub}>Monto</Text>
              <TextInput style={styles.editTextInput} value={editAmount} onChangeText={setEditAmount} keyboardType="numeric" placeholder="0" />
            </View>

            {editingTx?.type !== 'abono_deuda' && (
              <View style={styles.editInputGroup}>
                <Text style={styles.optionsGroupSub}>Cuenta</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                  {accounts.map((acc) => (
                    <TouchableOpacity
                      key={acc._id}
                      style={[styles.yearPill, editAccountId === acc._id && styles.yearPillActive]}
                      onPress={() => setEditAccountId(acc._id)}
                    >
                      <Text style={[styles.yearPillText, editAccountId === acc._id && styles.yearPillTextActive]}>{acc.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <TouchableOpacity style={styles.editSaveButton} onPress={handleSaveEdit} disabled={isSavingEdit}>
              {isSavingEdit ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.editSaveButtonText}>Guardar Cambios</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.editDeleteButton} onPress={handleDeleteTx} disabled={isDeletingTx}>
              <Text style={styles.editDeleteButtonText}>{isDeletingTx ? 'Eliminando...' : 'Eliminar transacción'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors: Colors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  headerTitle: { flex: 1, fontSize: 21, fontWeight: 'bold', color: colors.textPrimary },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  headerIconBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: colors.iconBg,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.textPrimary },
  filtersContainer: { marginBottom: 12 },
  filtersScroll: { paddingHorizontal: 20, gap: 8, alignItems: 'center' },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: colors.border,
    borderRadius: 20,
  },
  filterPillActive: { backgroundColor: colors.primary },
  filterText: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
  filterTextActive: { color: colors.primaryText },
  listContainer: { paddingHorizontal: 20, paddingBottom: 40 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { marginTop: 12, fontSize: 16, color: colors.textSecondary, fontWeight: '500' },
  transactionCard: {
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
  transactionCardInner: {
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 0,
  },
  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  transactionInfo: { flex: 1 },
  transactionTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 },
  dateAndAccountContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  transactionDate: { fontSize: 13, color: colors.textSecondary },
  accountBadge: {
    backgroundColor: colors.iconBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  accountBadgeText: { fontSize: 11, color: colors.textSecondary, fontWeight: '500' },
  transactionAmount: { fontSize: 15, fontWeight: 'bold' },
  accordionContainer: {
    backgroundColor: colors.card,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  accordionHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  accordionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.infoLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  accordionTitle: { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary },
  accordionSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  accordionContent: {
    padding: 16,
    paddingTop: 4,
    backgroundColor: colors.iconBg,
    borderTopWidth: 1,
    borderTopColor: colors.iconBg,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: colors.textPrimary },
  optionsGroupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: colors.iconBg,
    padding: 16,
    borderRadius: 16,
  },
  optionsGroupTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  optionsGroupSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  optionsSectionTitle: { fontSize: 14, fontWeight: 'bold', color: colors.textMuted, textTransform: 'uppercase', marginBottom: 12 },
  yearPill: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.iconBg,
    marginRight: 8,
  },
  yearPillActive: { backgroundColor: colors.primary },
  yearPillText: { fontSize: 14, fontWeight: '500', color: colors.textSecondary },
  yearPillTextActive: { color: colors.primaryText },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.iconBg,
    borderRadius: 8,
  },
  modalItemText: { fontSize: 16, color: colors.textSecondary },
  editInputGroup: { marginBottom: 16 },
  editTextInput: {
    marginTop: 6,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.iconBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  editSaveButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  editSaveButtonText: { color: colors.primaryText, fontSize: 16, fontWeight: 'bold' },
  editDeleteButton: {
    marginTop: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: colors.dangerLight,
  },
  editDeleteButtonText: { color: colors.danger, fontSize: 15, fontWeight: 'bold' },
});
