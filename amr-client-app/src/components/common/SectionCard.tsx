import React, { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';

type SectionCardProps = PropsWithChildren<{
  title: string;
}>;

export function SectionCard({ title, children }: SectionCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
  },
  title: {
    ...typography.sectionTitle,
    color: colors.textPrimary,
  },
  content: {
    marginTop: 8,
    gap: 8,
  },
});
