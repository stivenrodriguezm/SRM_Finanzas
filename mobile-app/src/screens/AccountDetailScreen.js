import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, Modal, TextInput, Switch, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { usePreferences } from '../context/PreferencesContext';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { API_URL } from '../config/api';

// Paleta de colores sobria para cuentas
const COLOR_PALETTE = [
  { label: 'Slate',   hex: '#64748B' },
  { label: 'Zinc',    hex: '#71717A' },
  { label: 'Stone',   hex: '#78716C' },
  { label: 'Emerald', hex: '#059669' },
  { label: 'Teal',    hex: '#0D9488' },
  { label: 'Sky',     hex: '#0284C7' },
  { label: 'Violet',  hex: '#7C3AED' },
  { label: 'Indigo',  hex: '#4F46E5' },
  { label: 'Amber',   hex: '#B45309' },
  { label: 'Rose',    hex: '#BE123C' },
];

const ICONS = ['wallet', 'card', 'cash', 'home', 'car', 'school', 'briefcase', 'bag'];

const TX_LABELS = {
  ingreso: { label: 'Ingreso',     color: '#059669', icon: 'arrow-up-circle'   },
  egreso:  { label: 'Gasto',       color: '#B45309', icon: 'arrow-down-circle' },
  abono_deuda: { label: 'Abono',   color: '#7C3AED', icon: 'return-down-back'  },
};

export default function AccountDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { accountId } = route.params;
  const { token } = useAuth();
  const { colors } = usePreferences();
  const styles = getStyles(colors);

  const [account, setAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [editName, setEditName] = useState('');
  const [editBalance, setEditBalance] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIsLiability, setEditIsLiability] = useState(false);
  const [editColor, setEditColor] = useState('#64748B');
  const [editIcon, setEditIcon] = useState('wallet');
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = async () => {
    if (!token || !accountId) return;
    setIsLoading(true);
    try {
      const [accRes, txRes] = await Promise.all([
        axios.get(`${API_URL}/accounts`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/transactions`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const found = accRes.data.find(a => a._id === accountId);
      if (found) {
        setAccount(found);
        setEditName(found.name || '');
        setEditBalance(String(found.balance ?? ''));
        setEditDescription(found.description || '');
        setEditIsLiability(found.isLiability || false);
        setEditColor(found.color || '#64748B');
        setEditIcon(found.icon || 'wallet');
      }
      // Solo transacciones de esta cuenta
      const accountTxs = txRes.data.filter(tx => tx.account?._id === accountId || tx.account === accountId);
      setTransactions(accountTxs);
    } catch (e) {
      console.log('Error fetching account detail', e);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, [token, accountId]));

  const handleSave = async () => {
    if (!editName.trim()) {
      Alert.alert('Error', 'El nombre es requerido');
      return;
    }
    setIsSaving(true);
    try {
      await axios.put(`${API_URL}/accounts/${accountId}`, {
        name: editName.trim(),
        balance: Number(editBalance) || 0,
        description: editDescription.trim() || '',
        isLiability: editIsLiability,
        color: editColor,
        icon: editIcon,
      }, { headers: { Authorization: `Bearer ${token}` } });
      setIsModalOpen(false);
      fetchData();
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar la cuenta');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Eliminar cuenta',
      '¿Estás seguro? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`${API_URL}/accounts/${accountId}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              navigation.goBack();
            } catch (e) {
              Alert.alert('Error', 'No se pudo eliminar la cuenta');
            }
          },
        },
      ]
    );
  };

  if (isLoading || !account) {
    return (
      <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const accentColor = account.color || '#64748B';
  const totalIncome = transactions.filter(t => t.type === 'ingreso').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type !== 'ingreso').reduce((s, t) => s + t.amount, 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* ── Hero card ── */}
        <View style={[styles.heroCard, { backgroundColor: accentColor }]}>
          <View style={styles.heroIconRow}>
            <View style={styles.heroIcon}>
              <Ionicons name={account.icon || 'wallet'} size={28} color="#fff" />
            </View>
            {account.isLiability && (
              <View style={styles.liabilityBadge}>
                <Text style={styles.liabilityBadgeText}>Deuda</Text>
              </View>
            )}
          </View>
          <Text style={styles.heroName}>{account.name}</Text>
          {account.description ? <Text style={styles.heroDesc}>{account.description}</Text> : null}
          <Text style={styles.heroBalance}>
            $ {(account.balance || 0).toLocaleString('es-CO')}
          </Text>

          <TouchableOpacity
            style={styles.editButton}
            onPress={() => setIsModalOpen(true)}
          >
            <Ionicons name="create-outline" size={18} color="#fff" />
            <Text style={styles.editButtonText}>Modificar</Text>
          </TouchableOpacity>
        </View>

        {/* ── Resumen rápido ── */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderLeftColor: '#059669' }]}>
            <Text style={styles.statLabel}>Ingresos</Text>
            <Text style={[styles.statValue, { color: '#059669' }]}>
              $ {totalIncome.toLocaleString('es-CO')}
            </Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#B45309' }]}>
            <Text style={styles.statLabel}>Salidas</Text>
            <Text style={[styles.statValue, { color: '#B45309' }]}>
              $ {totalExpense.toLocaleString('es-CO')}
            </Text>
          </View>
        </View>

        {/* ── Botones acción rápida ── */}
        <View style={styles.quickRow}>
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => navigation.navigate('AddRecord', { preselectedAccount: accountId, initialType: 'ingreso' })}
          >
            <Ionicons name="arrow-up" size={20} color="#059669" />
            <Text style={[styles.quickBtnText, { color: '#059669' }]}>Ingreso</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => navigation.navigate('AddRecord', { preselectedAccount: accountId, initialType: 'egreso' })}
          >
            <Ionicons name="arrow-down" size={20} color="#B45309" />
            <Text style={[styles.quickBtnText, { color: '#B45309' }]}>Gasto</Text>
          </TouchableOpacity>
          {account.isLiability && (
            <TouchableOpacity
              style={styles.quickBtn}
              onPress={() => navigation.navigate('AddRecord', { preselectedAccount: accountId, initialType: 'abono_deuda' })}
            >
              <Ionicons name="return-down-back" size={20} color="#7C3AED" />
              <Text style={[styles.quickBtnText, { color: '#7C3AED' }]}>Abonar</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Transacciones ── */}
        <Text style={styles.sectionTitle}>Movimientos</Text>
        {transactions.length === 0 ? (
          <Text style={styles.emptyText}>No hay movimientos para esta cuenta</Text>
        ) : (
          transactions.slice(0, 30).map((tx) => {
            const meta = TX_LABELS[tx.type] || TX_LABELS.egreso;
            return (
              <View key={tx._id} style={styles.txRow}>
                <View style={[styles.txIcon, { backgroundColor: `${meta.color}1A` }]}>
                  <Ionicons name={meta.icon} size={20} color={meta.color} />
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txTitle}>{tx.title}</Text>
                  <Text style={styles.txDate}>
                    {new Date(tx.date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
                <Text style={[styles.txAmount, { color: meta.color }]}>
                  {tx.type === 'ingreso' ? '+' : '-'} $ {tx.amount.toLocaleString('es-CO')}
                </Text>
              </View>
            );
          })
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Modal Modificar ── */}
      <Modal visible={isModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modificar Cuenta</Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              {/* Nombre */}
              <Text style={styles.inputLabel}>Nombre</Text>
              <View style={styles.inputBox}>
                <TextInput
                  style={styles.textInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Nombre de la cuenta"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              {/* Saldo */}
              <Text style={styles.inputLabel}>Saldo actual</Text>
              <View style={styles.inputBox}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={[styles.textInput, { fontSize: 22, fontWeight: 'bold' }]}
                  value={editBalance}
                  onChangeText={setEditBalance}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              {/* Descripción */}
              <Text style={styles.inputLabel}>Descripción (opcional)</Text>
              <View style={[styles.inputBox, { alignItems: 'flex-start' }]}>
                <TextInput
                  style={[styles.textInput, { minHeight: 60, textAlignVertical: 'top' }]}
                  value={editDescription}
                  onChangeText={setEditDescription}
                  placeholder="Añade notas..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                />
              </View>

              {/* Es deuda */}
              <View style={styles.switchRow}>
                <Text style={styles.inputLabel}>¿Es cuenta de deuda?</Text>
                <Switch
                  value={editIsLiability}
                  onValueChange={setEditIsLiability}
                  trackColor={{ false: colors.border, true: '#C2410C' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Ícono */}
              <Text style={styles.inputLabel}>Ícono</Text>
              <View style={styles.iconGrid}>
                {ICONS.map(ic => (
                  <TouchableOpacity
                    key={ic}
                    style={[styles.iconOption, editIcon === ic && { borderColor: editColor, borderWidth: 2 }]}
                    onPress={() => setEditIcon(ic)}
                  >
                    <Ionicons name={ic} size={22} color={editIcon === ic ? editColor : colors.textSecondary} />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Color */}
              <Text style={styles.inputLabel}>Color</Text>
              <View style={styles.colorGrid}>
                {COLOR_PALETTE.map(c => (
                  <TouchableOpacity
                    key={c.hex}
                    style={[styles.colorDot, { backgroundColor: c.hex },
                      editColor === c.hex && styles.colorDotSelected]}
                    onPress={() => setEditColor(c.hex)}
                  />
                ))}
              </View>

              {/* Guardar */}
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: editColor }]} onPress={handleSave} disabled={isSaving}>
                {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Guardar Cambios</Text>}
              </TouchableOpacity>

              {/* Eliminar */}
              <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                <Text style={styles.deleteBtnText}>Eliminar Cuenta</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { padding: 20, paddingBottom: 40 },

  heroCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
  },
  heroIconRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  heroIcon: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  liabilityBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 4,
  },
  liabilityBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  heroName: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  heroDesc: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 12 },
  heroBalance: { fontSize: 36, fontWeight: 'bold', color: '#fff', marginBottom: 20 },
  editButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8, alignSelf: 'flex-start',
  },
  editButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard: {
    flex: 1, backgroundColor: colors.card, borderRadius: 16,
    padding: 16, borderLeftWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 4, fontWeight: '500' },
  statValue: { fontSize: 18, fontWeight: 'bold' },

  quickRow: {
    flexDirection: 'row', gap: 10, marginBottom: 28,
  },
  quickBtn: {
    flex: 1, backgroundColor: colors.card, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', gap: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 5, elevation: 2,
  },
  quickBtnText: { fontSize: 12, fontWeight: '600' },

  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 14 },
  emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: 20, fontSize: 14 },

  txRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: 14,
    padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  txIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  txInfo: { flex: 1 },
  txTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  txDate: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: 'bold' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, maxHeight: '90%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: colors.textPrimary },

  inputLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8, marginTop: 16 },
  inputBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.background, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  currencySymbol: { fontSize: 22, fontWeight: 'bold', color: colors.textPrimary, marginRight: 8 },
  textInput: { flex: 1, fontSize: 16, color: colors.textPrimary },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },

  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  iconOption: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.border,
  },

  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  colorDot: { width: 36, height: 36, borderRadius: 18 },
  colorDotSelected: { borderWidth: 3, borderColor: colors.textPrimary },

  saveBtn: {
    borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 24,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  deleteBtn: {
    borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 10,
    backgroundColor: 'transparent',
  },
  deleteBtnText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
});
