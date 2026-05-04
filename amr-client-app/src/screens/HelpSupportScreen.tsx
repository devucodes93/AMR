import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { AppHeader } from '../components/common/AppHeader';
import { SectionCard } from '../components/common/SectionCard';
import { colors } from '../constants/colors';

export function HelpSupportScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <AppHeader
        title="Help & Support"
        subtitle="Need help using alerts, map, or reports?"
      />
      <SectionCard title="Support Channels">
        <Pressable style={styles.item}>
          <Text style={styles.itemText}>
            Call district helpline: 1800-000-111
          </Text>
        </Pressable>
        <Pressable style={styles.item}>
          <Text style={styles.itemText}>Email: support@resistanceradar.in</Text>
        </Pressable>
        <Pressable style={styles.item}>
          <Text style={styles.itemText}>FAQ: How to read risk zones</Text>
        </Pressable>
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
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
  },
  itemText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
