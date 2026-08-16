import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  ScrollView, Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { usePreferences } from '../context/PreferencesContext';
import { useAuth } from '../context/AuthContext';
import apiClient from '../services/apiClient';
import { getErrorMessage } from '../utils/apiError';
import { ActivityIndicator, Alert } from 'react-native';
import { Debt, DebtType } from '../types/models';
import { RootStackParamList, AppNavigation } from '../navigation/types';

type Colors = ReturnType<typeof usePreferences>['colors'];

export default function AddDebtScreen() {
  const { colors, isDark } = usePreferences();
  const styles = getStyles(colors);
  const navigation = useNavigation<AppNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, 'AddDebt'>>();

  // ── Parámetros de entrada ─────────────────────────────────
  // initialDebtType: viene desde ReceivablesScreen ('me_deben') o DebtDetail ('modificar_detalles')
  const initialDebtType = route.params?.initialDebtType || 'debo';
  const isModifyMode = route.params?.isModifyMode === true;
  const debtId = route.params?.id;

  const [debtType, setDebtType] = useState<DebtType>(initialDebtType);

  // ── Estado activa/inactiva — solo relevante en modo modificar
  const [isActive, setIsActive] = useState(true);

  // ── DatePicker ─────────────────────────────────
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const formatDate = (date: Date | null) => {
    if (!date) return null;
    return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const { token } = useAuth();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingDebt, setIsLoadingDebt] = useState(isModifyMode);

  // En modo modificar, precarga los datos actuales de la deuda (antes el formulario quedaba vacío).
  React.useEffect(() => {
    if (!isModifyMode || !debtId || !token) return;
    (async () => {
      try {
        const { data } = await apiClient.get<Debt>(`/debts/${debtId}`);
        setName(data.name);
        setDebtType(data.type);
        setDescription(data.description || '');
        setIsActive(data.isActive);
        if (data.dueDate) setSelectedDate(new Date(data.dueDate));
      } catch (error) {
        Alert.alert('Error', getErrorMessage(error, 'No se pudo cargar la deuda'));
      } finally {
        setIsLoadingDebt(false);
      }
    })();
  }, [isModifyMode, debtId, token]);

  const handleSave = async () => {
    if (!name) {
      Alert.alert('Error', 'Por favor ingresa un nombre.');
      return;
    }
    if (!isModifyMode && !amount) {
      Alert.alert('Error', 'Por favor ingresa un monto.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isModifyMode) {
        await apiClient.put(`/debts/${debtId}`, {
          name,
          type: debtType,
          dueDate: selectedDate,
          isActive,
          description,
        });
      } else {
        await apiClient.post('/debts', {
          name,
          totalAmount: Number(amount.replace(/\D/g, '')),
          type: debtType,
          dueDate: selectedDate,
          description,
          color: debtType === 'debo' ? '#EF4444' : '#10B981',
          icon: 'person',
        });
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error, 'No se pudo guardar la deuda.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDateChange = (_event: DateTimePickerEvent, date?: Date) => {
    // En iOS el picker es inline; en Android cerramos al elegir
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (date) setSelectedDate(date);
  };

  if (isLoadingDebt) {
    return (
      <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >


          {/* Selector de Tipo — OCULTO en modo "Modificar Detalles" (tarea 13) */}
          {!isModifyMode && (
            <>
              <Text style={styles.sectionTitle}>Tipo de Registro</Text>
              <View style={styles.typeSelectorContainer}>
                <TouchableOpacity
                  style={[styles.typePill, debtType === 'debo' && styles.typePillActive]}
                  onPress={() => setDebtType('debo')}
                >
                  <Text style={[styles.typeText, debtType === 'debo' && styles.typeTextActive]}>
                    Yo Debo
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typePill, debtType === 'me_deben' && styles.typePillActive]}
                  onPress={() => setDebtType('me_deben')}
                >
                  <Text style={[styles.typeText, debtType === 'me_deben' && styles.typeTextActive]}>
                    Me Deben
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Nombre */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Nombre de la persona o entidad</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="Ej. Juan Pérez, Banco..."
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
              />
            </View>
          </View>

          {/* Monto — OCULTO en modo Modificar Detalles (tarea 6) */}
          {!isModifyMode && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Monto Total</Text>
              <View style={styles.amountInputContainer}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0.00"
                  keyboardType="numeric"
                  placeholderTextColor={colors.textMuted}
                  value={amount}
                  onChangeText={setAmount}
                />
              </View>
            </View>
          )}

          {/* Fecha Límite con DatePicker nativo (tarea 10) */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Fecha Límite (Opcional)</Text>
            <TouchableOpacity
              style={styles.inputContainer}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
              <Text style={[styles.textInput, !selectedDate && { color: colors.textMuted }]}>
                {selectedDate ? formatDate(selectedDate) : 'Seleccionar fecha'}
              </Text>
              {selectedDate && (
                <TouchableOpacity onPress={() => setSelectedDate(null)}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {/* DateTimePicker nativo con contraste correcto en iOS (tarea 4) */}
            {showDatePicker && (
              <View style={Platform.OS === 'ios' ? styles.iosDatePickerWrapper : undefined}>
                <DateTimePicker
                  value={selectedDate || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  minimumDate={new Date()}
                  themeVariant={isDark ? 'dark' : 'light'}
                  accentColor={colors.primary}
                  onChange={handleDateChange}
                  style={Platform.OS === 'ios' ? styles.iosDatePicker : undefined}
                />
              </View>
            )}

            {/* Botón confirmar en iOS (el picker queda visible inline) */}
            {showDatePicker && Platform.OS === 'ios' && (
              <TouchableOpacity
                style={styles.dateConfirmBtn}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={styles.dateConfirmText}>Confirmar fecha</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Descripción / Notas */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Descripción / Notas</Text>
            <View style={[styles.inputContainer, { alignItems: 'flex-start' }]}>
              <Ionicons
                name="document-text-outline"
                size={20}
                color={colors.textMuted}
                style={[styles.inputIcon, { marginTop: 4 }]}
              />
              <TextInput
                style={[styles.textInput, { minHeight: 80, textAlignVertical: 'top' }]}
                placeholder="Motivo del préstamo, condiciones..."
                multiline
                placeholderTextColor={colors.textMuted}
                value={description}
                onChangeText={setDescription}
              />
            </View>
          </View>

          {/* Estado de la Deuda: activa / inactiva — solo en modo Modificar (tarea B) */}
          {isModifyMode && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Estado de la Deuda</Text>
              <View style={styles.statusContainer}>
                <TouchableOpacity
                  style={[styles.statusPill, isActive && styles.statusPillActive]}
                  onPress={() => setIsActive(true)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.statusDot, { backgroundColor: isActive ? colors.success : colors.textMuted }]} />
                  <Text style={[styles.statusPillText, isActive && styles.statusPillTextActive]}>
                    Activa
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.statusPill, !isActive && styles.statusPillInactive]}
                  onPress={() => setIsActive(false)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.statusDot, { backgroundColor: !isActive ? colors.danger : colors.textMuted }]} />
                  <Text style={[styles.statusPillText, !isActive && styles.statusPillTextInactive]}>
                    Desactivada
                  </Text>
                </TouchableOpacity>
              </View>
              {!isActive && (
                <Text style={styles.statusWarning}>
                  ⚠️ Al desactivar esta deuda, ya no aparecerá en tus resúmenes activos.
                </Text>
              )}
            </View>
          )}

          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={isSubmitting}>
            {isSubmitting ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text style={styles.saveButtonText}>
                {isModifyMode ? 'Guardar Cambios' : 'Guardar Deuda'}
              </Text>
            )}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors: Colors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { padding: 24, paddingBottom: 40 },
  screenTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 24,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 12 },
  typeSelectorContainer: { flexDirection: 'row', marginBottom: 24, gap: 12 },
  typePill: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.border,
    borderRadius: 24,
  },
  typePillActive: { backgroundColor: colors.primary },
  typeText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  typeTextActive: { color: colors.primaryText },
  inputGroup: { marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginBottom: 8 },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currencySymbol: { fontSize: 24, fontWeight: 'bold', color: colors.textPrimary, marginRight: 8 },
  amountInput: { flex: 1, fontSize: 24, fontWeight: 'bold', color: colors.textPrimary },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputIcon: { marginRight: 12 },
  textInput: { flex: 1, fontSize: 16, color: colors.textPrimary },
  // DatePicker iOS
  iosDatePickerWrapper: {
    marginTop: 10,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  iosDatePicker: {
    backgroundColor: colors.card,
  },
  dateConfirmBtn: {
    marginTop: 10,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dateConfirmText: { color: colors.card, fontWeight: '600', fontSize: 15 },
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
  saveButtonText: { color: colors.primaryText, fontSize: 16, fontWeight: 'bold' },

  // ── Estado activa/inactiva (tarea B) ──
  statusContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  statusPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.iconBg,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 8,
  },
  statusPillActive: {
    backgroundColor: colors.successLight,
    borderColor: colors.success,
  },
  statusPillInactive: {
    backgroundColor: colors.dangerLight,
    borderColor: colors.danger,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  statusPillTextActive: {
    color: colors.success,
  },
  statusPillTextInactive: {
    color: colors.danger,
  },
  statusWarning: {
    fontSize: 12,
    color: colors.warning,
    marginTop: 10,
    backgroundColor: colors.warningLight,
    padding: 10,
    borderRadius: 10,
    lineHeight: 18,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
});

