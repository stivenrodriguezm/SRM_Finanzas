import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme, Theme } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { PreferencesProvider, usePreferences } from './src/context/PreferencesContext';
import { AuthProvider } from './src/context/AuthContext';

function Root() {
  const { colors, isDark } = usePreferences();

  const navigationTheme: Theme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.card,
      text: colors.textPrimary,
      border: colors.border,
      primary: colors.primary,
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      <AppNavigator />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PreferencesProvider>
        <Root />
      </PreferencesProvider>
    </AuthProvider>
  );
}
