import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../components/common/AppHeader';
import { SectionCard } from '../components/common/SectionCard';
import { colors } from '../constants/colors';
import { useI18n } from '../i18n/LanguageContext';
import {
  CommunitySignal,
  getCommunitySignals,
} from '../services/communityFeedService';

export function CommunityFeedScreen() {
  const { t } = useI18n();
  const [signals, setSignals] = useState<CommunitySignal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const items = await getCommunitySignals();
        if (isMounted) {
          setSignals(items);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <AppHeader
        title={t('communityTitle')}
        subtitle={t('communitySubtitle')}
      />

      <SectionCard title={t('latestReports')}>
        {isLoading ? <Text style={styles.meta}>Loading reports...</Text> : null}
        {signals.map(signal => (
          <View key={signal.id} style={styles.item}>
            <Text style={styles.area}>{signal.area}</Text>
            <Text style={styles.symptoms}>{signal.symptoms}</Text>
            <Text style={styles.meta}>
              {t('intensity')}: {signal.intensity} | {signal.reportedAt}
            </Text>
          </View>
        ))}
      </SectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: colors.background,
  },
  item: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 10,
    marginBottom: 10,
  },
  area: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  symptoms: {
    marginTop: 2,
    fontSize: 13,
    color: colors.textSecondary,
  },
  meta: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textSecondary,
  },
});
