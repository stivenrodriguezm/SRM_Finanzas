import React, { useEffect, useState, useCallback, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, AppState, AppStateStatus } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePreferences } from '../context/PreferencesContext';
import { authenticateWithBiometrics } from '../services/biometricAuth';

/** Envuelve el stack autenticado: si el usuario activó el bloqueo biométrico en
 * Preferencias, exige Face ID/Touch ID al abrir la app y cada vez que vuelve
 * de segundo plano. */
export default function BiometricGate({ children }: { children: ReactNode }) {
  const { preferences, colors } = usePreferences();
  const [isUnlocked, setIsUnlocked] = useState(!preferences.biometricLockEnabled);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const tryUnlock = useCallback(async () => {
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    const success = await authenticateWithBiometrics();
    setIsAuthenticating(false);
    if (success) setIsUnlocked(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticating]);

  useEffect(() => {
    if (!preferences.biometricLockEnabled) {
      setIsUnlocked(true);
      return;
    }
    setIsUnlocked(false);
    tryUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences.biometricLockEnabled]);

  useEffect(() => {
    if (!preferences.biometricLockEnabled) return;
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') setIsUnlocked(false);
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [preferences.biometricLockEnabled]);

  if (isUnlocked) return <>{children}</>;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.iconCircle, { backgroundColor: colors.iconBg }]}>
        <Ionicons name="lock-closed" size={36} color={colors.primary} />
      </View>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Finanzas bloqueada</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Usa Face ID o Touch ID para continuar</Text>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.primary }]}
        onPress={tryUnlock}
        disabled={isAuthenticating}
        activeOpacity={0.85}
      >
        <Text style={styles.buttonText}>{isAuthenticating ? 'Verificando...' : 'Desbloquear'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 19, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 14, marginBottom: 24, textAlign: 'center' },
  button: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: 16 },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
