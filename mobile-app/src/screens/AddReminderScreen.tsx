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
import { ReminderType } from '../types/models';
import { RootStackParamList, AppNavigation } from '../navigation/types';

type Colors = ReturnType<typeof usePreferences>['colors'];

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
        dayOfMonth: reminderType === 'periodico' && dayOfMonth ? parseInt(dayOfMonth, 10) : undefined
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
              <Ionicons name="notifications-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="Ej. Cuota Apartamento, Netflix..."
                placeholderTextColor="#9CA3AF"
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
                placeholderTextColor="#9CA3AF"
                value={amount}
                onChangeText={setAmount}
              />
            </View>
          </View>

          {reminderType === 'unico' ? (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Fecha de Vencimiento</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="calendar-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="DD/MM/AAAA (Ej: 15/07/2026)"
                  placeholderTextColor="#9CA3AF"
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
                <Ionicons name="repeat-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Día del mes (1 - 31)"
                  keyboardType="numeric"
                  placeholderTextColor="#9CA3AF"
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
              <Ionicons name="link-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="https://..."
                keyboardType="url"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                value={paymentLink}
                onChangeText={setPaymentLink}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Descripción / Notas</Text>
            <View style={[styles.inputContainer, { alignItems: 'flex-start' }]}>
              <Ionicons name="document-text-outline" size={20} color="#9CA3AF" style={[styles.inputIcon, { marginTop: 4 }]} />
              <TextInput
                style={[styles.textInput, { minHeight: 80, textAlignVertical: 'top' }]}
                placeholder="Añade detalles relevantes sobre este pago..."
                multiline
                placeholderTextColor="#9CA3AF"
                value={description}
                onChangeText={setDescription}
              />
            </View>
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={isSubmitting}>
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
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
  typeTextActive: { color: '#FFFFFF' },
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
  saveButton: {
    backgroundColor: colors.success,
    borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 30,
    shadowColor: colors.success, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});
