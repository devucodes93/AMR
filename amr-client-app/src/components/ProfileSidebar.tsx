import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  Image,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

type ProfileSidebarProps = {
  visible: boolean;
  onClose: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onOpenPrivacy: () => void;
  onOpenHelp: () => void;
  onLogout: () => void;
};

type MenuItemProps = {
  icon: string;
  label: string;
  color: string;
  onPress: () => void;
};

function MenuItem({ icon, label, color, onPress }: MenuItemProps) {
  return (
    <Pressable style={styles.menuItem} onPress={onPress}>
      <View style={[styles.menuIconWrap, { backgroundColor: `${color}1A` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={20} color="#64748B" />
    </Pressable>
  );
}

export function ProfileSidebar({
  visible,
  onClose,
  onOpenProfile,
  onOpenSettings,
  onOpenPrivacy,
  onOpenHelp,
  onLogout,
}: ProfileSidebarProps) {
  const slideX = useRef(new Animated.Value(320)).current;

  useEffect(() => {
    Animated.timing(slideX, {
      toValue: visible ? 0 : 320,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [visible, slideX]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <Animated.View
          style={[styles.panel, { transform: [{ translateX: slideX }] }]}
        >
          <View style={styles.header}>
            <View style={styles.userRow}>
              <Image
                source={{ uri: 'https://i.pravatar.cc/100' }}
                style={styles.profilePic}
              />
              <View>
                <Text style={styles.userName}>AMR User</Text>
                <Text style={styles.userMeta}>District Contributor</Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color="#0F172A" />
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>Quick Links</Text>

          <MenuItem
            icon="person-outline"
            label="Profile"
            color="#1D4ED8"
            onPress={onOpenProfile}
          />
          <MenuItem
            icon="settings-outline"
            label="Settings"
            color="#7C3AED"
            onPress={onOpenSettings}
          />
          <MenuItem
            icon="lock-closed-outline"
            label="Privacy"
            color="#0891B2"
            onPress={onOpenPrivacy}
          />
          <MenuItem
            icon="help-circle-outline"
            label="Help & Support"
            color="#BE185D"
            onPress={onOpenHelp}
          />

          <View style={styles.footer}>
            <Pressable style={styles.logoutButton} onPress={onLogout}>
              <Ionicons name="log-out-outline" size={20} color="#B42318" />
              <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 23, 0.35)',
  },
  panel: {
    width: 300,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 20,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  profilePic: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  userMeta: {
    fontSize: 12,
    color: '#64748B',
  },
  sectionTitle: {
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#64748B',
    fontWeight: '700',
    marginBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  menuIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  menuLabel: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  footer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    paddingVertical: 12,
  },
  logoutText: {
    color: '#B42318',
    fontWeight: '700',
    fontSize: 14,
  },
});
