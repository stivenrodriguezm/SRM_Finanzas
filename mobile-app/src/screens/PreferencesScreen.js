import React from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, Switch, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { usePreferences } from '../context/PreferencesContext';

// ── Componente pill selector de tema ───────────────────────────────────────
function ThemePill({ label, value, icon, currentTheme, onSelect }) {
  const { colors } = usePreferences();
  const styles = getStyles(colors);

  const isActive = currentTheme === value;
  return (
    <TouchableOpacity
      style={[styles.themePill, isActive && styles.themePillActive]}
      onPress={() => onSelect(value)}
      activeOpacity={0.75}
    >
      <Ionicons name={icon} size={16} color={isActive ? '#FFFFFF' : '#6B7280'} />
      <Text style={[styles.themePillText, isActive && styles.themePillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Fila de privacidad por sección ─────────────────────────────────────────
function PrivacyRow({ icon, iconBg, iconColor, label, sectionKey, value, onToggle }) {
  const { colors } = usePreferences();
  const styles = getStyles(colors);

  return (
    <View style={styles.privacyRow}>
      <View style={[styles.privacyIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={styles.privacyLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={(v) => onToggle(sectionKey, v)}
        trackColor={{ false: '#E5E7EB', true: '#059669' }}
        thumbColor="#FFFFFF"
        style={Platform.OS === 'android' ? { transform: [{ scale: 0.9 }] } : undefined}
      />
    </View>
  );
}

export default function PreferencesScreen() {
  const navigation = useNavigation();
  const { preferences, updatePreference, updatePrivacy, colors, isDark } = usePreferences();
  const styles = getStyles(colors);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* ── Tema visual ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="color-palette-outline" size={20} color="#7C3AED" />
            <Text style={styles.sectionTitle}>Tema Visual</Text>
          </View>
          <View style={styles.themeRow}>
            <ThemePill
              label="Claro"
              value="light"
              icon="sunny-outline"
              currentTheme={preferences.theme}
              onSelect={(v) => updatePreference('theme', v)}
            />
            <ThemePill
              label="Oscuro"
              value="dark"
              icon="moon-outline"
              currentTheme={preferences.theme}
              onSelect={(v) => updatePreference('theme', v)}
            />
            <ThemePill
              label="Sistema"
              value="adaptive"
              icon="phone-portrait-outline"
              currentTheme={preferences.theme}
              onSelect={(v) => updatePreference('theme', v)}
            />
          </View>
        </View>

        {/* ── Privacidad inicial por sección ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="eye-off-outline" size={20} color="#DC2626" />
            <Text style={styles.sectionTitle}>Privacidad por Sección</Text>
          </View>
          <Text style={styles.sectionDesc}>
            Elige si los valores monetarios arrancan ocultos (****) en cada pantalla al abrirla.
          </Text>

          <PrivacyRow
            icon="home-outline"
            iconBg="#EFF6FF"
            iconColor="#3B82F6"
            label="Inicio (Patrimonio Neto)"
            sectionKey="home"
            value={preferences.privacy.home}
            onToggle={updatePrivacy}
          />
          <View style={styles.privacySeparator} />
          <PrivacyRow
            icon="list-outline"
            iconBg="#F5F3FF"
            iconColor="#7C3AED"
            label="Transacciones"
            sectionKey="transactions"
            value={preferences.privacy.transactions}
            onToggle={updatePrivacy}
          />
          <View style={styles.privacySeparator} />
          <PrivacyRow
            icon="card-outline"
            iconBg="#FEF2F2"
            iconColor="#DC2626"
            label="Deudas"
            sectionKey="debts"
            value={preferences.privacy.debts}
            onToggle={updatePrivacy}
          />
          <View style={styles.privacySeparator} />
          <PrivacyRow
            icon="calendar-outline"
            iconBg="#ECFDF5"
            iconColor="#059669"
            label="Recordatorios"
            sectionKey="reminders"
            value={preferences.privacy.reminders}
            onToggle={updatePrivacy}
          />
          <View style={styles.privacySeparator} />
          <PrivacyRow
            icon="people-outline"
            iconBg="#FFF7ED"
            iconColor="#EA580C"
            label="Me Deben"
            sectionKey="receivables"
            value={preferences.privacy.receivables}
            onToggle={updatePrivacy}
          />
        </View>

        {/* ── Otros ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="settings-outline" size={20} color="#374151" />
            <Text style={styles.sectionTitle}>Otros Ajustes</Text>
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleTitle}>Notificaciones de Recordatorios</Text>
              <Text style={styles.toggleSubtitle}>Recibe avisos antes de la fecha de vencimiento</Text>
            </View>
            <Switch
              value={preferences.remindersNotifications}
              onValueChange={(v) => updatePreference('remindersNotifications', v)}
              trackColor={{ false: '#E5E7EB', true: '#059669' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { padding: 20, paddingBottom: 40 },

  // ── Sección ──
  section: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary },
  sectionDesc: { fontSize: 13, color: colors.textSecondary, marginBottom: 16, lineHeight: 18 },

  // ── Tema ──
  themeRow: { flexDirection: 'row', gap: 10 },
  themePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.iconBg,
    gap: 6,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  themePillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  themePillText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  themePillTextActive: { color: colors.card },

  // ── Privacidad ──
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  privacyIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  privacyLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  privacySeparator: { height: 1, backgroundColor: '#F9FAFB', marginVertical: 2 },

  // ── Otros toggles ──
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  toggleInfo: { flex: 1 },
  toggleTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  toggleSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
