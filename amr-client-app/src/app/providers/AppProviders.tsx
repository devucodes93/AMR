import React, { PropsWithChildren } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LanguageProvider } from '../../i18n/LanguageContext';
import { StatusBar } from 'react-native';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="dark-content" />
        <LanguageProvider>{children}</LanguageProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
