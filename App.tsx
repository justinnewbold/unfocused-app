import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Screens
import TasksScreen from './screens/TasksScreen';
import FocusScreen from './screens/FocusScreen';
import ChatScreen from './screens/ChatScreen';
import AchievementsScreen from './screens/AchievementsScreen';
import AnalyticsScreen from './screens/AnalyticsScreen';
import SettingsScreen from './screens/SettingsScreen';

// Context & State Management
import { TaskProvider } from './context/TaskContext';
import { AchievementProvider } from './context/AchievementContext';
import { FocusProvider } from './context/FocusContext';
import { ChatProvider } from './context/ChatContext';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const COLORS = {
  primary: '#6366f1',
  secondary: '#8b5cf6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  background: '#0f172a',
  surface: '#1e293b',
  text: '#f1f5f9',
  textSecondary: '#cbd5e1',
};

function TasksStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.surface,
        },
        headerTintColor: COLORS.text,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        cardStyle: {
          backgroundColor: COLORS.background,
        },
      }}
    >
      <Stack.Screen
        name="TasksList"
        component={TasksScreen}
        options={{
          title: 'Tasks',
          headerShown: true,
        }}
      />
    </Stack.Navigator>
  );
}

function FocusStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.surface,
        },
        headerTintColor: COLORS.text,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        cardStyle: {
          backgroundColor: COLORS.background,
        },
      }}
    >
      <Stack.Screen
        name="FocusMode"
        component={FocusScreen}
        options={{
          title: 'Focus Mode',
          headerShown: true,
        }}
      />
    </Stack.Navigator>
  );
}

function ChatStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.surface,
        },
        headerTintColor: COLORS.text,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        cardStyle: {
          backgroundColor: COLORS.background,
        },
      }}
    >
      <Stack.Screen
        name="ChatBot"
        component={ChatScreen}
        options={{
          title: 'AI Assistant',
          headerShown: true,
        }}
      />
    </Stack.Navigator>
  );
}

function AchievementsStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.surface,
        },
        headerTintColor: COLORS.text,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        cardStyle: {
          backgroundColor: COLORS.background,
        },
      }}
    >
      <Stack.Screen
        name="AchievementsList"
        component={AchievementsScreen}
        options={{
          title: 'Achievements',
          headerShown: true,
        }}
      />
    </Stack.Navigator>
  );
}

function AnalyticsStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.surface,
        },
        headerTintColor: COLORS.text,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        cardStyle: {
          backgroundColor: COLORS.background,
        },
      }}
    >
      <Stack.Screen
        name="AnalyticsDashboard"
        component={AnalyticsScreen}
        options={{
          title: 'Analytics',
          headerShown: true,
        }}
      />
    </Stack.Navigator>
  );
}

function SettingsStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.surface,
        },
        headerTintColor: COLORS.text,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        cardStyle: {
          backgroundColor: COLORS.background,
        },
      }}
    >
      <Stack.Screen
        name="SettingsScreen"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          headerShown: true,
        }}
      />
    </Stack.Navigator>
  );
}

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.primary,
          borderTopWidth: 1,
          paddingBottom: 5,
          paddingTop: 5,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'TasksTab') {
            iconName = focused ? 'checkmark-done' : 'checkmark-done-outline';
          } else if (route.name === 'FocusTab') {
            iconName = focused ? 'timer' : 'timer-outline';
          } else if (route.name === 'ChatTab') {
            iconName = focused ? 'chatbubble' : 'chatbubble-outline';
          } else if (route.name === 'AchievementsTab') {
            iconName = focused ? 'trophy' : 'trophy-outline';
          } else if (route.name === 'AnalyticsTab') {
            iconName = focused ? 'bar-chart' : 'bar-chart-outline';
          } else if (route.name === 'SettingsTab') {
            iconName = focused ? 'settings' : 'settings-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="TasksTab"
        component={TasksStackNavigator}
        options={{
          title: 'Tasks',
        }}
      />
      <Tab.Screen
        name="FocusTab"
        component={FocusStackNavigator}
        options={{
          title: 'Focus',
        }}
      />
      <Tab.Screen
        name="ChatTab"
        component={ChatStackNavigator}
        options={{
          title: 'Chat',
        }}
      />
      <Tab.Screen
        name="AchievementsTab"
        component={AchievementsStackNavigator}
        options={{
          title: 'Achievements',
        }}
      />
      <Tab.Screen
        name="AnalyticsTab"
        component={AnalyticsStackNavigator}
        options={{
          title: 'Analytics',
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsStackNavigator}
        options={{
          title: 'Settings',
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Initialize app
    const initializeApp = async () => {
      try {
        // Load persisted data, initialize services, etc.
        setIsReady(true);
      } catch (error) {
        console.error('Failed to initialize app:', error);
        setIsReady(true);
      }
    };

    initializeApp();
  }, []);

  if (!isReady) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading UnFocused...</Text>
      </View>
    );
  }

  return (
    <TaskProvider>
      <AchievementProvider>
        <FocusProvider>
          <ChatProvider>
            <NavigationContainer>
              <TabNavigator />
            </NavigationContainer>
          </ChatProvider>
        </FocusProvider>
      </AchievementProvider>
    </TaskProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.text,
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
  },
});