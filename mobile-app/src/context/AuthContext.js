import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Alert } from 'react-native';
import { API_URL } from '../config/api';

const AuthContext = createContext();

// Timeout global: 8 segundos para evitar loaders eternos
axios.defaults.timeout = 8000;

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkToken();
  }, []);

  const checkToken = async () => {
    try {
      // Carga en paralelo para mayor velocidad
      const [storedToken, storedUser] = await Promise.all([
        AsyncStorage.getItem('userToken'),
        AsyncStorage.getItem('userInfo'),
      ]);
      if (storedToken) {
        setToken(storedToken);
        if (storedUser) setUser(JSON.parse(storedUser));
        setIsAuthenticated(true);
      }
    } catch (e) {
      console.log('Error leyendo token', e);
    }
    setIsLoading(false);
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, { email, password });
      if (response.data.token) {
        await AsyncStorage.setItem('userToken', response.data.token);
        await AsyncStorage.setItem('userInfo', JSON.stringify(response.data));
        setToken(response.data.token);
        setUser(response.data);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.log('Login error', error);
      Alert.alert('Error', error.response?.data?.message || 'Error al iniciar sesión');
      throw error;
    }
  };

  const register = async (name, username, email, password) => {
    try {
      const response = await axios.post(`${API_URL}/auth/register`, { name, username, email, password });
      if (response.data.token) {
        await AsyncStorage.setItem('userToken', response.data.token);
        await AsyncStorage.setItem('userInfo', JSON.stringify(response.data));
        setToken(response.data.token);
        setUser(response.data);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.log('Register error', error);
      Alert.alert('Error', error.response?.data?.message || 'Error al registrar');
      throw error;
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem('userToken');
    await AsyncStorage.removeItem('userInfo');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
  };

  const updateUserLocal = async (updatedUser) => {
    const newUser = { ...user, ...updatedUser };
    setUser(newUser);
    await AsyncStorage.setItem('userInfo', JSON.stringify(newUser));
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, token, isLoading, login, register, logout, updateUserLocal }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
}
