import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { AppHeader } from '../components/common/AppHeader';
import { SectionCard } from '../components/common/SectionCard';
import { colors } from '../constants/colors';

type ProfileScreenProps = {
  onOpenSettings: () => void;
  onOpenPrivacy: () => void;
  onOpenHelp: () => void;
};

export function ProfileScreen({
  onOpenSettings,
  onOpenPrivacy,
  onOpenHelp,
}: ProfileScreenProps) {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Profile</Text>
          <Text style={styles.headerSubtitle}>
            Manage account, settings & privacy
          </Text>
        </View>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <AppHeader title="" subtitle="" />

        <SectionCard title="Account">
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>DR</Text>
            </View>
            <View>
              <Text style={styles.name}>Dr. A. Sharma</Text>
              <Text style={styles.meta}>District AMR Coordinator</Text>
            </View>
          </View>
        </SectionCard>

        <SectionCard title="Quick Links">
          <Pressable style={styles.linkButton} onPress={onOpenSettings}>
            <Text style={styles.linkText}>Open Settings</Text>
          </Pressable>
          <Pressable style={styles.linkButton} onPress={onOpenPrivacy}>
            <Text style={styles.linkText}>Privacy & Data Sharing</Text>
          </Pressable>
          <Pressable style={styles.linkButton} onPress={onOpenHelp}>
            <Text style={styles.linkText}>Help & Support</Text>
          </Pressable>
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  container: {
    backgroundColor: colors.background,
    padding: 16,
    gap: 12,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E0EAFF',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E3A8A',
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  meta: {
    marginTop: 2,
    fontSize: 13,
    color: colors.textSecondary,
  },
  linkButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
