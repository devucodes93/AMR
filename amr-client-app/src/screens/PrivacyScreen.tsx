import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { AppHeader } from '../components/common/AppHeader';
import { SectionCard } from '../components/common/SectionCard';
import { colors } from '../constants/colors';

export function PrivacyScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <AppHeader
        title="Privacy"
        subtitle="How AMR data is anonymized and shared"
      />
      <SectionCard title="Protection Rules">
        <Text style={styles.text}>
          k-anonymity masking is applied before community-level processing.
        </Text>
        <Text style={styles.text}>
          No patient name or phone number is shown in dashboards.
        </Text>
        <Text style={styles.text}>
          Only risk indicators are shared to public health authorities.
        </Text>
      </SectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: colors.background,
  },
  text: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
  },
});
