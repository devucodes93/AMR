import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';

type StatCardProps = {
  label: string;
  value: string;
  tone?: 'red' | 'amber' | 'blue';
};

export function StatCard({ label, value, tone = 'blue' }: StatCardProps) {
  const backgroundColor =
    tone === 'red'
      ? colors.dangerSoft
      : tone === 'amber'
      ? colors.amberSoft
      : colors.blueSoft;

  return (
    <View style={[styles.card, { backgroundColor }]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  value: {
    marginTop: 8,
    ...typography.statValue,
    color: colors.textPrimary,
  },
});
