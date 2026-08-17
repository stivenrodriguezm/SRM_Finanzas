import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Dimensions, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { BarChart, PieChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { usePreferences } from '../context/PreferencesContext';
import { useAuth } from '../context/AuthContext';
import apiClient from '../services/apiClient';
import { createAiChat } from '../services/aiChat';
import { getErrorMessage } from '../utils/apiError';
import { Transaction, Debt, Account } from '../types/models';
import SkeletonLoader from '../components/SkeletonLoader';
import { AppNavigation } from '../navigation/types';

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
  const { colors } = usePreferences();
  const styles = getStyles(colors);
  const { token } = useAuth();
  const navigation = useNavigation<AppNavigation>();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingChat, setIsStartingChat] = useState(false);

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

  const handleStartAiChat = async () => {
    setIsStartingChat(true);
    try {
      const chat = await createAiChat();
      navigation.navigate('AiChat', { chatId: chat._id });
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error, 'No se pudo iniciar el análisis con IA.'));
    } finally {
      setIsStartingChat(false);
    }
  };

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

        {/* ── Entrada al análisis con IA (chat) ── */}
        <TouchableOpacity style={styles.aiCard} activeOpacity={0.85} onPress={handleStartAiChat} disabled={isStartingChat}>
          <View style={styles.aiCardIcon}>
            {isStartingChat ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="sparkles" size={22} color={colors.primary} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.aiCardTitle}>Analizar con IA</Text>
            <Text style={styles.aiCardSubtitle}>Chateá con Gemini sobre tus finanzas, con contexto real</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.historyLink}
          onPress={() => navigation.navigate('AiChatHistory')}
          disabled={isStartingChat}
        >
          <Ionicons name="time-outline" size={15} color={colors.textSecondary} />
          <Text style={styles.historyLinkText}>Ver conversaciones anteriores</Text>
        </TouchableOpacity>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderLeftColor: colors.success }]}>
            <Text style={styles.statLabel}>Me deben</Text>
            <Text style={[styles.statValue, { color: colors.successText }]}>$ {totalMeDeben.toLocaleString('es-CO')}</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: colors.danger }]}>
            <Text style={styles.statLabel}>Debo</Text>
            <Text style={[styles.statValue, { color: colors.danger }]}>$ {totalDebo.toLocaleString('es-CO')}</Text>
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
  aiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  aiCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.infoLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  aiCardTitle: { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 2 },
  aiCardSubtitle: { fontSize: 12, color: colors.textSecondary },
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    marginBottom: 20,
    paddingVertical: 4,
  },
  historyLinkText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
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
