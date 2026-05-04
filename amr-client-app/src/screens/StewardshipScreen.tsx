import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../components/common/AppHeader';
import { SectionCard } from '../components/common/SectionCard';
import { StatCard } from '../components/common/StatCard';
import { colors } from '../constants/colors';
import { useI18n } from '../i18n/LanguageContext';

export function StewardshipScreen() {
  const { t } = useI18n();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <AppHeader title={t('stewardTitle')} subtitle={t('stewardSubtitle')} />

      <View style={styles.statRow}>
        <StatCard label={t('districtScore')} value="86" tone="blue" />
        <StatCard label={t('topQuartile')} value="22" tone="amber" />
      </View>

      <SectionCard title={t('actionsRecommended')}>
        <Text style={styles.text}>
          Review broad-spectrum prescriptions over last 48 hours.
        </Text>
        <Text style={styles.text}>
          Push culture-based prescribing nudges to high-use wards.
        </Text>
        <Text style={styles.text}>
          Trigger peer benchmark report for below-threshold doctors.
        </Text>
      </SectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
    backgroundColor: colors.background,
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
  },
  text: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
