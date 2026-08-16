import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { usePreferences } from '../context/PreferencesContext';
import apiClient from '../services/apiClient';
import { getErrorMessage } from '../utils/apiError';
import { ReminderType, ReminderNotificationMode } from '../types/models';
import { DEFAULT_NOTIFICATION_CONFIG } from '../utils/reminderNotificationSchedule';
import { RootStackParamList, AppNavigation } from '../navigation/types';

type Colors = ReturnType<typeof usePreferences>['colors'];

const ESCALATING_PRESETS = {
  suave: { initialIntervalMinutes: 120, minIntervalMinutes: 60 },
  intenso: { initialIntervalMinutes: 120, minIntervalMinutes: 30 },
} as const;

const INTERVAL_CHOICES = [30, 60, 120, 180];

const formatInterval = (minutes: number): string => (minutes < 60 ? `${minutes} min` : `${minutes / 60} h`);

const formatHour = (hour: number): string => {
  const period = hour < 12 ? 'a. m.' : 'p. m.';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:00 ${period}`;
};

const formatDaysBefore = (days: number): string => (days === 0 ? 'Mismo día' : days === 1 ? '1 día antes' : `${days} días antes`);

interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  format: (value: number) => string;
  colors: Colors;
}

function Stepper({ label, value, min, max, onChange, format, colors }: StepperProps) {
  const styles = getStyles(colors);
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControl}>
        <TouchableOpacity
          style={styles.stepperButton}
          disabled={value <= min}
          onPress={() => onChange(Math.max(min, value - 1))}
        >
          <Ionicons name="remove" size={16} color={value <= min ? colors.textMuted : colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.stepperValue}>{format(value)}</Text>
        <TouchableOpacity
          style={styles.stepperButton}
          disabled={value >= max}
          onPress={() => onChange(Math.min(max, value + 1))}
        >
          <Ionicons name="add" size={16} color={value >= max ? colors.textMuted : colors.textPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface ChipGroupProps {
  label: string;
  value: number;
  options: number[];
  onChange: (value: number) => void;
  format: (value: number) => string;
  colors: Colors;
}

function ChipGroup({ label, value, options, onChange, format, colors }: ChipGroupProps) {
  const styles = getStyles(colors);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[styles.chip, value === opt && styles.chipActive]}
            onPress={() => onChange(opt)}
          >
            <Text style={[styles.chipText, value === opt && styles.chipTextActive]}>{format(opt)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function AddReminderScreen() {
  const { colors } = usePreferences();
  const styles = getStyles(colors);
  const navigation = useNavigation<AppNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, 'AddReminder'>>();

  const reminderToEdit = route.params?.reminder;
  const isEditing = !!reminderToEdit;

  // Si estamos editando y hay fecha, formatea la fecha inicial para el input
  let initialDateStr = '';
  if (reminderToEdit?.date && reminderToEdit.type === 'unico') {
    const d = new Date(reminderToEdit.date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    initialDateStr = `${day}/${month}/${year}`;
  }

  const [reminderType, setReminderType] = useState<ReminderType>(reminderToEdit?.type || 'unico');
  const [title, setTitle] = useState(reminderToEdit?.title || '');
  const [amount, setAmount] = useState(reminderToEdit?.amount ? reminderToEdit.amount.toString() : '');
  const [paymentLink, setPaymentLink] = useState(reminderToEdit?.paymentLink || '');
  const [description, setDescription] = useState(reminderToEdit?.description || '');
  const [dayOfMonth, setDayOfMonth] = useState(reminderToEdit?.dayOfMonth ? reminderToEdit.dayOfMonth.toString() : '');
  const [dateText, setDateText] = useState(initialDateStr); // formato DD/MM/AAAA

  const initialNotifConfig = reminderToEdit?.notificationConfig ?? DEFAULT_NOTIFICATION_CONFIG;
  const [notificationMode, setNotificationMode] = useState<ReminderNotificationMode>(initialNotifConfig.mode);
  const [daysBefore, setDaysBefore] = useState(initialNotifConfig.daysBefore);
  const [hour, setHour] = useState(initialNotifConfig.hour);
  const [startHour, setStartHour] = useState(initialNotifConfig.startHour);
  const [endHour, setEndHour] = useState(initialNotifConfig.endHour);
  const [initialIntervalMinutes, setInitialIntervalMinutes] = useState(initialNotifConfig.initialIntervalMinutes);
  const [minIntervalMinutes, setMinIntervalMinutes] = useState(initialNotifConfig.minIntervalMinutes);
  const initialPreset =
    initialNotifConfig.initialIntervalMinutes === ESCALATING_PRESETS.suave.initialIntervalMinutes &&
    initialNotifConfig.minIntervalMinutes === ESCALATING_PRESETS.suave.minIntervalMinutes
      ? 'suave'
      : initialNotifConfig.initialIntervalMinutes === ESCALATING_PRESETS.intenso.initialIntervalMinutes &&
        initialNotifConfig.minIntervalMinutes === ESCALATING_PRESETS.intenso.minIntervalMinutes
      ? 'intenso'
      : 'personalizado';
  const [escalatingPreset, setEscalatingPreset] = useState<'suave' | 'intenso' | 'personalizado'>(initialPreset);

  const applyPreset = (preset: 'suave' | 'intenso') => {
    setEscalatingPreset(preset);
    setInitialIntervalMinutes(ESCALATING_PRESETS[preset].initialIntervalMinutes);
    setMinIntervalMinutes(ESCALATING_PRESETS[preset].minIntervalMinutes);
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Para asegurar que si type cambia al editar se actualicen campos
    if (isEditing && reminderToEdit.title) {
      navigation.setOptions({ title: 'Modificar Recordatorio' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  const parseDateText = (text: string): Date | null => {
    const parts = text.replace(/-/g, '/').split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts.map(Number);
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2024) {
        return new Date(year, month - 1, day);
      }
    }
    return null;
  };

  const handleDateTextChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    let formatted = '';
    if (cleaned.length >= 1) formatted += cleaned.substring(0, 2);
    if (cleaned.length >= 3) formatted += '/' + cleaned.substring(2, 4);
    if (cleaned.length >= 5) formatted += '/' + cleaned.substring(4, 8);
    setDateText(formatted);
  };

  const handleSave = async () => {
    if (!title) {
      Alert.alert('Error', 'Por favor ingresa un nombre para el recordatorio.');
      return;
    }

    let reminderDate;
    if (reminderType === 'unico') {
      if (!dateText) {
        Alert.alert('Error', 'Por favor ingresa una fecha (DD/MM/AAAA).');
        return;
      }
      reminderDate = parseDateText(dateText);
      if (!reminderDate) {
        Alert.alert('Error', 'Formato de fecha incorrecto. Usa DD/MM/AAAA.\nEjemplo: 15/07/2026');
        return;
      }
    } else {
      const day = parseInt(dayOfMonth, 10);
      if (!day || day < 1 || day > 31) {
        Alert.alert('Error', 'Por favor ingresa un día de mes válido (1-31).');
        return;
      }
      const now = new Date();
      const nextDate = new Date(now.getFullYear(), now.getMonth(), day);
      if (nextDate <= now) {
        nextDate.setMonth(nextDate.getMonth() + 1);
      }
      reminderDate = nextDate;
    }

    setIsSubmitting(true);
    try {
      const rawAmount = amount ? amount.replace(/[^0-9]/g, '') : '';
      const payload = {
        title,
        date: reminderDate,
        type: reminderType,
        amount: rawAmount && rawAmount.length > 0 ? Number(rawAmount) : undefined,
        paymentLink: paymentLink && paymentLink.trim() ? paymentLink.trim() : undefined,
        description: description && description.trim() ? description.trim() : undefined,
        dayOfMonth: reminderType === 'periodico' && dayOfMonth ? parseInt(dayOfMonth, 10) : undefined,
        notificationConfig: {
          mode: notificationMode,
          daysBefore,
          hour,
          startHour,
          endHour,
          initialIntervalMinutes,
          minIntervalMinutes,
        },
      };

      if (isEditing) {
        await apiClient.put(`/reminders/${reminderToEdit._id}`, payload);
      } else {
        await apiClient.post('/reminders', payload);
      }

      // Volver a la pantalla anterior (lista de recordatorios)
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error, 'No se pudo guardar el recordatorio.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

          <Text style={styles.sectionTitle}>Frecuencia</Text>
          <View style={styles.typeSelectorContainer}>
            <TouchableOpacity
              style={[styles.typePill, reminderType === 'unico' && styles.typePillActive]}
              onPress={() => setReminderType('unico')}
            >
              <Text style={[styles.typeText, reminderType === 'unico' && styles.typeTextActive]}>Único</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typePill, reminderType === 'periodico' && styles.typePillActive]}
              onPress={() => setReminderType('periodico')}
            >
              <Text style={[styles.typeText, reminderType === 'periodico' && styles.typeTextActive]}>Periódico</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Nombre del Recordatorio</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="notifications-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="Ej. Cuota Apartamento, Netflix..."
                placeholderTextColor={colors.textMuted}
                value={title}
                onChangeText={setTitle}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Monto a Pagar</Text>
            <View style={styles.amountInputContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0"
                keyboardType="numeric"
                placeholderTextColor={colors.textMuted}
                value={amount}
                onChangeText={setAmount}
              />
            </View>
          </View>

          {reminderType === 'unico' ? (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Fecha de Vencimiento</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="calendar-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="DD/MM/AAAA (Ej: 15/07/2026)"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  value={dateText}
                  onChangeText={handleDateTextChange}
                  maxLength={10}
                />
              </View>
            </View>
          ) : (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Día de pago (Cada mes)</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="repeat-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Día del mes (1 - 31)"
                  keyboardType="numeric"
                  placeholderTextColor={colors.textMuted}
                  maxLength={2}
                  value={dayOfMonth}
                  onChangeText={setDayOfMonth}
                />
              </View>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Enlace de Pago (Opcional)</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="link-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="https://..."
                keyboardType="url"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                value={paymentLink}
                onChangeText={setPaymentLink}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Descripción / Notas</Text>
            <View style={[styles.inputContainer, { alignItems: 'flex-start' }]}>
              <Ionicons name="document-text-outline" size={20} color={colors.textMuted} style={[styles.inputIcon, { marginTop: 4 }]} />
              <TextInput
                style={[styles.textInput, { minHeight: 80, textAlignVertical: 'top' }]}
                placeholder="Añade detalles relevantes sobre este pago..."
                multiline
                placeholderTextColor={colors.textMuted}
                value={description}
                onChangeText={setDescription}
              />
            </View>
          </View>

          <Text style={styles.sectionTitle}>Notificaciones</Text>
          <View style={styles.typeSelectorContainer}>
            <TouchableOpacity
              style={[styles.typePill, notificationMode === 'default' && styles.typePillActive]}
              onPress={() => setNotificationMode('default')}
            >
              <Text style={[styles.typeText, notificationMode === 'default' && styles.typeTextActive]}>Simple</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typePill, notificationMode === 'escalating' && styles.typePillActive]}
              onPress={() => setNotificationMode('escalating')}
            >
              <Text style={[styles.typeText, notificationMode === 'escalating' && styles.typeTextActive]}>Insistente</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typePill, notificationMode === 'off' && styles.typePillActive]}
              onPress={() => setNotificationMode('off')}
            >
              <Text style={[styles.typeText, notificationMode === 'off' && styles.typeTextActive]}>Apagado</Text>
            </TouchableOpacity>
          </View>

          {notificationMode === 'default' && (
            <View style={styles.notifConfigBox}>
              <Stepper
                label="Días de anticipación"
                value={daysBefore}
                min={0}
                max={7}
                onChange={setDaysBefore}
                format={formatDaysBefore}
                colors={colors}
              />
              <Stepper label="Hora del aviso" value={hour} min={0} max={23} onChange={setHour} format={formatHour} colors={colors} />
            </View>
          )}

          {notificationMode === 'escalating' && (
            <View style={styles.notifConfigBox}>
              <Text style={styles.notifHint}>
                Empieza cada {formatInterval(initialIntervalMinutes)} y va aumentando la frecuencia hasta cada{' '}
                {formatInterval(minIntervalMinutes)}, entre las {formatHour(startHour)} y las {formatHour(endHour)}, mientras
                siga sin pagarse.
              </Text>
              <View style={styles.chipRow}>
                <TouchableOpacity
                  style={[styles.chip, escalatingPreset === 'suave' && styles.chipActive]}
                  onPress={() => applyPreset('suave')}
                >
                  <Text style={[styles.chipText, escalatingPreset === 'suave' && styles.chipTextActive]}>Suave</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, escalatingPreset === 'intenso' && styles.chipActive]}
                  onPress={() => applyPreset('intenso')}
                >
                  <Text style={[styles.chipText, escalatingPreset === 'intenso' && styles.chipTextActive]}>Intenso</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, escalatingPreset === 'personalizado' && styles.chipActive]}
                  onPress={() => setEscalatingPreset('personalizado')}
                >
                  <Text style={[styles.chipText, escalatingPreset === 'personalizado' && styles.chipTextActive]}>
                    Personalizado
                  </Text>
                </TouchableOpacity>
              </View>

              {escalatingPreset === 'personalizado' && (
                <>
                  <Stepper label="Hora de inicio" value={startHour} min={0} max={23} onChange={setStartHour} format={formatHour} colors={colors} />
                  <Stepper label="Hora límite" value={endHour} min={0} max={23} onChange={setEndHour} format={formatHour} colors={colors} />
                  <ChipGroup
                    label="Intervalo inicial"
                    value={initialIntervalMinutes}
                    options={INTERVAL_CHOICES}
                    onChange={setInitialIntervalMinutes}
                    format={formatInterval}
                    colors={colors}
                  />
                  <ChipGroup
                    label="Intervalo mínimo"
                    value={minIntervalMinutes}
                    options={INTERVAL_CHOICES}
                    onChange={setMinIntervalMinutes}
                    format={formatInterval}
                    colors={colors}
                  />
                </>
              )}
            </View>
          )}

          {notificationMode === 'off' && (
            <View style={styles.notifConfigBox}>
              <Text style={styles.notifHint}>No recibirás notificaciones para este recordatorio.</Text>
            </View>
          )}

          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={isSubmitting}>
            {isSubmitting ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text style={styles.saveButtonText}>
                {isEditing ? 'Guardar Cambios' : 'Guardar Recordatorio'}
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
  container: { padding: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 12 },
  typeSelectorContainer: { flexDirection: 'row', marginBottom: 24, gap: 12 },
  typePill: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: colors.border, borderRadius: 24 },
  typePillActive: { backgroundColor: colors.primary },
  typeText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  typeTextActive: { color: colors.primaryText },
  inputGroup: { marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginBottom: 8 },
  amountInputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  currencySymbol: { fontSize: 24, fontWeight: 'bold', color: colors.textPrimary, marginRight: 8 },
  amountInput: { flex: 1, fontSize: 24, fontWeight: 'bold', color: colors.textPrimary },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  inputIcon: { marginRight: 12 },
  textInput: { flex: 1, fontSize: 16, color: colors.textPrimary },
  notifConfigBox: {
    backgroundColor: colors.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: colors.border, marginBottom: 24,
  },
  notifHint: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: 12 },
  stepperRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16,
  },
  stepperLabel: { fontSize: 14, color: colors.textPrimary, fontWeight: '500', flexShrink: 1, marginRight: 12 },
  stepperControl: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperButton: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.iconBg,
    justifyContent: 'center', alignItems: 'center',
  },
  stepperValue: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, minWidth: 78, textAlign: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16,
    backgroundColor: colors.iconBg, borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  chipTextActive: { color: colors.primaryText },
  saveButton: {
    backgroundColor: colors.success,
    borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 30,
    shadowColor: colors.success, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  saveButtonText: { color: colors.primaryText, fontSize: 16, fontWeight: 'bold' },
});
