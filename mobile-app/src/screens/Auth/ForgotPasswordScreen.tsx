import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { AppNavigation } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<AppNavigation>();
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReset = async () => {
    if (!email) {
      Alert.alert('Error', 'Por favor ingresa tu correo electrónico');
      return;
    }
    setIsSubmitting(true);
    try {
      await forgotPassword(email);
      Alert.alert(
        'Código enviado',
        'Si existe una cuenta con este correo, recibirás un código de 6 dígitos para restablecer tu contraseña.',
        [{ text: 'OK', onPress: () => navigation.navigate('ResetPassword', { email }) }]
      );
    } catch {
      // El error ya se muestra desde AuthContext
    }
    setIsSubmitting(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color="#111827" style={{ marginLeft: -1 }} />
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>Recuperar Contraseña</Text>
            <Text style={styles.subtitle}>Ingresa tu correo y te enviaremos un código de 6 dígitos para restablecerla.</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Correo electrónico</Text>
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="correo@ejemplo.com"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>

            <TouchableOpacity style={styles.resetBtn} onPress={handleReset} disabled={isSubmitting}>
              <Text style={styles.resetBtnText}>{isSubmitting ? 'Enviando...' : 'Enviar Código'}</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  header: { marginBottom: 32 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#6B7280', lineHeight: 24 },
  form: { marginBottom: 32 },
  inputGroup: { marginBottom: 24 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB',
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14
  },
  inputIcon: { marginRight: 12 },
  textInput: { flex: 1, fontSize: 16, color: '#111827' },
  resetBtn: {
    backgroundColor: '#3B82F6', borderRadius: 16, paddingVertical: 16,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8
  },
  resetBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }
});
