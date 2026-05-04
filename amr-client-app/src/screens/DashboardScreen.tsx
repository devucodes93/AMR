import React, { useState } from 'react';
import { useEffect } from 'react';
import {
  Alert,
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { typography } from '../constants/typography';
import { RootStackParamList } from '../types/navigation';
import { ProfileSidebar } from '../components/ProfileSidebar';
import { getAlerts } from '../services/alertsService';
import { getCommunitySignals } from '../services/communityFeedService';
import {
  DashboardSummary,
  getDashboardSummary,
} from '../services/dashboardService';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type DashboardScreenProps = {
  onLogout?: () => void;
};

export function DashboardScreen({ onLogout }: DashboardScreenProps) {
  const navigation = useNavigation<NavigationProp>();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState<DashboardSummary>({
    totals: {
      salesToday: 0,
      prescriptionsToday: 0,
      diseasesSeenToday: 0,
      alertsToday: 0,
    },
    topDiseases: [],
    topProducts: [],
    source: 'fallback',
  });
  const [communityCount, setCommunityCount] = useState(0);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const [summaryData, alerts, signals] = await Promise.all([
          getDashboardSummary(),
          getAlerts(),
          getCommunitySignals(),
        ]);

        if (!active) {
          return;
        }

        setCommunityCount(signals.length);
        setSummary({
          ...summaryData,
          totals: {
            ...summaryData.totals,
            alertsToday: Math.max(
              summaryData.totals.alertsToday,
              alerts.length,
            ),
          },
        });
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void load();
    const timer = setInterval(() => {
      void load();
    }, 60000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const totalSignals =
    summary.totals.salesToday +
    summary.totals.prescriptionsToday +
    communityCount;
  const riskScore = Number(
    (
      (summary.totals.alertsToday * 2 + communityCount) /
      Math.max(1, totalSignals)
    ).toFixed(1),
  );
  const riskLabel = riskScore >= 4 ? 'HIGH' : riskScore >= 2 ? 'WATCH' : 'SAFE';

  const closeSidebar = () => setIsSidebarOpen(false);

  const openAndNavigate = (
    route: 'Profile' | 'Settings' | 'Privacy' | 'HelpSupport',
  ) => {
    closeSidebar();
    navigation.navigate(route);
  };

  const onPressLogout = () => {
    closeSidebar();
    if (onLogout) {
      onLogout();
      return;
    }

    Alert.alert('Logout', 'Session ended.');
  };

  return (
    <SafeAreaView style={styles.mainContainer}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.locationIcon} />
          <Text style={[styles.headerTitle, { color: '#1E40AF' }]}>
            ResistanceRadar
          </Text>
        </View>
        <Pressable onPress={() => setIsSidebarOpen(true)}>
          <Image
            source={{ uri: 'https://i.pravatar.cc/100' }}
            style={styles.profilePic}
          />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.riskCard}>
          <View style={styles.blueSidebar} />
          <Text style={styles.label}>LIVE STATUS: DISTRICT VIEW</Text>
          <Text style={styles.heroTitle}>Local Risk Summary</Text>
          <Text style={styles.description}>
            Source: {summary.source.toUpperCase()} · Updated from backend feeds
            for alerts, community signals, and daily events.
          </Text>
          <View style={styles.scoreRow}>
            {isLoading ? (
              <ActivityIndicator color="#1E40AF" />
            ) : (
              <Text style={styles.bigScore}>{riskScore}</Text>
            )}
            <View style={styles.statusBadge}>
              <View style={styles.dot} />
              <Text style={styles.statusText}>{riskLabel}</Text>
            </View>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.statCard}>
            <Text style={styles.smallLabel}>Reports Shared</Text>
            <Text style={styles.statNumber}>{totalSignals}</Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progress,
                  {
                    width: `${Math.min(100, Math.max(10, totalSignals * 8))}%`,
                  },
                ]}
              />
            </View>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#FEE2E2' }]}>
            <Text style={[styles.smallLabel, { color: '#991B1B' }]}>
              Critical Alerts
            </Text>
            <Text style={[styles.statNumber, { color: '#991B1B' }]}>
              {summary.totals.alertsToday}
            </Text>
            <Text style={styles.tinyHint}>
              {summary.totals.alertsToday > 0
                ? 'Backend reports active alert load'
                : 'All clear in monitored zones'}
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>
        <View style={styles.quickGrid}>
          <Pressable
            style={styles.quickCard}
            onPress={() => navigation.navigate('Profile')}
          >
            <Ionicons name="person-outline" size={32} color="#1d4ed8" />
            <Text style={styles.quickTitle}>Profile</Text>
          </Pressable>
          <Pressable
            style={styles.quickCard}
            onPress={() => navigation.navigate('Settings')}
          >
            <Ionicons name="settings-outline" size={32} color="#7c3aed" />
            <Text style={styles.quickTitle}>Settings</Text>
          </Pressable>
          <Pressable
            style={styles.quickCard}
            onPress={() => navigation.navigate('Privacy')}
          >
            <Ionicons name="lock-closed-outline" size={32} color="#06b6d4" />
            <Text style={styles.quickTitle}>Privacy</Text>
          </Pressable>
          <Pressable
            style={styles.quickCard}
            onPress={() => navigation.navigate('HelpSupport')}
          >
            <Ionicons name="help-circle-outline" size={32} color="#ec4899" />
            <Text style={styles.quickTitle}>Help</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Safe Use Checklist</Text>
        <View style={styles.checkItem}>
          <View style={[styles.checkbox, styles.checked]}>
            <Text style={{ color: '#FFF' }}>✓</Text>
          </View>
          <View>
            <Text style={styles.itemTitle}>
              Use antibiotics only on doctor advice
            </Text>
            <Text style={styles.itemSub}>
              Never self-medicate after seeing local symptoms
            </Text>
          </View>
        </View>
        <View style={styles.checkItem}>
          <View style={[styles.checkbox, styles.checked]}>
            <Text style={{ color: '#FFF' }}>✓</Text>
          </View>
          <View>
            <Text style={styles.itemTitle}>Finish full antibiotic course</Text>
            <Text style={styles.itemSub}>
              Stopping early can increase resistance
            </Text>
          </View>
        </View>
      </ScrollView>

      <ProfileSidebar
        visible={isSidebarOpen}
        onClose={closeSidebar}
        onOpenProfile={() => openAndNavigate('Profile')}
        onOpenSettings={() => openAndNavigate('Settings')}
        onOpenPrivacy={() => openAndNavigate('Privacy')}
        onOpenHelp={() => openAndNavigate('HelpSupport')}
        onLogout={onPressLogout}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  locationIcon: {
    width: 12,
    height: 12,
    backgroundColor: '#1E40AF',
    borderRadius: 6,
  },
  headerTitle: { ...typography.title, fontSize: 18 },
  profilePic: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  scrollContent: { padding: 16, gap: 20, paddingBottom: 100 },
  riskCard: {
    backgroundColor: '#FFF',
    padding: 24,
    borderRadius: 12,
    position: 'relative',
    overflow: 'hidden',
    elevation: 2,
  },
  blueSidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    backgroundColor: '#1E40AF',
  },
  heroTitle: {
    ...typography.display,
    fontSize: 30,
    color: '#000',
    marginVertical: 8,
  },
  label: { ...typography.sectionTitle, fontSize: 10, color: '#64748B' },
  description: { ...typography.body, color: '#475569', fontSize: 14 },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 20,
  },
  bigScore: { ...typography.statValue, fontSize: 50, color: '#1E40AF' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    padding: 8,
    borderRadius: 20,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1E40AF',
    marginRight: 6,
  },
  statusText: { ...typography.caption, color: '#1E40AF', fontWeight: 'bold' },
  row: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    elevation: 1,
  },
  smallLabel: { ...typography.caption, color: '#64748B' },
  statNumber: { ...typography.statValue, fontSize: 28 },
  progressBar: {
    height: 4,
    backgroundColor: '#E2E8F0',
    marginTop: 8,
    borderRadius: 2,
  },
  progress: { height: '100%', backgroundColor: '#1E40AF', borderRadius: 2 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { ...typography.title, fontSize: 18, color: '#000' },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickCard: {
    width: '48.5%',
    backgroundColor: '#FFF',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    gap: 8,
  },
  quickIcon: {
    fontSize: 20,
  },
  quickTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  checkItem: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    alignItems: 'center',
  },
  itemTitle: { ...typography.body, fontWeight: 'bold', color: '#1F2937' },
  itemSub: { ...typography.caption, color: '#64748B' },
  tinyHint: { ...typography.caption, marginTop: 4, color: '#64748B' },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 4,
  },
  checked: {
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
