import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { usePreferences } from '../context/PreferencesContext';
import { useAuth } from '../context/AuthContext';
import SkeletonLoader from '../components/SkeletonLoader';
import apiClient from '../services/apiClient';
import { syncReminderNotifications } from '../services/notifications';
import { applySavedOrder, mergeOrderAfterDrag } from '../utils/orderPreference';
import { Reminder, AuthResponse } from '../types/models';
import { AppNavigation } from '../navigation/types';

type Colors = ReturnType<typeof usePreferences>['colors'];

export default function RemindersScreen() {
  const navigation = useNavigation<AppNavigation>();
  const { token, user, updateUserLocal } = useAuth();
  const { preferences, colors } = usePreferences();
  const styles = getStyles(colors);
  const [isPrivate, setIsPrivate] = useState(preferences.privacy.reminders);

  React.useEffect(() => {
    setIsPrivate(preferences.privacy.reminders);
  }, [preferences.privacy.reminders]);
  const [isLoading, setIsLoading] = useState(true);
  const [reminders, setReminders] = useState<Reminder[]>([]);

  const fetchReminders = async () => {
    if (!token) return;
    try {
      const { data } = await apiClient.get<Reminder[]>('/reminders');
      setReminders(data);
      syncReminderNotifications(data, preferences.remindersNotifications).catch(() => {});
    } catch (error) {
      console.log('Error fetching reminders', error);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchReminders();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token])
  );

  const orderedReminders = applySavedOrder(reminders, user?.preferences?.reminderOrder || []);

  const handleDragEnd = async ({ data }: { data: Reminder[] }) => {
    setReminders(data);
    const mergedOrder = mergeOrderAfterDrag(data.map((r) => r._id), user?.preferences?.reminderOrder || []);
    try {
      const { data: prefsData } = await apiClient.put<AuthResponse>('/auth/preferences', { reminderOrder: mergedOrder });
      updateUserLocal(prefsData);
    } catch (error) {
      console.log('Error saving reminder order', error);
    }
  };

  const maskValue = (val: string) => (isPrivate ? '****' : val);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Pagos Pendientes</Text>
          <TouchableOpacity style={styles.eyeButton} onPress={() => setIsPrivate(!isPrivate)}>
            <Ionicons name={isPrivate ? 'eye-off-outline' : 'eye-outline'} size={24} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.container}>
            <SkeletonLoader type="list" />
          </View>
        ) : (
          <DraggableFlatList
            data={orderedReminders}
            onDragEnd={handleDragEnd}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.container}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={{ textAlign: 'center', color: colors.textMuted, marginTop: 20 }}>No tienes recordatorios</Text>
            }
            renderItem={({ item: reminder, drag, isActive }) => {
              const diffTime = new Date(reminder.date).getTime() - new Date().getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              const isSnoozed = !!reminder.snoozedUntil && new Date(reminder.snoozedUntil).getTime() >= new Date().setHours(0, 0, 0, 0);
              const isUrgent = !isSnoozed && diffDays <= 1;

              let dateText = `Vence en ${diffDays} días`;
              if (diffDays === 0) dateText = 'Vence Hoy';
              if (diffDays === 1) dateText = 'Vence Mañana';
              if (diffDays < 0) dateText = `Vencido hace ${Math.abs(diffDays)} días`;

              return (
                <ScaleDecorator>
                  <TouchableOpacity
                    activeOpacity={1}
                    onLongPress={drag}
                    disabled={isActive}
                    style={[styles.reminderCard, isUrgent && styles.reminderCardUrgent, isActive && styles.reminderCardDragging]}
                  >
                    <View style={styles.cardTop}>
                      <View style={styles.cardHeaderInfo}>
                        <View style={[styles.iconContainer, { backgroundColor: isUrgent ? colors.dangerLight : colors.iconBg }]}>
                          <Ionicons name="notifications" size={20} color={isUrgent ? colors.danger : colors.textSecondary} />
                        </View>
                        <View>
                          <Text style={styles.reminderTitle}>{reminder.title}</Text>
                          <Text style={isUrgent ? styles.reminderDateUrgent : styles.reminderDate}>{dateText}</Text>
                          {isSnoozed && (
                            <View style={styles.snoozedPill}>
                              <Ionicons name="time-outline" size={11} color={colors.textSecondary} />
                              <Text style={styles.snoozedPillText}>Aplazado</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <Text style={styles.reminderAmount}>{maskValue(reminder.amount ? `$ ${reminder.amount.toLocaleString('es-CO')}` : 'Sin monto')}</Text>
                    </View>

                    <TouchableOpacity
                      style={isUrgent ? styles.primaryButton : styles.secondaryButton}
                      disabled={isActive}
                      onPress={() => navigation.navigate('ReminderDetail', { reminder, dateText, isUrgent })}
                    >
                      <Text style={isUrgent ? styles.primaryButtonText : styles.secondaryButtonText}>Ver más</Text>
                      <Ionicons name="arrow-forward" size={16} color={isUrgent ? colors.card : colors.textPrimary} style={{marginLeft: 8}} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                </ScaleDecorator>
              );
            }}
            ListFooterComponent={<View style={{ height: 80 }} />}
          />
        )}

        {/* Botón Flotante para añadir */}
        <View style={styles.floatingButtonContainer}>
          <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('AddReminder')}>
            <Ionicons name="add" size={24} color={colors.primaryText} />
            <Text style={styles.addButtonText}>Añadir Recordatorio</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const getStyles = (colors: Colors) => StyleSheet.create({
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
    borderColor: colors.danger,
    borderWidth: 1,
    backgroundColor: colors.dangerLight,
  },
  reminderCardDragging: {
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
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
  snoozedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 3,
    marginTop: 4,
  },
  snoozedPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
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
