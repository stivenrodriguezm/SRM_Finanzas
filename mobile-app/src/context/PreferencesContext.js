import React, { createContext, useContext, useState, useEffect } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightColors, darkColors } from '../theme/theme';

/**
 * PreferencesContext
 * Almacena todas las preferencias de personalización del usuario:
 *  - Tema (light | dark | adaptive)
 *  - Privacidad inicial por sección
 *  - Moneda preferida
 *  - Notificaciones
 */

const PreferencesContext = createContext(null);

export const DEFAULT_PREFERENCES = {
  // Tema de la app
  theme: 'light', // 'light' | 'dark' | 'adaptive'

  // Privacidad inicial por pantalla (¿empiezan ocultos los valores?)
  privacy: {
    home:         false,
    transactions: false,
    debts:        false,
    reminders:    false,
    receivables:  false,
  },

  // Notificaciones de recordatorios
  remindersNotifications: true,
};

export function PreferencesProvider({ children }) {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [systemTheme, setSystemTheme] = useState(Appearance.getColorScheme());
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const saved = await AsyncStorage.getItem('appPreferences');
        if (saved) {
          setPreferences({ ...DEFAULT_PREFERENCES, ...JSON.parse(saved) });
        }
      } catch (error) {
        console.log('Error loading preferences', error);
      } finally {
        setIsLoaded(true);
      }
    };
    loadPreferences();
  }, []);

  useEffect(() => {
    if (isLoaded) {
      AsyncStorage.setItem('appPreferences', JSON.stringify(preferences)).catch((e) =>
        console.log('Error saving preferences', e)
      );
    }
  }, [preferences, isLoaded]);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemTheme(colorScheme);
    });
    return () => subscription.remove();
  }, []);

  const getColors = () => {
    if (preferences.theme === 'adaptive') {
      return systemTheme === 'dark' ? darkColors : lightColors;
    }
    return preferences.theme === 'dark' ? darkColors : lightColors;
  };

  const colors = getColors();
  const isDark = preferences.theme === 'dark' || (preferences.theme === 'adaptive' && systemTheme === 'dark');

  const updatePreference = (key, value) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  const updatePrivacy = (section, value) => {
    setPreferences((prev) => ({
      ...prev,
      privacy: { ...prev.privacy, [section]: value },
    }));
  };

  return (
    <PreferencesContext.Provider value={{
        preferences,
        colors,
        isDark,
        updatePreference,
        updatePrivacy,
      }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used inside PreferencesProvider');
  return ctx;
}
