import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Linking, Alert, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, useFocusEffect, RouteProp } from '@react-navigation/native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { usePreferences } from '../context/PreferencesContext';
import { useAuth } from '../context/AuthContext';
import apiClient from '../services/apiClient';
import { getErrorMessage } from '../utils/apiError';
import { syncReminderNotifications } from '../services/notifications';
import { Account, Transaction, Reminder } from '../types/models';
import { RootStackParamList, AppNavigation } from '../navigation/types';

type Colors = ReturnType<typeof usePreferences>['colors'];

export default function ReminderDetailScreen() {
  const { colors, preferences, isDark } = usePreferences();
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

  const [snoozedUntil, setSnoozedUntil] = useState<string | null>(reminder?.snoozedUntil ?? null);
  const [showSnoozePicker, setShowSnoozePicker] = useState(false);
  const [snoozeDraft, setSnoozeDraft] = useState<Date>(
    reminder?.snoozedUntil ? new Date(reminder.snoozedUntil) : new Date(Date.now() + 24 * 60 * 60 * 1000)
  );
  const [isSnoozing, setIsSnoozing] = useState(false);

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

  const isSnoozed = !!snoozedUntil && new Date(snoozedUntil).getTime() >= new Date().setHours(0, 0, 0, 0);

  const applySnooze = async (date: Date | null) => {
    setIsSnoozing(true);
    try {
      await apiClient.put(`/reminders/${reminder._id}`, { snoozedUntil: date ? date.toISOString() : null });
      setSnoozedUntil(date ? date.toISOString() : null);
      setShowSnoozePicker(false);
      const { data } = await apiClient.get<Reminder[]>('/reminders');
      syncReminderNotifications(data, preferences.remindersNotifications).catch(() => {});
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error, 'No se pudo actualizar el aplazamiento.'));
    } finally {
      setIsSnoozing(false);
    }
  };

  const handleSnoozeDraftChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowSnoozePicker(false);
    if (date) setSnoozeDraft(date);
  };

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
          <View style={[styles.iconContainer, { backgroundColor: isUrgent ? colors.dangerLight : colors.iconBg }]}>
            <Ionicons name="notifications" size={32} color={isUrgent ? colors.danger : colors.textSecondary} />
          </View>

          <Text style={styles.title}>{reminder.title}</Text>
          <Text style={[styles.date, isUrgent && { color: colors.danger, fontWeight: '600' }]}>{dateText}</Text>

          {(reminder.notificationConfig?.mode === 'escalating' || isSnoozed) && (
            <View style={styles.badgeRow}>
              {reminder.notificationConfig?.mode === 'escalating' && (
                <View style={styles.badge}>
                  <Ionicons name="notifications" size={12} color={colors.primary} />
                  <Text style={styles.badgeText}>Notificaciones insistentes</Text>
                </View>
              )}
              {isSnoozed && snoozedUntil && (
                <View style={[styles.badge, { backgroundColor: colors.infoLight || colors.iconBg }]}>
                  <Ionicons name="time-outline" size={12} color={colors.info || colors.primary} />
                  <Text style={styles.badgeText}>
                    Aplazado hasta{' '}
                    {new Date(snoozedUntil).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                  </Text>
                </View>
              )}
            </View>
          )}

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
            <Text style={{ color: colors.textMuted, fontStyle: 'italic', marginBottom: 20 }}>
              Sin detalles adicionales.
            </Text>
          )}
        </View>

        <View style={styles.actionsContainer}>
          {reminder.paymentLink && (
            <TouchableOpacity style={styles.payButton} onPress={handlePayment}>
              <Text style={styles.payButtonText}>Pagar en Línea</Text>
              <Ionicons name="open-outline" size={20} color={colors.primaryText} style={{marginLeft: 8}} />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.markPaidButton} onPress={() => setPaymentModalVisible(true)} disabled={isSubmitting}>
            <Text style={styles.markPaidButtonText}>Agregar Pago</Text>
            <Ionicons name="cash-outline" size={20} color={colors.success} style={{marginLeft: 8}} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.editButton}
            onPress={() => setShowSnoozePicker(true)}
            disabled={isSnoozing}
          >
            <Text style={styles.editButtonText}>{isSnoozed ? 'Cambiar aplazamiento' : 'Aplazar Notificaciones'}</Text>
            <Ionicons name="time-outline" size={18} color={colors.textSecondary} style={{ marginLeft: 8 }} />
          </TouchableOpacity>

          {isSnoozed && (
            <TouchableOpacity onPress={() => applySnooze(null)} disabled={isSnoozing}>
              <Text style={styles.removeSnoozeText}>Quitar aplazamiento</Text>
            </TouchableOpacity>
          )}

          {showSnoozePicker && (
            <View style={Platform.OS === 'ios' ? styles.iosDatePickerWrapper : undefined}>
              <DateTimePicker
                value={snoozeDraft}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                minimumDate={new Date()}
                themeVariant={isDark ? 'dark' : 'light'}
                accentColor={colors.primary}
                onChange={handleSnoozeDraftChange}
                style={Platform.OS === 'ios' ? { backgroundColor: colors.card } : undefined}
              />
            </View>
          )}

          {showSnoozePicker && (
            <TouchableOpacity
              style={styles.dateConfirmBtn}
              onPress={() => applySnooze(snoozeDraft)}
              disabled={isSnoozing}
            >
              {isSnoozing ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.dateConfirmText}>Confirmar aplazamiento</Text>}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('AddReminder', { reminder })}
          >
            <Text style={styles.editButtonText}>Modificar Recordatorio</Text>
            <Ionicons name="pencil-outline" size={18} color={colors.textSecondary} style={{marginLeft: 8}} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.deleteButton}
            onPress={handleDeleteReminder}
          >
            <Text style={styles.deleteButtonText}>Eliminar Recordatorio</Text>
            <Ionicons name="trash-outline" size={18} color={colors.danger} style={{marginLeft: 8}} />
          </TouchableOpacity>
        </View>

        {payments.length > 0 && (
          <View style={styles.historyContainer}>
            <Text style={styles.historyTitle}>Historial de Pagos</Text>
            {payments.map(payment => (
              <View key={payment._id} style={styles.paymentItem}>
                <View style={styles.paymentIcon}>
                  <Ionicons name="checkmark-done-circle" size={24} color={colors.success} />
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
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Monto */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Monto pagado</Text>
                <View style={styles.inputContainer}>
                  <Text style={{ fontSize: 16, color: colors.textMuted, marginRight: 4 }}>$</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
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
                      <View style={[styles.accountOptionIcon, { backgroundColor: acc.color || colors.iconBg }]}>
                        <Ionicons name={(acc.icon || 'wallet') as any} size={16} color={colors.white} />
                      </View>
                      <Text style={styles.accountOptionName}>{acc.name}</Text>
                    </View>
                    {selectedAccountId === acc._id && (
                      <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.submitPaymentButton} onPress={submitPayment} disabled={isSubmitting}>
                {isSubmitting ? (
                  <ActivityIndicator color={colors.primaryText} />
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
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.transparentBg || colors.iconBg,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  removeSnoozeText: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
    marginBottom: 4,
  },
  iosDatePickerWrapper: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  dateConfirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dateConfirmText: {
    color: colors.primaryText,
    fontWeight: '600',
    fontSize: 15,
  },
  amount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 24,
  },
  divider: {
    height: 1,
    backgroundColor: colors.iconBg,
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
    color: colors.info,
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
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: 'bold',
  },
  markPaidButton: {
    backgroundColor: colors.successLight,
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  markPaidButtonText: {
    color: colors.successText,
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
    borderColor: colors.border,
  },
  editButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: colors.dangerLight,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  deleteButtonText: {
    color: colors.danger,
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
    borderBottomColor: colors.border,
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
    backgroundColor: colors.card,
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
    color: colors.textPrimary,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.iconBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
  },
  accountOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: colors.iconBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    marginBottom: 8,
  },
  accountOptionSelected: {
    backgroundColor: colors.successLight,
    borderColor: colors.success,
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
    color: colors.textPrimary,
    fontWeight: '500',
  },
  submitPaymentButton: {
    backgroundColor: colors.success,
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  submitPaymentText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: 'bold',
  }
});
