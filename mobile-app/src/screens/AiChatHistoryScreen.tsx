import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { usePreferences } from '../context/PreferencesContext';
import { listAiChats, createAiChat, deleteAiChat } from '../services/aiChat';
import { getErrorMessage } from '../utils/apiError';
import { AiChatSummary } from '../types/models';
import SkeletonLoader from '../components/SkeletonLoader';
import { AppNavigation } from '../navigation/types';

type Colors = ReturnType<typeof usePreferences>['colors'];

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function AiChatHistoryScreen() {
  const { colors } = usePreferences();
  const styles = getStyles(colors);
  const navigation = useNavigation<AppNavigation>();

  const [chats, setChats] = useState<AiChatSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const fetchChats = useCallback(async () => {
    try {
      const data = await listAiChats();
      setChats(data);
    } catch (error) {
      console.log('Error fetching AI chats', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchChats();
    }, [fetchChats])
  );

  const handleNewChat = async () => {
    setIsCreating(true);
    try {
      const chat = await createAiChat();
      navigation.navigate('AiChat', { chatId: chat._id });
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error, 'No se pudo iniciar el análisis con IA.'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = (chat: AiChatSummary) => {
    Alert.alert('Eliminar conversación', `¿Eliminar "${chat.title}"? Esta acción no se puede deshacer.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAiChat(chat._id);
            setChats((prev) => prev.filter((c) => c._id !== chat._id));
          } catch (error) {
            Alert.alert('Error', getErrorMessage(error, 'No se pudo eliminar la conversación.'));
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <SkeletonLoader type="list" />
        ) : chats.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="sparkles-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>Todavía no tienes conversaciones con la IA</Text>
            <Text style={styles.emptySubText}>Iniciá una para un análisis personalizado de tus finanzas.</Text>
          </View>
        ) : (
          chats.map((chat) => (
            <TouchableOpacity
              key={chat._id}
              style={styles.chatCard}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('AiChat', { chatId: chat._id })}
            >
              <View style={styles.chatIcon}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.chatTitle} numberOfLines={1}>{chat.title}</Text>
                <Text style={styles.chatDate}>{formatDate(chat.updatedAt)}</Text>
              </View>
              <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(chat)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      <View style={styles.floatingButtonContainer}>
        <TouchableOpacity style={styles.addButton} onPress={handleNewChat} disabled={isCreating}>
          {isCreating ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="add" size={24} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Nuevo análisis</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors: Colors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { padding: 20, paddingBottom: 40 },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyText: { marginTop: 16, fontSize: 16, fontWeight: '600', color: colors.textSecondary, textAlign: 'center' },
  emptySubText: { marginTop: 8, fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 20, lineHeight: 18 },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  chatIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.infoLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  chatTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  chatDate: { fontSize: 12, color: colors.textSecondary },
  deleteButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.dangerLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  floatingButtonContainer: { position: 'absolute', bottom: 20, left: 20, right: 20 },
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
  addButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginLeft: 8 },
});
