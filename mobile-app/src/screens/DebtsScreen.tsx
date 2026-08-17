import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { usePreferences } from '../context/PreferencesContext';
import { useAuth } from '../context/AuthContext';
import SkeletonLoader from '../components/SkeletonLoader';
import AccountFormModal from '../components/AccountFormModal';
import apiClient from '../services/apiClient';
import { Account, AuthResponse } from '../types/models';
import { AppNavigation } from '../navigation/types';
import { DEBT_ACCENT } from '../theme/theme';

type Colors = ReturnType<typeof usePreferences>['colors'];

export default function DebtsScreen() {
  const navigation = useNavigation<AppNavigation>();
  const { token, user, updateUserLocal } = useAuth();
  const { preferences, colors } = usePreferences();
  const styles = getStyles(colors);
  const [isPrivate, setIsPrivate] = useState(preferences.privacy.debts);

  React.useEffect(() => {
    setIsPrivate(preferences.privacy.debts);
  }, [preferences.privacy.debts]);

  const [isLoading, setIsLoading] = useState(true);
  const [debtAccounts, setDebtAccounts] = useState<Account[]>([]);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [isAddAccountModalVisible, setAddAccountModalVisible] = useState(false);

  const fetchDebtAccounts = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const { data } = await apiClient.get<Account[]>('/accounts?isLiability=true');
      setDebtAccounts(data);
      if (user?.preferences?.selectedAccounts && user.preferences.selectedAccounts.length > 0) {
        setSelectedAccounts(user.preferences.selectedAccounts);
      } else {
        setSelectedAccounts(data.map((a) => a._id));
      }
    } catch (error) {
      console.log('Error fetching debt accounts', error);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchDebtAccounts();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token])
  );

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
  };

  const toggleAccountSelection = async (id: string) => {
    const newSelected = selectedAccounts.includes(id)
      ? selectedAccounts.filter((aId) => aId !== id)
      : [...selectedAccounts, id];
    setSelectedAccounts(newSelected);

    try {
      const { data } = await apiClient.put<AuthResponse>('/auth/preferences', { selectedAccounts: newSelected });
      updateUserLocal(data);
    } catch (e) {
      console.log('Error saving selected accounts', e);
    }
  };

  const relevantDebts = debtAccounts.filter((a) => selectedAccounts.includes(a._id));
  const totalDebt = relevantDebts.reduce((acc, curr) => acc + (curr.balance || 0), 0);
  const maskValue = (val: string) => (isPrivate ? '****' : val);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <Text style={styles.headerTitle}>Gestión de Deudas</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => setIsPrivate(!isPrivate)} style={styles.eyeButton}>
              <Ionicons name={isPrivate ? 'eye-off-outline' : 'eye-outline'} size={24} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleSelectionMode} style={[styles.eyeButton, { marginLeft: 12 }]}>
              <Ionicons name={isSelectionMode ? "checkmark-done-outline" : "options-outline"} size={24} color={isSelectionMode ? colors.primary : colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {isLoading ? (
          <SkeletonLoader type="list" />
        ) : (
          <>
            {/* Resumen Total */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryIconContainer}>
                <Ionicons name="wallet-outline" size={24} color={DEBT_ACCENT} />
              </View>
              <View style={styles.summaryInfo}>
                <Text style={styles.summaryLabel}>Total Adeudado</Text>
                <Text style={[styles.summaryAmount, { color: DEBT_ACCENT }]}>
                  {maskValue(`$ ${totalDebt.toLocaleString('es-CO')}`)}
                </Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Mis Cuentas de Deuda</Text>

            {debtAccounts.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyText}>No tienes cuentas de deuda activas</Text>
                <Text style={styles.emptySubText}>Crea una cuenta y márcala como "cuenta de deuda" en Inicio</Text>
              </View>
            ) : (
              (isSelectionMode ? debtAccounts : relevantDebts).map((account) => {
                const isSelected = selectedAccounts.includes(account._id);
                const isHidden = isSelectionMode && !isSelected;

                return (
                  <TouchableOpacity
                    key={account._id}
                    style={[styles.debtCard, { opacity: isHidden ? 0.5 : 1 }]}
                    activeOpacity={0.8}
                    onPress={() => {
                      if (isSelectionMode) toggleAccountSelection(account._id);
                      else navigation.navigate('AccountDetail', { accountId: account._id });
                    }}
                  >
                    <View style={styles.debtCardContent}>
                      <View style={[styles.iconPill, {
                        backgroundColor: account.color ? `${account.color}1A` : 'rgba(194,65,12,0.1)'
                      }]}>
                        <Ionicons
                          name={(account.icon || 'card') as any}
                          size={22}
                          color={account.color || DEBT_ACCENT}
                        />
                      </View>
                      <View style={styles.debtCardInfo}>
                        <Text style={styles.debtName}>{account.name}</Text>
                        {account.description ? (
                          <Text style={styles.debtDescription} numberOfLines={1}>{account.description}</Text>
                        ) : null}
                        <Text style={[styles.debtAmount, { color: account.color || DEBT_ACCENT }]}>
                          {maskValue(`$ ${(account.balance || 0).toLocaleString('es-CO')}`)}
                        </Text>
                      </View>
                      
                      {isSelectionMode ? (
                        <Ionicons name={isSelected ? "eye-outline" : "eye-off-outline"} size={22} color={isSelected ? colors.primary : colors.textMuted} />
                      ) : (
                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Botón Flotante – abre el modal de nueva cuenta aquí mismo, con "cuenta de deuda" preseleccionado */}
      <View style={styles.floatingButtonContainer}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setAddAccountModalVisible(true)}
        >
          <Ionicons name="add" size={24} color={colors.primaryText} />
          <Text style={styles.addButtonText}>Agregar Cuenta de Deuda</Text>
        </TouchableOpacity>
      </View>

      <AccountFormModal
        visible={isAddAccountModalVisible}
        mode="add"
        initialLiability
        onClose={() => setAddAccountModalVisible(false)}
        onSaved={fetchDebtAccounts}
      />
    </SafeAreaView>
  );
}

const getStyles = (colors: Colors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: colors.textPrimary },
  eyeButton: { padding: 4 },

  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  summaryIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(194,65,12,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  summaryInfo: { flex: 1 },
  summaryLabel: { fontSize: 14, color: colors.textSecondary, fontWeight: '500', marginBottom: 4 },
  summaryAmount: { fontSize: 28, fontWeight: 'bold' },

  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 16 },

  debtCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    marginBottom: 14,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  debtCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconPill: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  debtCardInfo: { flex: 1 },
  debtName: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  debtDescription: { fontSize: 13, color: colors.textSecondary, marginBottom: 4 },
  debtAmount: { fontSize: 18, fontWeight: 'bold' },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 18,
  },

  floatingButtonContainer: { position: 'absolute', bottom: 20, left: 20, right: 20 },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  addButtonText: { color: colors.primaryText, fontSize: 16, fontWeight: '600', marginLeft: 8 },
});
