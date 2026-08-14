import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightColors, darkColors } from '../theme/theme';

/**
 * PreferencesContext
 * Almacena todas las preferencias de personalización del usuario, guardadas
 * localmente en el dispositivo (no se sincronizan con el backend):
 *  - Tema (light | dark | adaptive)
 *  - Privacidad inicial por sección
 *  - Notificaciones de recordatorios
 *  - Bloqueo con Face ID / Touch ID al abrir la app
 */

type AppTheme = 'light' | 'dark' | 'adaptive';

interface PrivacyPreferences {
  home: boolean;
  transactions: boolean;
  debts: boolean;
  reminders: boolean;
  receivables: boolean;
}

export interface Preferences {
  theme: AppTheme;
  privacy: PrivacyPreferences;
  remindersNotifications: boolean;
  biometricLockEnabled: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'light',
  privacy: {
    home: false,
    transactions: false,
    debts: false,
    reminders: false,
    receivables: false,
  },
  remindersNotifications: true,
  biometricLockEnabled: false,
};

type Colors = typeof lightColors;

interface PreferencesContextValue {
  preferences: Preferences;
  colors: Colors;
  isDark: boolean;
  updatePreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  updatePrivacy: (section: keyof PrivacyPreferences, value: boolean) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [systemTheme, setSystemTheme] = useState<ColorSchemeName>(Appearance.getColorScheme());
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

  const getColors = (): Colors => {
    if (preferences.theme === 'adaptive') {
      return systemTheme === 'dark' ? darkColors : lightColors;
    }
    return preferences.theme === 'dark' ? darkColors : lightColors;
  };

  const colors = getColors();
  const isDark = preferences.theme === 'dark' || (preferences.theme === 'adaptive' && systemTheme === 'dark');

  const updatePreference = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  const updatePrivacy = (section: keyof PrivacyPreferences, value: boolean) => {
    setPreferences((prev) => ({
      ...prev,
      privacy: { ...prev.privacy, [section]: value },
    }));
  };

  return (
    <PreferencesContext.Provider value={{ preferences, colors, isDark, updatePreference, updatePrivacy }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used inside PreferencesProvider');
  return ctx;
}
