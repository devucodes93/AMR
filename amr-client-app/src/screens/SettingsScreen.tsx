import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../components/common/AppHeader';
import { SectionCard } from '../components/common/SectionCard';
import { colors } from '../constants/colors';
import { useI18n } from '../i18n/LanguageContext';
import { languageLabelMap } from '../i18n/translations';

export function SettingsScreen() {
  const { t, language, setLanguage } = useI18n();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <AppHeader title={t('settingsTitle')} subtitle={t('settingsSubtitle')} />

      <SectionCard title={t('chooseLanguage')}>
        <View style={styles.languageRow}>
          {Object.keys(languageLabelMap).map(code => (
            <Pressable
              key={code}
              style={[styles.languageChip, language === code && styles.languageChipActive]}
              onPress={() => setLanguage(code as keyof typeof languageLabelMap)}>
              <Text style={[styles.languageChipText, language === code && styles.languageChipTextActive]}>
                {languageLabelMap[code as keyof typeof languageLabelMap]}
              </Text>
            </Pressable>
          ))}
        </View>
      </SectionCard>

      <SectionCard title={t('dataPrivacy')}>
        <Text style={styles.text}>Anonymization: k-anonymity pipeline enabled</Text>
        <Text style={styles.text}>Data sharing: Public health authority mode active</Text>
      </SectionCard>

      <SectionCard title={t('notifications')}>
        <Text style={styles.text}>{t('notificationsLine')}</Text>
        <Text style={styles.text}>Webhook escalation: Configure endpoint in service layer</Text>
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
  text: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  languageRow: {
    flexDirection: 'row',
    gap: 8,
  },
  languageChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surface,
  },
  languageChipActive: {
    backgroundColor: '#FEE4E2',
    borderColor: '#F4C7C3',
  },
  languageChipText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  languageChipTextActive: {
    color: colors.primary,
  },
});
