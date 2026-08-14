import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Dimensions } from 'react-native';
import { BarChart, PieChart } from 'react-native-chart-kit';
import { useFocusEffect } from '@react-navigation/native';
import { usePreferences } from '../context/PreferencesContext';
import { useAuth } from '../context/AuthContext';
import apiClient from '../services/apiClient';
import { Transaction, Debt, Account } from '../types/models';
import SkeletonLoader from '../components/SkeletonLoader';

type Colors = ReturnType<typeof usePreferences>['colors'];

const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const SCREEN_WIDTH = Dimensions.get('window').width;

/** Últimos `count` meses como { key: 'YYYY-M', label: 'Ago' }, en orden cronológico. */
const lastMonths = (count: number) => {
  const now = new Date();
  const months: { key: string; label: string }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: MONTHS_SHORT[d.getMonth()] });
  }
  return months;
};

export default function ChartsScreen() {
  const { colors, isDark } = usePreferences();
  const styles = getStyles(colors);
  const { token } = useAuth();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [txRes, debtsRes, accRes] = await Promise.all([
        apiClient.get<Transaction[]>('/transactions'),
        apiClient.get<Debt[]>('/debts'),
        apiClient.get<Account[]>('/accounts'),
      ]);
      setTransactions(txRes.data);
      setDebts(debtsRes.data);
      setAccounts(accRes.data);
    } catch (error) {
      console.log('Error fetching chart data', error);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={{ paddingTop: 20 }}>
          <SkeletonLoader type="card" />
          <SkeletonLoader type="card" />
        </View>
      </SafeAreaView>
    );
  }

  // ── Flujo neto mensual (últimos 6 meses) ──
  const months = lastMonths(6);
  const netByMonth = months.map(({ key }) => {
    const [year, month] = key.split('-').map(Number);
    return transactions
      .filter((tx) => {
        const d = new Date(tx.date);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .reduce((sum, tx) => {
        if (tx.type === 'ingreso') return sum + tx.amount;
        return sum - tx.amount; // egreso y abono_deuda restan del flujo neto
      }, 0);
  });

  const hasFlowData = netByMonth.some((v) => v !== 0);

  // ── Distribución de balance por cuenta (solo cuentas positivas, no pasivos) ──
  const positiveAccounts = accounts.filter((a) => !a.isLiability && a.balance > 0);
  const pieData = positiveAccounts.map((a) => ({
    name: a.name,
    balance: a.balance,
    color: a.color || colors.primary,
    legendFontColor: colors.textSecondary,
    legendFontSize: 12,
  }));

  // ── Resumen de deudas ──
  const totalMeDeben = debts.filter((d) => d.type === 'me_deben' && d.isActive).reduce((s, d) => s + d.remainingAmount, 0);
  const totalDebo = debts.filter((d) => d.type === 'debo' && d.isActive).reduce((s, d) => s + d.remainingAmount, 0);

  const chartConfig = {
    backgroundGradientFrom: colors.card,
    backgroundGradientTo: colors.card,
    decimalPlaces: 0,
    color: (opacity = 1) => colors.textSecondary,
    labelColor: (opacity = 1) => colors.textSecondary,
    barPercentage: 0.6,
    propsForBackgroundLines: { stroke: colors.border },
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.headerTitle}>Análisis</Text>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderLeftColor: '#059669' }]}>
            <Text style={styles.statLabel}>Me deben</Text>
            <Text style={[styles.statValue, { color: '#059669' }]}>$ {totalMeDeben.toLocaleString('es-CO')}</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#DC2626' }]}>
            <Text style={styles.statLabel}>Debo</Text>
            <Text style={[styles.statValue, { color: '#DC2626' }]}>$ {totalDebo.toLocaleString('es-CO')}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Flujo neto mensual</Text>
          <Text style={styles.cardSubtitle}>Ingresos menos egresos y abonos, últimos 6 meses</Text>
          {hasFlowData ? (
            <BarChart
              data={{
                labels: months.map((m) => m.label),
                datasets: [{ data: netByMonth, colors: netByMonth.map((v) => (opacity = 1) => (v >= 0 ? `rgba(5,150,105,${opacity})` : `rgba(220,38,38,${opacity})`)) }],
              }}
              width={SCREEN_WIDTH - 72}
              height={220}
              yAxisLabel="$"
              yAxisSuffix=""
              fromZero={false}
              withCustomBarColorFromData
              flatColor
              showValuesOnTopOfBars
              chartConfig={chartConfig}
              style={styles.chart}
            />
          ) : (
            <Text style={styles.emptyText}>Aún no hay suficientes transacciones para mostrar esta gráfica.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Distribución de tus cuentas</Text>
          <Text style={styles.cardSubtitle}>Balance actual por cuenta (sin cuentas de deuda)</Text>
          {pieData.length > 0 ? (
            <PieChart
              data={pieData}
              width={SCREEN_WIDTH - 72}
              height={200}
              chartConfig={chartConfig}
              accessor="balance"
              backgroundColor="transparent"
              paddingLeft="12"
              absolute
            />
          ) : (
            <Text style={styles.emptyText}>Agrega cuentas con saldo para ver la distribución.</Text>
          )}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: Colors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { padding: 20, paddingBottom: 40 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 20, marginTop: 10 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 4, fontWeight: '500' },
  statValue: { fontSize: 18, fontWeight: 'bold' },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 4 },
  cardSubtitle: { fontSize: 12, color: colors.textSecondary, marginBottom: 16 },
  chart: { borderRadius: 16, marginLeft: -20 },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 20 },
});
