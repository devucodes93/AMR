import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from '../../types/navigation';
import { AlertsScreen } from '../../screens/AlertsScreen';
import { CommunityFeedScreen } from '../../screens/CommunityFeedScreen';
import { DashboardScreen } from '../../screens/DashboardScreen';
import { LiveTrackerScreen } from '../../screens/LiveTrackerScreen';
import { colors } from '../../constants/colors';
import { useI18n } from '../../i18n/LanguageContext';
import Ionicons from 'react-native-vector-icons/Ionicons';

const Tab = createBottomTabNavigator<MainTabParamList>();

type AppTabsProps = {
  onLogout?: () => void;
};

export function AppTabs({ onLogout }: AppTabsProps) {
  const { t } = useI18n();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarStyle: { height: 62, paddingBottom: 8, paddingTop: 6 },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        children={() => <DashboardScreen onLogout={onLogout} />}
        options={{
          title: t('tabDashboard'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Map"
        component={LiveTrackerScreen}
        options={{
          title: t('tabMap') || t('tabTracker'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="location-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Community"
        component={CommunityFeedScreen}
        options={{
          title: t('tabCommunity'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Alerts"
        component={AlertsScreen}
        options={{
          title: t('tabAlerts'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="warning-outline" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
