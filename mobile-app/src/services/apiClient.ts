import axios from 'axios';
import { API_URL } from '../config/api';

let currentToken: string | null = null;

/** AuthContext llama esto cada vez que cambia el token (login, register, logout, carga inicial). */
export const setAuthToken = (token: string | null): void => {
  currentToken = token;
};

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  if (currentToken) {
    config.headers.Authorization = `Bearer ${currentToken}`;
  }
  return config;
});

export default apiClient;
