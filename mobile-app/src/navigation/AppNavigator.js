import React from 'react';
import { View, Text, Platform, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';

import HomeScreen from '../screens/HomeScreen';
import TransactionsScreen from '../screens/TransactionsScreen';
import DebtsScreen from '../screens/DebtsScreen';
import RemindersScreen from '../screens/RemindersScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AddRecordScreen from '../screens/AddRecordScreen';
import AddReminderScreen from '../screens/AddReminderScreen';
import ReminderDetailScreen from '../screens/ReminderDetailScreen';
import DebtDetailScreen from '../screens/DebtDetailScreen';
import AddDebtScreen from '../screens/AddDebtScreen';
import ReceivablesScreen from '../screens/ReceivablesScreen';
import PreferencesScreen from '../screens/PreferencesScreen';
import LandingScreen from '../screens/Auth/LandingScreen';
import RegisterScreen from '../screens/Auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/Auth/ForgotPasswordScreen';
import AccountDetailScreen from '../screens/AccountDetailScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

/** Opciones de header reutilizables */
const sharedHeaderOptions = (title, nav) => ({
  headerShown: true,
  title,
  headerStyle: { backgroundColor: '#F5F7FA' },
  headerShadowVisible: false,
  headerTitleStyle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  headerTintColor: '#111827',
  headerLeft: nav
    ? () => (
        <TouchableOpacity
          onPress={() => nav.goBack()}
          style={{ paddingRight: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
      )
    : undefined,
});

/** TabBar premium */
function TabRoot() {
  const { colors, isDark } = usePreferences();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            Balance:        focused ? 'home'     : 'home-outline',
            Transacciones:  focused ? 'list'     : 'list-outline',
            Deudas:         focused ? 'card'     : 'card-outline',
            Recordatorios:  focused ? 'calendar' : 'calendar-outline',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: isDark ? 0.3 : 0.08,
          shadowRadius: 16,
          elevation: 20,
          height: Platform.OS === 'ios' ? 80 : 64,
          paddingBottom: Platform.OS === 'ios' ? 24 : 10,
          paddingTop: 10,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        tabBarItemStyle: { paddingVertical: 4 },
      })}
    >
      <Tab.Screen name="Balance"       component={HomeScreen}        />
      <Tab.Screen name="Transacciones" component={TransactionsScreen} />
      <Tab.Screen name="Deudas"        component={DebtsScreen}        />
      <Tab.Screen name="Recordatorios" component={RemindersScreen}    />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { isAuthenticated } = useAuth();
  const { colors } = usePreferences();

  if (!isAuthenticated) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Landing" component={LandingScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      </Stack.Navigator>
    );
  }

  const commonHeaderStyle = {
    headerStyle: { backgroundColor: colors.background },
    headerShadowVisible: false,
    headerTitleStyle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary },
    headerTintColor: colors.textPrimary,
  };

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="TabRoot"
        component={TabRoot}
        options={{ headerShown: false }}
      />

      {/* ── Modales y stacks ── */}
      <Stack.Screen
        name="AddRecord"
        component={AddRecordScreen}
        options={{ title: 'Nuevo Registro', presentation: 'modal', ...commonHeaderStyle }}
      />
      <Stack.Screen
        name="AddReminder"
        component={AddReminderScreen}
        options={({ route }) => ({
          title: route.params?.reminder ? 'Modificar Recordatorio' : 'Nuevo Recordatorio',
          presentation: 'modal',
          ...commonHeaderStyle
        })}
      />
      <Stack.Screen
        name="ReminderDetail"
        component={ReminderDetailScreen}
        options={{ title: 'Detalle', ...commonHeaderStyle }}
      />
      
      {/* Tarea 3: Perfil como Stack screen */}
      <Stack.Screen
        name="Perfil"
        component={ProfileScreen}
        options={({ navigation: nav }) => ({
          headerShown: true,
          title: 'Mi Perfil',
          ...commonHeaderStyle,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => nav.goBack()}
              style={{ paddingRight: 8 }}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          ),
        })}
      />

      {/* Detalle de Deuda — header premium */}
      <Stack.Screen
        name="DebtDetail"
        component={DebtDetailScreen}
        options={({ navigation: nav, route }) => ({
          headerShown: true,
          title: route.params?.title || 'Detalle de Deuda',
          ...commonHeaderStyle,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => nav.goBack()}
              style={{ paddingRight: 8 }}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          ),
        })}
      />

      {/* Nueva Deuda / Modificar */}
      <Stack.Screen
        name="AddDebt"
        component={AddDebtScreen}
        options={({ route }) => ({
          title: route.params?.isModifyMode ? 'Modificar Detalles' : 'Nueva Deuda / Préstamo',
          presentation: 'modal',
          ...commonHeaderStyle
        })}
      />

      {/* Tarea 2: header "Me Deben" premium — sin texto azul */}
      <Stack.Screen
        name="Receivables"
        component={ReceivablesScreen}
        options={({ navigation: nav }) => ({
          headerShown: true,
          title: 'Me Deben',
          ...commonHeaderStyle,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => nav.goBack()}
              style={{ paddingRight: 8 }}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          ),
        })}
      />

      {/* Preferencias — accedida desde ProfileScreen */}
      <Stack.Screen
        name="Preferences"
        component={PreferencesScreen}
        options={({ navigation: nav }) => ({
          headerShown: true,
          title: 'Preferencias',
          ...commonHeaderStyle,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => nav.goBack()}
              style={{ paddingRight: 8 }}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          ),
        })}
      />
      {/* Detalle de Cuenta */}
      <Stack.Screen
        name="AccountDetail"
        component={AccountDetailScreen}
        options={({ route }) => ({
          headerShown: true,
          title: 'Detalle de Cuenta',
          ...commonHeaderStyle
        })}
      />
    </Stack.Navigator>
  );
}
