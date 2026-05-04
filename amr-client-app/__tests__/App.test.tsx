/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MapView = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, null, children);

  return {
    __esModule: true,
    default: MapView,
    Circle: () => null,
    Marker: () => null,
  };
});

jest.mock('@react-native-community/geolocation', () => ({
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
}));

jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    __esModule: true,
    WebView: (props: any) =>
      React.createElement(View, { testID: 'webview-mock', ...props }, null),
  };
});

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    __esModule: true,
    DefaultTheme: { colors: {} },
    NavigationContainer: ({ children }: { children?: React.ReactNode }) =>
      children,
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
    }),
  };
});

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({ children }: { children?: React.ReactNode }) => children,
    Screen: ({ children }: { children?: React.ReactNode }) => children ?? null,
    Group: ({ children }: { children?: React.ReactNode }) => children ?? null,
  }),
}));

jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({
    Navigator: ({ children }: { children?: React.ReactNode }) => children,
    Screen: ({ children }: { children?: React.ReactNode }) => children ?? null,
  }),
}));

jest.mock('react-native-vector-icons/Ionicons', () => ({
  __esModule: true,
  default: () => null,
}));

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
