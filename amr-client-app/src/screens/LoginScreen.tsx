import React, { useState } from 'react';
import {
  Alert,
  ImageBackground,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { useI18n } from '../i18n/LanguageContext';
import { loginWithBackend } from '../services/authService';
import { saveAuthSession } from '../services/sessionService';

type LoginScreenProps = {
  onLoginSuccess: () => void;
  onGoToRegister: () => void;
};

export function LoginScreen({
  onLoginSuccess,
  onGoToRegister,
}: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { t } = useI18n();

  const isDisabled = email.trim().length === 0 || password.trim().length === 0;

  return (
    <ImageBackground
      source={require('../../assets/images/Hero-login.jpg')}
      resizeMode="cover"
      style={styles.container}
      blurRadius={12}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />
      <View style={styles.heroOverlay} />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.heroContent}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{t('appName')}</Text>
            </View>
            <Text style={styles.heroTitle}>{t('loginTitle')}</Text>
            <Text style={styles.heroSubtitle}>{t('loginSubtitle')}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('login')}</Text>
            <Text style={styles.cardHint}>
              Use your hospital email or mobile ID
            </Text>

            <Text style={styles.label}>{t('email')}</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@hospital.org"
              placeholderTextColor="#8A94A6"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />

            <Text style={styles.label}>{t('password')}</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={t('password')}
              placeholderTextColor="#8A94A6"
              secureTextEntry
              style={styles.input}
            />

            <Pressable
              style={[
                styles.primaryButton,
                (isDisabled || isSubmitting) && styles.buttonDisabled,
              ]}
              onPress={async () => {
                try {
                  setIsSubmitting(true);
                  const authPayload = await loginWithBackend(
                    email.trim(),
                    password,
                  );
                  await saveAuthSession(authPayload);
                  onLoginSuccess();
                } catch (error) {
                  Alert.alert(
                    'Login failed',
                    error instanceof Error
                      ? error.message
                      : 'Unable to login. Please try again.',
                  );
                } finally {
                  setIsSubmitting(false);
                }
              }}
              disabled={isDisabled || isSubmitting}
            >
              <Text style={styles.primaryButtonText}>
                {isSubmitting ? 'Signing in...' : t('login')}
              </Text>
            </Pressable>

            <Pressable style={styles.linkButton} onPress={onGoToRegister}>
              <Text style={styles.linkButtonText}>{t('newHere')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}
export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  safeArea: {
    flex: 1,
  },

  scroll: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 24,
    justifyContent: 'center',
    gap: 16,
  },

  heroOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.65)', // slightly deeper
  },

  heroContent: {
    paddingVertical: 24,
    gap: 12,
    alignItems: 'center',
  },

  badge: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },

  badgeText: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1,
  },

  heroTitle: {
    ...typography.display,
    fontSize: 34,
    color: '#FFFFFF',
    textAlign: 'center',
  },

  heroSubtitle: {
    ...typography.body,
    fontSize: 15,
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'center',
    maxWidth: '85%',
  },

  card: {
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 22,

    // better shadow
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },

  cardTitle: {
    ...typography.title,
    marginBottom: 4,
    color: colors.textPrimary,
  },

  cardHint: {
    ...typography.caption,
    marginBottom: 16,
    color: colors.textSecondary,
  },

  label: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 10,
  },

  input: {
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: typography.body.fontFamily,
    color: colors.textPrimary,
    backgroundColor: '#FFFFFF',
  },

  primaryButton: {
    marginTop: 20,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },

  buttonDisabled: {
    opacity: 0.5,
  },

  primaryButtonText: {
    ...typography.title, // use existing system
    fontSize: 16,
    color: '#FFFFFF',
  },

  linkButton: {
    marginTop: 16,
    alignItems: 'center',
  },

  linkButtonText: {
    ...typography.body,
    fontWeight: '600',
    fontSize: 14,
    color: '#0F172A',
  },
});
