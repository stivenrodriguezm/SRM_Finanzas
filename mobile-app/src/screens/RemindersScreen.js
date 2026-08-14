import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { usePreferences } from '../context/PreferencesContext';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import SkeletonLoader from '../components/SkeletonLoader';
import { API_URL } from '../config/api';

export default function RemindersScreen() {
  const navigation = useNavigation();
  const { token } = useAuth();
  const { preferences, colors, isDark } = usePreferences();
  const styles = getStyles(colors);
  const [isPrivate, setIsPrivate] = useState(preferences.privacy.reminders);
  
  React.useEffect(() => {
    setIsPrivate(preferences.privacy.reminders);
  }, [preferences.privacy.reminders]);
  const [isLoading, setIsLoading] = useState(true);
  const [reminders, setReminders] = useState([]);

  const fetchReminders = async () => {
    if (!token) return;
    try {
      const { data } = await axios.get(`${API_URL}/reminders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReminders(data);
    } catch (error) {
      console.log('Error fetching reminders', error);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchReminders();
    }, [token])
  );

  const maskValue = (val) => isPrivate ? '****' : val;
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pagos Pendientes</Text>
        <TouchableOpacity style={styles.eyeButton} onPress={() => setIsPrivate(!isPrivate)}>
          <Ionicons name={isPrivate ? 'eye-off-outline' : 'eye-outline'} size={24} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <SkeletonLoader type="list" />
        ) : (
          <>
            {reminders.length === 0 ? (
              <Text style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 20 }}>No tienes recordatorios</Text>
            ) : (
              reminders.map((reminder) => {
                const diffTime = new Date(reminder.date) - new Date();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const isUrgent = diffDays <= 1;
                
                let dateText = `Vence en ${diffDays} días`;
                if (diffDays === 0) dateText = 'Vence Hoy';
                if (diffDays === 1) dateText = 'Vence Mañana';
                if (diffDays < 0) dateText = `Vencido hace ${Math.abs(diffDays)} días`;
                
                return (
                  <View key={reminder._id} style={[styles.reminderCard, isUrgent && styles.reminderCardUrgent]}>
                    <View style={styles.cardTop}>
                      <View style={styles.cardHeaderInfo}>
                        <View style={[styles.iconContainer, { backgroundColor: isUrgent ? '#FEF2F2' : '#F3F4F6' }]}>
                          <Ionicons name="notifications" size={20} color={isUrgent ? '#EF4444' : '#4B5563'} />
                        </View>
                        <View>
                          <Text style={styles.reminderTitle}>{reminder.title}</Text>
                          <Text style={isUrgent ? styles.reminderDateUrgent : styles.reminderDate}>{dateText}</Text>
                        </View>
                      </View>
                      <Text style={styles.reminderAmount}>{maskValue(reminder.amount ? `$ ${reminder.amount.toLocaleString('es-CO')}` : 'Sin monto')}</Text>
                    </View>
                    
                    <TouchableOpacity 
                      style={isUrgent ? styles.primaryButton : styles.secondaryButton} 
                      onPress={() => navigation.navigate('ReminderDetail', { reminder, dateText, isUrgent })}
                    >
                      <Text style={isUrgent ? styles.primaryButtonText : styles.secondaryButtonText}>Ver más</Text>
                      <Ionicons name="arrow-forward" size={16} color={isUrgent ? '#FFFFFF' : '#111827'} style={{marginLeft: 8}} />
                    </TouchableOpacity>
                  </View>
                );
              })
            )}

            {/* Espacio extra al final para que el botón flotante no tape contenido */}
            <View style={{height: 80}} />
          </>
        )}
      </ScrollView>

      {/* Botón Flotante para añadir */}
      <View style={styles.floatingButtonContainer}>
        <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('AddReminder')}>
          <Ionicons name="add" size={24} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Añadir Recordatorio</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 20, 
    marginTop: 10,
    paddingHorizontal: 20
  },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: colors.textPrimary },
  eyeButton: { padding: 4 },
  container: {
    paddingHorizontal: 20,
  },
  reminderCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.iconBg,
  },
  reminderCardUrgent: {
    borderColor: '#FECACA',
    borderWidth: 1,
    backgroundColor: '#FFFAFA',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  cardHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  reminderDate: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  reminderDateUrgent: {
    fontSize: 13,
    color: colors.danger,
    fontWeight: '500',
  },
  reminderAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  primaryButton: {
    backgroundColor: colors.textPrimary,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.card,
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: colors.iconBg,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  addButtonText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
