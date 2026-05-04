import React from 'react';
import { StatusBar } from 'react-native';
import { RootNavigator } from './src/app/navigation/RootNavigator';
import { AppProviders } from './src/app/providers/AppProviders';

function App() {
  return (
    <AppProviders>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />
      <RootNavigator />
    </AppProviders>
  );
}

export default App;
