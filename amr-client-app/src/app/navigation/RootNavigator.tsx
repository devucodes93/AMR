import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../../constants/colors';
import { RootStackParamList } from '../../types/navigation';
import { AuthNavigator } from './AuthNavigator';
import { AppTabs } from './AppTabs';
import { ProfileScreen } from '../../screens/ProfileScreen';
import { SettingsScreen } from '../../screens/SettingsScreen';
import { PrivacyScreen } from '../../screens/PrivacyScreen';
import { HelpSupportScreen } from '../../screens/HelpSupportScreen';
import {
  clearSavedAuthSession,
  getSavedAuthSession,
} from '../../services/sessionService';

const Stack = createNativeStackNavigator<RootStackParamList>();

const appTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
  },
};

export function RootNavigator() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    let active = true;

    const restoreSession = async () => {
      try {
        const session = await getSavedAuthSession();
        if (!active) {
          return;
        }

        if (session?.session?.access_token) {
          setIsAuthenticated(true);
        }
      } finally {
        if (active) {
          setIsBootstrapping(false);
        }
      }
    };

    restoreSession().catch(() => {
      if (active) {
        setIsBootstrapping(false);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const handleLogout = useCallback(() => {
    clearSavedAuthSession().catch(() => {
      // keep logout flow resilient if storage cleanup fails
    });
    setIsAuthenticated(false);
  }, []);

  if (isBootstrapping) {
    return (
      <View style={styles.bootstrapContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={appTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Auth">
            {() => (
              <AuthNavigator onAuthenticated={() => setIsAuthenticated(true)} />
            )}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Group screenOptions={{ headerShown: false }}>
              <Stack.Screen name="MainTabs">
                {() => <AppTabs onLogout={handleLogout} />}
              </Stack.Screen>
            </Stack.Group>
            <Stack.Group
              screenOptions={{ presentation: 'modal', headerShown: false }}
            >
              <Stack.Screen name="Profile">
                {({ navigation }) => (
                  <ProfileScreen
                    onOpenSettings={() => navigation.navigate('Settings')}
                    onOpenPrivacy={() => navigation.navigate('Privacy')}
                    onOpenHelp={() => navigation.navigate('HelpSupport')}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="Settings" component={SettingsScreen} />
              <Stack.Screen name="Privacy" component={PrivacyScreen} />
              <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
            </Stack.Group>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  bootstrapContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
