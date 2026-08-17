import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BarChart, PieChart, LineChart } from 'react-native-chart-kit';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { usePreferences } from '../context/PreferencesContext';
import { getAiChat, sendAiChatMessage, deleteAiChat } from '../services/aiChat';
import { getErrorMessage } from '../utils/apiError';
import { AiChat, AiChatMessage, AiChart } from '../types/models';
import { RootStackParamList, AppNavigation } from '../navigation/types';

type Colors = ReturnType<typeof usePreferences>['colors'];

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 96;
const TYPING = '__typing__' as const;
type ListItem = AiChatMessage | typeof TYPING;

export default function AiChatScreen() {
  const { colors } = usePreferences();
  const styles = getStyles(colors);
  const navigation = useNavigation<AppNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, 'AiChat'>>();
  const { chatId } = route.params;

  const [chat, setChat] = useState<AiChat | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const listRef = useRef<FlatList<ListItem>>(null);

  const handleDeleteChat = useCallback(() => {
    Alert.alert('Eliminar conversación', 'Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAiChat(chatId);
            navigation.goBack();
          } catch (error) {
            Alert.alert('Error', getErrorMessage(error, 'No se pudo eliminar la conversación.'));
          }
        },
      },
    ]);
  }, [chatId, navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={handleDeleteChat}
          style={styles.headerDeleteBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash-outline" size={20} color={colors.danger} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, handleDeleteChat, colors.danger]);

  useEffect(() => {
    (async () => {
      try {
        const data = await getAiChat(chatId);
        setChat(data);
        navigation.setOptions({ title: data.title });
      } catch (error) {
        Alert.alert('Error', getErrorMessage(error, 'No se pudo cargar la conversación.'));
        navigation.goBack();
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  useEffect(() => {
    if (chat?.messages.length || isSending) {
      const timer = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
      return () => clearTimeout(timer);
    }
  }, [chat?.messages.length, isSending]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !chat || isSending) return;

    const optimisticMessage: AiChatMessage = { role: 'user', text, createdAt: new Date().toISOString() };
    setChat({ ...chat, messages: [...chat.messages, optimisticMessage] });
    setInputText('');
    setIsSending(true);
    try {
      const updated = await sendAiChatMessage(chat._id, text);
      setChat(updated);
    } catch (error) {
      setChat((prev) => (prev ? { ...prev, messages: prev.messages.slice(0, -1) } : prev));
      setInputText(text);
      Alert.alert('Error', getErrorMessage(error, 'No se pudo enviar el mensaje. Intenta de nuevo.'));
    } finally {
      setIsSending(false);
    }
  };

  const chartConfig = {
    backgroundGradientFrom: colors.cardElevated || colors.card,
    backgroundGradientTo: colors.cardElevated || colors.card,
    decimalPlaces: 0,
    color: (opacity = 1) => colors.textSecondary,
    labelColor: (opacity = 1) => colors.textSecondary,
    barPercentage: 0.6,
    propsForBackgroundLines: { stroke: colors.border },
  };

  const AI_CHART_COLORS = [colors.primary, colors.success, colors.danger, colors.info, colors.purple, colors.warning, colors.orange];

  const renderAiChart = (chart: AiChart, index: number) => {
    const key = `chart-${index}`;

    if (chart.type === 'pie') {
      const pieItems = chart.labels
        .map((label, i) => ({ name: label, value: chart.values[i] ?? 0 }))
        .filter((item) => item.value > 0);
      if (pieItems.length === 0) return null;
      return (
        <PieChart
          key={key}
          data={pieItems.map((item, i) => ({
            name: item.name,
            value: item.value,
            color: AI_CHART_COLORS[i % AI_CHART_COLORS.length],
            legendFontColor: colors.textSecondary,
            legendFontSize: 11,
          }))}
          width={CHART_WIDTH}
          height={180}
          chartConfig={chartConfig}
          accessor="value"
          backgroundColor="transparent"
          paddingLeft="8"
          absolute
        />
      );
    }

    if (chart.type === 'line') {
      return (
        <LineChart
          key={key}
          data={{ labels: chart.labels, datasets: [{ data: chart.values }] }}
          width={CHART_WIDTH}
          height={180}
          bezier
          chartConfig={{ ...chartConfig, color: (opacity = 1) => colors.primary }}
          style={styles.chartStyle}
        />
      );
    }

    return (
      <BarChart
        key={key}
        data={{
          labels: chart.labels,
          datasets: [{ data: chart.values, colors: chart.values.map((_, i) => (opacity = 1) => AI_CHART_COLORS[i % AI_CHART_COLORS.length]) }],
        }}
        width={CHART_WIDTH}
        height={200}
        yAxisLabel=""
        yAxisSuffix=""
        fromZero={false}
        withCustomBarColorFromData
        flatColor
        showValuesOnTopOfBars
        chartConfig={chartConfig}
        style={styles.chartStyle}
      />
    );
  };

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item === TYPING) {
      return (
        <View style={[styles.messageRow, styles.messageRowModel]}>
          <View style={styles.avatar}>
            <Ionicons name="sparkles" size={13} color={colors.primary} />
          </View>
          <View style={[styles.bubble, styles.bubbleModel, styles.typingBubble]}>
            <ActivityIndicator size="small" color={colors.textSecondary} />
            <Text style={styles.typingText}>Pensando…</Text>
          </View>
        </View>
      );
    }

    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowModel]}>
        {!isUser && (
          <View style={styles.avatar}>
            <Ionicons name="sparkles" size={13} color={colors.primary} />
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleModel]}>
          <Text style={isUser ? styles.bubbleTextUser : styles.bubbleTextModel}>{item.text}</Text>
          {item.charts?.map((chart, i) => (
            <View key={i} style={styles.chartWrapper}>
              <Text style={styles.chartTitle}>{chart.title}</Text>
              {chart.description ? <Text style={styles.chartDescription}>{chart.description}</Text> : null}
              {renderAiChart(chart, i)}
            </View>
          ))}
        </View>
      </View>
    );
  };

  if (isLoading || !chat) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Preparando tu análisis…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const data: ListItem[] = isSending ? [...chat.messages, TYPING] : chat.messages;

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <FlatList
          ref={listRef}
          data={data}
          keyExtractor={(_, index) => `msg-${index}`}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            placeholder="Preguntá algo sobre tus finanzas…"
            placeholderTextColor={colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            editable={!isSending}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || isSending) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || isSending}
          >
            <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors: Colors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: colors.textSecondary, fontSize: 14 },
  listContent: { padding: 16, paddingBottom: 24 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 14, maxWidth: '100%' },
  messageRowUser: { justifyContent: 'flex-end' },
  messageRowModel: { justifyContent: 'flex-start' },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.infoLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  bubbleUser: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleModel: {
    backgroundColor: colors.card,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleTextUser: { fontSize: 15, lineHeight: 21, color: colors.primaryText },
  bubbleTextModel: { fontSize: 15, lineHeight: 21, color: colors.textPrimary },
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typingText: { fontSize: 14, color: colors.textSecondary },
  chartWrapper: { marginTop: 14 },
  chartTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  chartDescription: { fontSize: 11, color: colors.textSecondary, marginBottom: 8 },
  chartStyle: { borderRadius: 12, marginLeft: -24 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    gap: 10,
  },
  textInput: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.textPrimary,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: { opacity: 0.4 },
  headerDeleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
