import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import SkeletonLoader from '../components/SkeletonLoader';
import { RefreshControl } from 'react-native';
import { usePreferences } from '../context/PreferencesContext';
import { API_URL } from '../config/api';

export default function ReceivablesScreen() {
    const { preferences, colors, isDark } = usePreferences();
  const styles = getStyles(colors);
const navigation = useNavigation();
  const { token } = useAuth();
  const [receivables, setReceivables] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReceivables = async () => {
    if (!token) return;
    try {
      const { data } = await axios.get(`${API_URL}/debts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReceivables(data.filter(d => d.type === 'me_deben'));
    } catch (error) {
      console.log('Error fetching receivables', error);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchReceivables();
    }, [token])
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchReceivables();
    setRefreshing(false);
  }, [token]);

  const totalReceivable = receivables.reduce((acc, curr) => acc + curr.remainingAmount, 0);
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
      contentContainerStyle={styles.container} 
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#059669" />}
    >

        <View style={styles.header}>
          {/* Tarea 9: renombrar título */}
          <Text style={styles.headerTitle}>Me Deben</Text>
        </View>

        {/* Resumen Total */}
        <View style={styles.summaryCard}>
          <View style={[styles.summaryIconContainer, { backgroundColor: '#DCFCE7' }]}>
            <Ionicons name="wallet-outline" size={24} color="#16A34A" />
          </View>
          <View style={styles.summaryInfo}>
            <Text style={styles.summaryLabel}>Total que me deben</Text>
            <Text style={styles.summaryAmount}>$ {totalReceivable.toLocaleString('es-CO')}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Préstamos a mi favor</Text>

        {isLoading ? (
          <View style={{ marginTop: 20 }}>
            <ActivityIndicator size="large" color="#10B981" />
          </View>
        ) : receivables.length === 0 ? (
          <Text style={{ textAlign: 'center', color: '#6B7280', marginTop: 20 }}>No tienes préstamos registrados.</Text>
        ) : (
          receivables.map(item => (
            <View key={item._id} style={styles.debtCard}>
              <View style={styles.debtHeader}>
                <View style={styles.debtTitleContainer}>
                  <View style={[styles.iconPill, { backgroundColor: '#DCFCE7' }]}>
                    <Ionicons name={item.icon || 'person'} size={16} color="#16A34A" />
                  </View>
                  <View>
                    <Text style={styles.debtName}>{item.name}</Text>
                    {item.dueDate && (
                      <Text style={styles.dueDateText}>Vence: {new Date(item.dueDate).toLocaleDateString('es-CO')}</Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.payButton}
                  onPress={() => navigation.navigate('DebtDetail', {
                    id: item._id,
                    title: item.name,
                    total: `$ ${item.remainingAmount.toLocaleString('es-CO')}`,
                    color: '#16A34A',
                    icon: item.icon || 'person',
                    iconColor: '#16A34A',
                    iconBg: '#DCFCE7',
                    type: 'me_deben'
                  })}
                >
                  <Text style={styles.payButtonText}>Ver más</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.debtAmountValue}>
                $ {item.remainingAmount.toLocaleString('es-CO')}
                {item.totalAmount > item.remainingAmount && (
                  <Text style={{ fontSize: 12, color: '#6B7280' }}> (Total: $ {item.totalAmount.toLocaleString('es-CO')})</Text>
                )}
              </Text>
            </View>
          ))
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Botón Flotante — tarea 9: preselecciona 'me_deben' */}
      <View style={styles.floatingButtonContainer}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddDebt', { initialDebtType: 'me_deben' })}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Nuevo Préstamo</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 20, marginTop: 10 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: colors.textPrimary },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  summaryIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  summaryInfo: { flex: 1 },
  summaryLabel: { fontSize: 14, color: colors.textSecondary, fontWeight: '500', marginBottom: 4 },
  summaryAmount: { fontSize: 28, fontWeight: 'bold', color: colors.textPrimary },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 16 },
  debtCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  debtHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  debtTitleContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconPill: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  debtName: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  dueDateText: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  payButton: {
    backgroundColor: colors.iconBg,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  payButtonText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  // Solo muestra el valor total — sin barra de progreso (tarea 11)
  debtTotalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.successText,
    marginTop: 4,
  },
  floatingButtonContainer: { position: 'absolute', bottom: 20, left: 20, right: 20 },
  addButton: {
    backgroundColor: colors.success,
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
  addButtonText: { color: colors.card, fontSize: 16, fontWeight: '600', marginLeft: 8 },
});
