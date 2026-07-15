import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import Toast, { BaseToast, ErrorToast } from 'react-native-toast-message';
import { Camera, Map, ClipboardList, Shield, Sun, Moon, Laptop, Activity } from 'lucide-react-native';
import { TouchableOpacity } from 'react-native';

import CaptureScreen from './src/screens/CaptureScreen';
import MapScreen from './src/screens/MapScreen';
import SubmissionsScreen from './src/screens/SubmissionsScreen';
import AdminScreen from './src/screens/AdminScreen';
import RideModeScreen from './src/screens/RideModeScreen';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';

const Tab = createBottomTabNavigator();

const ThemeToggle = () => {
  const { themeMode, toggleTheme, theme } = useTheme();
  
  const getIcon = () => {
    if (themeMode === 'light') return <Sun size={20} color={theme.colors.neutral[800]} accessibilityLabel="Sun icon" />;
    if (themeMode === 'dark') return <Moon size={20} color={theme.colors.neutral[800]} accessibilityLabel="Moon icon" />;
    return <Laptop size={20} color={theme.colors.neutral[800]} accessibilityLabel="Laptop icon" />;
  };

  return (
    <TouchableOpacity
      onPress={toggleTheme}
      accessibilityRole="button"
      accessibilityLabel={`Current theme is ${themeMode}. Tap to change.`}
      accessibilityHint="Toggles between Light, Dark, and System theme preferences"
      style={{
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
      }}
    >
      {getIcon()}
    </TouchableOpacity>
  );
};

function AppContent() {
  const { theme, isDark } = useTheme();

  const toastConfig = {
    success: (props: any) => (
      <BaseToast
        {...props}
        style={{
          borderLeftColor: theme.colors.status.approved,
          backgroundColor: theme.colors.white,
          borderRadius: theme.radius.md,
          height: 60,
          ...theme.shadows.medium,
        }}
        contentContainerStyle={{ paddingHorizontal: theme.spacing[16] }}
        text1Style={{
          fontSize: theme.typography.fontSizes.sm,
          fontWeight: theme.typography.fontWeights.bold,
          color: theme.colors.neutral[900],
        }}
        text2Style={{
          fontSize: theme.typography.fontSizes.xs,
          color: theme.colors.neutral[600],
        }}
      />
    ),
    error: (props: any) => (
      <ErrorToast
        {...props}
        style={{
          borderLeftColor: theme.colors.status.rejected,
          backgroundColor: theme.colors.white,
          borderRadius: theme.radius.md,
          height: 60,
          ...theme.shadows.medium,
        }}
        contentContainerStyle={{ paddingHorizontal: theme.spacing[16] }}
        text1Style={{
          fontSize: theme.typography.fontSizes.sm,
          fontWeight: theme.typography.fontWeights.bold,
          color: theme.colors.neutral[900],
        }}
        text2Style={{
          fontSize: theme.typography.fontSizes.xs,
          color: theme.colors.neutral[600],
        }}
      />
    ),
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <StatusBar style={isDark ? "light" : "dark"} />
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: true,
            headerStyle: {
              backgroundColor: theme.colors.white,
              elevation: 2,
              shadowColor: '#000',
              shadowOpacity: 0.05,
              shadowOffset: { width: 0, height: 1 },
              shadowRadius: 2,
            },
            headerTitleStyle: {
              fontWeight: theme.typography.fontWeights.bold,
              fontSize: theme.typography.fontSizes.lg,
              color: theme.colors.neutral[900],
            },
            tabBarActiveTintColor: theme.colors.primary,
            tabBarInactiveTintColor: theme.colors.neutral[500],
            tabBarStyle: {
              backgroundColor: theme.colors.white,
              borderTopColor: theme.colors.neutral[200],
              height: 60,
              paddingBottom: 8,
              paddingTop: 8,
            },
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: theme.typography.fontWeights.semibold,
            },
            headerRight: () => <ThemeToggle />,
            tabBarIcon: ({ color, size }) => {
              if (route.name === 'Capture') {
                return <Camera size={size} color={color} accessibilityLabel="Camera tab icon" />;
              } else if (route.name === 'Map') {
                return <Map size={size} color={color} accessibilityLabel="Map tab icon" />;
              } else if (route.name === 'Ride Mode') {
                return <Activity size={size} color={color} accessibilityLabel="Ride Mode tab icon" />;
              } else if (route.name === 'My submissions') {
                return <ClipboardList size={size} color={color} accessibilityLabel="Submissions list tab icon" />;
              } else if (route.name === 'Admin') {
                return <Shield size={size} color={color} accessibilityLabel="Admin Shield tab icon" />;
              }
              return null;
            },
          })}
        >
          <Tab.Screen name="Capture" component={CaptureScreen} />
          <Tab.Screen name="Map" component={MapScreen} />
          <Tab.Screen name="Ride Mode" component={RideModeScreen} />
          <Tab.Screen name="My submissions" component={SubmissionsScreen} />
          {process.env.EXPO_PUBLIC_ENABLE_ADMIN === 'true' ? (
            <Tab.Screen name="Admin" component={AdminScreen} />
          ) : null}
        </Tab.Navigator>
      </NavigationContainer>
      <Toast config={toastConfig} />
    </GestureHandlerRootView>
  );
}

export default function App() {
  useEffect(() => {
    // Hide splash screen when the JS bundle and app tree are ready
    const hideSplash = async () => {
      await new Promise((resolve) => setTimeout(resolve, 500)); // subtle delay to avoid layout jump
      await SplashScreen.hideAsync().catch(() => {});
    };
    hideSplash();
  }, []);

  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
