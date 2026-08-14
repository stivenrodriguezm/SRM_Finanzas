import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Linking, Alert, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, useFocusEffect, RouteProp } from '@react-navigation/native';
import { usePreferences } from '../context/PreferencesContext';
import { useAuth } from '../context/AuthContext';
import apiClient from '../services/apiClient';
import { getErrorMessage } from '../utils/apiError';
import { Account, Transaction } from '../types/models';
import { RootStackParamList, AppNavigation } from '../navigation/types';

type Colors = ReturnType<typeof usePreferences>['colors'];

export default function ReminderDetailScreen() {
  const { colors } = usePreferences();
  const styles = getStyles(colors);
  const route = useRoute<RouteProp<RootStackParamList, 'ReminderDetail'>>();
  const navigation = useNavigation<AppNavigation>();
  const { token } = useAuth();

  const { reminder, dateText, isUrgent } = route.params || {};

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [payments, setPayments] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [isPaymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(reminder?.amount ? String(reminder.amount) : '');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    if (!reminder) return;
    try {
      const [accRes, payRes] = await Promise.all([
        apiClient.get<Account[]>('/accounts'),
        apiClient.get<Transaction[]>(`/reminders/${reminder._id}/payments`),
      ]);
      setAccounts(accRes.data);
      setPayments(payRes.data);
      if (accRes.data.length > 0) {
        setSelectedAccountId(accRes.data[0]._id);
      }
    } catch (error) {
      console.log('Error fetching detail data:', error);
    }
  }, [reminder]);

  useFocusEffect(
    React.useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  if (!reminder) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Text style={{ textAlign: 'center', marginTop: 20 }}>No se encontró la información del recordatorio.</Text>
      </SafeAreaView>
    );
  }

  const handlePayment = () => {
    if (reminder.paymentLink) {
      Linking.openURL(reminder.paymentLink).catch((err) => {
        console.error("Couldn't load page", err);
        Alert.alert('Error', 'No se pudo abrir el enlace.');
      });
    }
  };

  const handleDeleteReminder = () => {
    Alert.alert(
      'Eliminar Recordatorio',
      '¿Estás seguro de que deseas eliminar este recordatorio? El historial de pagos se mantendrá como transacciones.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setIsSubmitting(true);
            try {
              await apiClient.delete(`/reminders/${reminder._id}`);
              Alert.alert('✅ Éxito', 'Recordatorio eliminado.');
              navigation.goBack();
            } catch (error) {
              console.log('Error deleting:', error);
              Alert.alert('Error', 'No se pudo eliminar el recordatorio.');
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const submitPayment = async () => {
    if (!paymentAmount || !selectedAccountId) {
      Alert.alert('Error', 'Por favor ingresa un monto y selecciona una cuenta.');
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient.post(`/reminders/${reminder._id}/pay`, {
        amount: Number(paymentAmount),
        accountId: selectedAccountId,
      });
      setPaymentModalVisible(false);
      Alert.alert('✅ Éxito', 'Pago registrado correctamente.');
      fetchData(); // Refresh history
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error, 'No se pudo registrar el pago.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const amountFormatted = reminder.amount ? `$ ${reminder.amount.toLocaleString('es-CO')}` : 'Sin monto';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        
        <View style={styles.card}>
          <View style={[styles.iconContainer, isUrgent ? { backgroundColor: '#FEF2F2' } : { backgroundColor: '#F3F4F6' }]}>
            <Ionicons name="notifications" size={32} color={isUrgent ? '#EF4444' : '#4B5563'} />
          </View>
          
          <Text style={styles.title}>{reminder.title}</Text>
          <Text style={[styles.date, isUrgent && { color: '#EF4444', fontWeight: '600' }]}>{dateText}</Text>
          <Text style={styles.amount}>{amountFormatted}</Text>
          
          <View style={styles.divider} />
          
          {reminder.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Descripción / Notas</Text>
              <Text style={styles.sectionText}>
                {reminder.description}
              </Text>
            </View>
          ) : null}
          
          {reminder.paymentLink ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Enlace de Pago</Text>
              <Text style={styles.linkText} numberOfLines={1} onPress={handlePayment}>
                {reminder.paymentLink}
              </Text>
            </View>
          ) : null}

          {!reminder.description && !reminder.paymentLink && (
            <Text style={{ color: '#9CA3AF', fontStyle: 'italic', marginBottom: 20 }}>
              Sin detalles adicionales.
            </Text>
          )}
        </View>

        <View style={styles.actionsContainer}>
          {reminder.paymentLink && (
            <TouchableOpacity style={styles.payButton} onPress={handlePayment}>
              <Text style={styles.payButtonText}>Pagar en Línea</Text>
              <Ionicons name="open-outline" size={20} color="#FFFFFF" style={{marginLeft: 8}} />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.markPaidButton} onPress={() => setPaymentModalVisible(true)} disabled={isSubmitting}>
            <Text style={styles.markPaidButtonText}>Agregar Pago</Text>
            <Ionicons name="cash-outline" size={20} color="#059669" style={{marginLeft: 8}} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => navigation.navigate('AddReminder', { reminder })}
          >
            <Text style={styles.editButtonText}>Modificar Recordatorio</Text>
            <Ionicons name="pencil-outline" size={18} color="#4B5563" style={{marginLeft: 8}} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.deleteButton}
            onPress={handleDeleteReminder}
          >
            <Text style={styles.deleteButtonText}>Eliminar Recordatorio</Text>
            <Ionicons name="trash-outline" size={18} color="#EF4444" style={{marginLeft: 8}} />
          </TouchableOpacity>
        </View>

        {payments.length > 0 && (
          <View style={styles.historyContainer}>
            <Text style={styles.historyTitle}>Historial de Pagos</Text>
            {payments.map(payment => (
              <View key={payment._id} style={styles.paymentItem}>
                <View style={styles.paymentIcon}>
                  <Ionicons name="checkmark-done-circle" size={24} color="#059669" />
                </View>
                <View style={styles.paymentInfo}>
                  <Text style={styles.paymentDate}>
                    {new Date(payment.date).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </Text>
                  <Text style={styles.paymentAccount}>Desde: {payment.account?.name || 'Desconocida'}</Text>
                </View>
                <Text style={styles.paymentAmountValue}>
                  $ {payment.amount.toLocaleString('es-CO')}
                </Text>
              </View>
            ))}
          </View>
        )}

      </ScrollView>

      {/* Modal Agregar Pago */}
      <Modal visible={isPaymentModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContent}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Registrar Pago</Text>
              <TouchableOpacity onPress={() => setPaymentModalVisible(false)}>
                <Ionicons name="close" size={24} color="#4B5563" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Monto */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Monto pagado</Text>
                <View style={styles.inputContainer}>
                  <Text style={{ fontSize: 16, color: '#9CA3AF', marginRight: 4 }}>$</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="0"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    value={paymentAmount}
                    onChangeText={setPaymentAmount}
                  />
                </View>
              </View>

              {/* Cuenta de origen */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Cuenta de origen</Text>
                {accounts.map(acc => (
                  <TouchableOpacity
                    key={acc._id}
                    style={[styles.accountOption, selectedAccountId === acc._id && styles.accountOptionSelected]}
                    onPress={() => setSelectedAccountId(acc._id)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={[styles.accountOptionIcon, { backgroundColor: acc.color || '#E5E7EB' }]}>
                        <Ionicons name={(acc.icon || 'wallet') as any} size={16} color="#fff" />
                      </View>
                      <Text style={styles.accountOptionName}>{acc.name}</Text>
                    </View>
                    {selectedAccountId === acc._id && (
                      <Ionicons name="checkmark-circle" size={24} color="#059669" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.submitPaymentButton} onPress={submitPayment} disabled={isSubmitting}>
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitPaymentText}>Guardar Pago</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
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
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 24,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  date: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  amount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 24,
  },
  divider: {
    height: 1,
    backgroundColor: colors.iconBg || '#F3F4F6',
    width: '100%',
    marginBottom: 24,
  },
  section: {
    width: '100%',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  linkText: {
    fontSize: 14,
    color: colors.info || '#3B82F6',
    textDecorationLine: 'underline',
  },
  actionsContainer: {
    gap: 12,
  },
  payButton: {
    backgroundColor: colors.success,
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  markPaidButton: {
    backgroundColor: '#D1FAE5',
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  markPaidButtonText: {
    color: '#059669',
    fontSize: 16,
    fontWeight: 'bold',
  },
  editButton: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border || '#E5E7EB',
  },
  editButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  deleteButtonText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
  },
  historyContainer: {
    marginTop: 32,
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  paymentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  paymentIcon: {
    marginRight: 12,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentDate: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  paymentAccount: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  paymentAmountValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
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
    color: '#1F2937',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
  },
  accountOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    marginBottom: 8,
  },
  accountOptionSelected: {
    backgroundColor: '#ECFDF5',
    borderColor: '#34D399',
  },
  accountOptionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  accountOptionName: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  submitPaymentButton: {
    backgroundColor: '#059669',
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  submitPaymentText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
