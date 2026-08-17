import apiClient from './apiClient';
import { AiChat, AiChatSummary } from '../types/models';

/** La generación con Gemini puede tardar más que el timeout default de apiClient (15s). */
const AI_TIMEOUT = 45000;

export const listAiChats = async (): Promise<AiChatSummary[]> => {
  const { data } = await apiClient.get<AiChatSummary[]>('/analysis/chats');
  return data;
};

export const createAiChat = async (): Promise<AiChat> => {
  const { data } = await apiClient.post<AiChat>('/analysis/chats', {}, { timeout: AI_TIMEOUT });
  return data;
};

export const getAiChat = async (chatId: string): Promise<AiChat> => {
  const { data } = await apiClient.get<AiChat>(`/analysis/chats/${chatId}`);
  return data;
};

export const sendAiChatMessage = async (chatId: string, text: string): Promise<AiChat> => {
  const { data } = await apiClient.post<AiChat>(`/analysis/chats/${chatId}/messages`, { text }, { timeout: AI_TIMEOUT });
  return data;
};

export const deleteAiChat = async (chatId: string): Promise<void> => {
  await apiClient.delete(`/analysis/chats/${chatId}`);
};
