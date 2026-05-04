import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BrandHero } from '../components/common/BrandHero';
import { colors } from '../constants/colors';
import { useI18n } from '../i18n/LanguageContext';
import { registerWithBackend } from '../services/authService';

type RegisterScreenProps = {
  onRegisterSuccess: () => void;
  onGoToLogin: () => void;
};

export function RegisterScreen({
  onRegisterSuccess,
  onGoToLogin,
}: RegisterScreenProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { t } = useI18n();

  const isDisabled =
    name.trim().length === 0 ||
    email.trim().length === 0 ||
    password.trim().length < 6;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <BrandHero
          appName={t('appName')}
          logoLabel={t('logoPlaceholder')}
          logoHint={t('addLogoHint')}
        />
        <Text style={styles.title}>{t('createAccount')}</Text>
        <Text style={styles.subtitle}>{t('registerSubtitle')}</Text>

        <View style={styles.card}>
          <Text style={styles.label}>{t('fullName')}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Dr. A. Sharma"
            style={styles.input}
          />

          <Text style={styles.label}>{t('email')}</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@hospital.org"
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />

          <Text style={styles.label}>{t('password')}</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
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
                await registerWithBackend(name.trim(), email.trim(), password);
                onRegisterSuccess();
              } catch (error) {
                Alert.alert(
                  'Register failed',
                  error instanceof Error
                    ? error.message
                    : 'Unable to register. Please try again.',
                );
              } finally {
                setIsSubmitting(false);
              }
            }}
            disabled={isDisabled || isSubmitting}
          >
            <Text style={styles.primaryButtonText}>
              {isSubmitting ? 'Creating account...' : t('register')}
            </Text>
          </Pressable>

          <Pressable style={styles.linkButton} onPress={onGoToLogin}>
            <Text style={styles.linkButtonText}>{t('alreadyAccount')}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 18,
    gap: 12,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    padding: 14,
  },
  label: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
  },
  primaryButton: {
    marginTop: 14,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  linkButton: {
    marginTop: 10,
    alignItems: 'center',
  },
  linkButtonText: {
    color: colors.primary,
    fontWeight: '700',
  },
});
