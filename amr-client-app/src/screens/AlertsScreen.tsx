import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../components/common/AppHeader';
import { SectionCard } from '../components/common/SectionCard';
import { colors } from '../constants/colors';
import { useI18n } from '../i18n/LanguageContext';
import { AlertSignal, getAlerts } from '../services/alertsService';

export function AlertsScreen() {
  const { t } = useI18n();
  const [alerts, setAlerts] = useState<AlertSignal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const items = await getAlerts();
        if (isMounted) {
          setAlerts(items);
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
      <AppHeader title={t('alertsTitle')} subtitle={t('alertsSubtitle')} />
      <SectionCard title={t('latestSignals')}>
        {isLoading ? (
          <Text style={styles.alertTime}>Loading alerts...</Text>
        ) : null}
        {alerts.map(alert => (
          <View key={alert.id} style={styles.alertItem}>
            <Text style={styles.alertTitle}>{alert.title}</Text>
            {alert.locationLabel ? (
              <Text style={styles.alertLocation}>{alert.locationLabel}</Text>
            ) : null}
            <Text style={styles.alertTime}>{alert.time}</Text>
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
  alertItem: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 10,
    marginBottom: 10,
  },
  alertTitle: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  alertTime: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textSecondary,
  },
  alertLocation: {
    marginTop: 4,
    fontSize: 12,
    color: '#0f766e',
    fontWeight: '700',
  },
});
