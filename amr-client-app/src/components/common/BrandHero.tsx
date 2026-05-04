import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';

type BrandHeroProps = {
  appName: string;
  logoLabel: string;
  logoHint: string;
};

export function BrandHero({ appName, logoLabel, logoHint }: BrandHeroProps) {
  return (
    <View style={styles.container}>
      <View style={styles.logoCircle}>
        <Text style={styles.logoText}>{logoLabel}</Text>
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.appName}>{appName}</Text>
        <Text style={styles.logoHint}>{logoHint}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFECEB',
    borderWidth: 1,
    borderColor: '#F4C7C3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    ...typography.caption,
    color: colors.primary,
  },
  textWrap: {
    flex: 1,
  },
  appName: {
    ...typography.title,
    color: colors.textPrimary,
  },
  logoHint: {
    marginTop: 3,
    ...typography.caption,
    color: colors.textSecondary,
  },
});
