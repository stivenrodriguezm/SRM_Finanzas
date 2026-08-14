import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, Modal, TextInput, Switch, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { usePreferences } from '../context/PreferencesContext';
import { useAuth } from '../context/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import SkeletonLoader from '../components/SkeletonLoader';
import { API_URL } from '../config/api';

// ── Íconos simplificados: solo 3 tipos ────────────────────────────────────
const TYPE_ICON = {
  ingreso:     { icon: 'arrow-up',        color: '#16A34A', bg: '#DCFCE7' },
  egreso:      { icon: 'arrow-down',      color: '#DC2626', bg: '#FEE2E2' },
  abono_deuda: { icon: 'return-down-back', color: '#7C3AED', bg: '#EDE9FE' },
};

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// Acordeón por cuenta
const AccountAccordion = ({ account, transactions, renderTransaction }) => {
  const { colors } = usePreferences();
  const styles = getStyles(colors);

  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.accordionContainer}>
      <TouchableOpacity
        style={styles.accordionHeader}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.accordionHeaderLeft}>
          <View style={styles.accordionIcon}>
            <Ionicons name="wallet-outline" size={20} color="#3B82F6" />
          </View>
          <View>
            <Text style={styles.accordionTitle}>{account}</Text>
            <Text style={styles.accordionSubtitle}>{transactions.length} transacciones</Text>
          </View>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={24} color="#6B7280" />
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
  const { preferences, colors, isDark } = usePreferences();
  const styles = getStyles(colors);
  const { token } = useAuth();
  const [activeFilter, setActiveFilter] = useState('Todos');
  const [isOptionsModalVisible, setOptionsModalVisible] = useState(false);
  const [isGrouped, setIsGrouped] = useState(false);
  
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);
  const [itemLimit, setItemLimit] = useState(50);
  
  useFocusEffect(
    React.useCallback(() => {
      fetchTransactions();
    }, [token])
  );
  
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchTransactions();
    setRefreshing(false);
  }, [token]);

  const fetchTransactions = async () => {
    if (!token) return;
    try {
      const { data } = await axios.get(`${API_URL}/transactions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Mapeamos para que account sea string por ahora, si el endpoint hace populate de account, se puede extraer
      const mapped = data.map(tx => {
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
          account: tx.account?.name || 'Desconocida',
          amount: `${prefix}$ ${tx.amount.toLocaleString('es-CO')}`,
          type: tx.type
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
    const data = {};
    transactions.forEach(tx => {
      const parts = tx.date.split(' ');
      if (parts.length === 3) {
        const [, monthShort, year] = parts;
        const fullMonth = MONTHS.find(m => m.startsWith(monthShort));
        if (fullMonth && year) {
          if (!data[year]) data[year] = new Set();
          data[year].add(fullMonth);
        }
      }
    });
    const result = {};
    Object.keys(data).forEach(y => {
      result[y] = Array.from(data[y]);
    });
    return result;
  }, []);

  const availableYears = useMemo(() => Object.keys(availableData).sort((a, b) => b - a), [availableData]);
  
  // Valores por defecto
  const currentYearStr = new Date().getFullYear().toString();
  const defaultYear = availableYears.includes(currentYearStr) ? currentYearStr : availableYears[0] || currentYearStr;
  const [selectedYear, setSelectedYear] = useState(defaultYear);

  const availableMonthsForYear = availableData[selectedYear] || [];
  const defaultMonth = availableMonthsForYear.length > 0 ? availableMonthsForYear[0] : MONTHS[new Date().getMonth()];
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  // Al cambiar el año, ajustamos el mes si el actual no existe en el nuevo año
  const handleYearChange = (year) => {
    setSelectedYear(year);
    const monthsForNewYear = availableData[year] || [];
    if (!monthsForNewYear.includes(selectedMonth)) {
      setSelectedMonth(monthsForNewYear[0] || MONTHS[new Date().getMonth()]);
    }
  };
  
  // ── Privacidad ──
  const [isPrivate, setIsPrivate] = useState(preferences.privacy.transactions);
  
  React.useEffect(() => {
    setIsPrivate(preferences.privacy.transactions);
  }, [preferences.privacy.transactions]);
  const maskValue = (val) => isPrivate ? '****' : val;

  // ── Búsqueda ──
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const monthPrefix = selectedMonth.substring(0, 3);
      if (!tx.date.includes(monthPrefix)) return false;
      if (!tx.date.includes(selectedYear)) return false;

      if (activeFilter === 'Ingresos' && tx.type !== 'ingreso') return false;
      if (activeFilter === 'Egresos' && tx.type !== 'egreso') return false;
      if (activeFilter === 'Pagos Deuda' && tx.type !== 'abono_deuda') return false;

      // Filtro de búsqueda por texto
      if (searchQuery.trim()) {
        return tx.title.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    });
  }, [activeFilter, selectedMonth, selectedYear, searchQuery]);

  const renderTransaction = (tx, isInsideAccordion = false) => {
    const meta = TYPE_ICON[tx.type] || TYPE_ICON.egreso;
    return (
      <View key={tx.id} style={[styles.transactionCard, isInsideAccordion && styles.transactionCardInner]}>
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
        <Text style={[styles.transactionAmount, { color: tx.type === 'ingreso' ? '#16A34A' : tx.type === 'abono_deuda' ? '#7C3AED' : '#111827' }]}>
          {maskValue(tx.amount)}
        </Text>
      </View>
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
      content = displayedTransactions.map(tx => renderTransaction(tx));
    } else {
      const grouped = displayedTransactions.reduce((acc, tx) => {
        if (!acc[tx.account]) acc[tx.account] = [];
        acc[tx.account].push(tx);
        return acc;
      }, {});
      content = Object.keys(grouped).map(account => (
        <AccountAccordion
          key={account}
          account={account}
          transactions={grouped[account]}
          renderTransaction={renderTransaction}
        />
      ));
    }

    return (
      <View>
        {content}
        {filteredTransactions.length > itemLimit && (
          <TouchableOpacity 
            style={{ padding: 16, alignItems: 'center', marginTop: 10, backgroundColor: colors.card, borderRadius: 12 }} 
            onPress={() => setItemLimit(prev => prev + 50)}
          >
            <Text style={{ color: colors.primary, fontWeight: '600' }}>Cargar más ({filteredTransactions.length - itemLimit} restantes)</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>

      {/* ── Header con buscador y opciones ── */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Historial de Transacciones</Text>
          <View style={styles.headerActions}>
            {/* Tarea 4: Botón ocultar (izq de buscar) */}
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => setIsPrivate(!isPrivate)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isPrivate ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color="#374151"
              />
            </TouchableOpacity>

            {/* Ícono lupa */}
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => {
                setIsSearchOpen(!isSearchOpen);
                if (isSearchOpen) setSearchQuery('');
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isSearchOpen ? 'close-circle' : 'search'}
                size={22}
                color={isSearchOpen ? '#DC2626' : '#374151'}
              />
            </TouchableOpacity>

            {/* Tarea 3: Botón Opciones (der de buscar) */}
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => setOptionsModalVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons
                name="options-outline"
                size={22}
                color="#374151"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Campo de búsqueda expandible */}
        {isSearchOpen && (
          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por concepto o nombre..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
          </View>
        )}
      </View>

      {/* ── Filtros ── */}
      <View style={styles.filtersContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersScroll}
        >
          {/* Filtros de tipo: Todos, Ingresos, Egresos, Pagos Deuda (tarea 8) */}
          {['Todos', 'Ingresos', 'Egresos', 'Pagos Deuda'].map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[styles.filterPill, activeFilter === filter && styles.filterPillActive]}
              onPress={() => { setActiveFilter(filter); setIsGrouped(false); }}
            >
              <Text style={[styles.filterText, activeFilter === filter && styles.filterTextActive]}>
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      >
        {renderContent()}
      </ScrollView>

      {/* Modal de Opciones (Mes y Agrupación) */}
      <Modal visible={isOptionsModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Opciones de Vista</Text>
              <TouchableOpacity onPress={() => setOptionsModalVisible(false)}>
                <Ionicons name="close" size={24} color="#4B5563" />
              </TouchableOpacity>
            </View>

            {/* Toggle de Agrupar */}
            <View style={styles.optionsGroupRow}>
              <View>
                <Text style={styles.optionsGroupTitle}>Agrupar por Cuenta</Text>
                <Text style={styles.optionsGroupSub}>Ver transacciones separadas por cuenta</Text>
              </View>
              <Switch
                value={isGrouped}
                onValueChange={setIsGrouped}
                trackColor={{ false: '#E5E7EB', true: '#059669' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <Text style={styles.optionsSectionTitle}>Filtrar por Año</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 50, marginBottom: 16 }}>
              {availableYears.map(year => (
                <TouchableOpacity
                  key={year}
                  style={[styles.yearPill, selectedYear === year && styles.yearPillActive]}
                  onPress={() => handleYearChange(year)}
                >
                  <Text style={[styles.yearPillText, selectedYear === year && styles.yearPillTextActive]}>{year}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.optionsSectionTitle}>Filtrar por Mes</Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 200 }}>
              {availableMonthsForYear.length === 0 ? (
                <View style={{ padding: 16, alignItems: 'center' }}>
                  <Text style={{ color: '#9CA3AF' }}>Sin meses disponibles</Text>
                </View>
              ) : (
                availableMonthsForYear.map((month) => (
                  <TouchableOpacity
                    key={month}
                    style={[styles.modalItem, selectedMonth === month && { backgroundColor: '#F3F4F6' }]}
                    onPress={() => { setSelectedMonth(month); setOptionsModalVisible(false); }}
                  >
                    <Text style={[styles.modalItemText, selectedMonth === month && { fontWeight: 'bold', color: '#111827' }]}>
                      {month}
                    </Text>
                    {selectedMonth === month && <Ionicons name="checkmark" size={20} color="#059669" />}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: colors.textPrimary },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  filterTextActive: { color: colors.card },
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
    backgroundColor: '#F9FAFB',
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
    backgroundColor: '#F9FAFB',
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
  yearPillTextActive: { color: colors.card },
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
});
