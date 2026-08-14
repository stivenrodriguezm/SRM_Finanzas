import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import apiClient, { setAuthToken } from '../services/apiClient';
import { getErrorMessage } from '../utils/apiError';
import { AuthResponse, AuthUser } from '../types/models';

interface AuthContextValue {
  isAuthenticated: boolean;
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserLocal: (updatedUser: Partial<AuthUser>) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkToken = async () => {
    try {
      const [storedToken, storedUser] = await Promise.all([
        AsyncStorage.getItem('userToken'),
        AsyncStorage.getItem('userInfo'),
      ]);
      if (storedToken) {
        setToken(storedToken);
        setAuthToken(storedToken);
        if (storedUser) setUser(JSON.parse(storedUser));
        setIsAuthenticated(true);
      }
    } catch (e) {
      console.log('Error leyendo token', e);
    }
    setIsLoading(false);
  };

  const persistSession = async (data: AuthResponse) => {
    await AsyncStorage.setItem('userToken', data.token);
    await AsyncStorage.setItem('userInfo', JSON.stringify(data));
    setToken(data.token);
    setAuthToken(data.token);
    setUser(data);
    setIsAuthenticated(true);
  };

  const login = async (email: string, password: string) => {
    try {
      const { data } = await apiClient.post<AuthResponse>('/auth/login', { email, password });
      await persistSession(data);
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error, 'Error al iniciar sesión'));
      throw error;
    }
  };

  const register = async (name: string, username: string, email: string, password: string) => {
    try {
      const { data } = await apiClient.post<AuthResponse>('/auth/register', { name, username, email, password });
      await persistSession(data);
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error, 'Error al registrar'));
      throw error;
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem('userToken');
    await AsyncStorage.removeItem('userInfo');
    setAuthToken(null);
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
  };

  const updateUserLocal = async (updatedUser: Partial<AuthUser>) => {
    setUser((prev) => {
      const merged = { ...(prev as AuthUser), ...updatedUser };
      AsyncStorage.setItem('userInfo', JSON.stringify(merged)).catch(() => {});
      return merged;
    });
  };

  const forgotPassword = async (email: string) => {
    try {
      await apiClient.post('/auth/forgot-password', { email });
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error));
      throw error;
    }
  };

  const resetPassword = async (email: string, code: string, newPassword: string) => {
    try {
      await apiClient.post('/auth/reset-password', { email, code, newPassword });
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error));
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        updateUserLocal,
        forgotPassword,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
}
