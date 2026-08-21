import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { ShieldCheck, KeyRound, Globe, Apple, CheckCircle2 } from 'lucide-react-native';

import { useTheme } from '../theme/ThemeContext';
import { Button, Card } from '../components';
import { requestPhoneOtp, verifyPhoneOtp, signInWithSocial, UserSession } from '../services/auth';
import { getDeviceId } from '../utils/device';
import { t } from '../config/i18n';

interface AuthScreenProps {
  onAuthSuccess: (session: UserSession) => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const { theme } = useTheme();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [isLoading, setIsLoading] = useState(false);
  const [isSocialLoading, setIsSocialLoading] = useState<'google' | 'apple' | null>(null);

  const handleSendOtp = async () => {
    const cleaned = phoneNumber.replace(/\D/g, '');
    if (cleaned.length !== 10) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Phone Number',
        text2: 'Please enter a valid 10-digit mobile number.',
      });
      return;
    }

    setIsLoading(true);
    try {
      const deviceId = await getDeviceId();
      await requestPhoneOtp(cleaned, deviceId);

      setStep('otp');
      Toast.show({
        type: 'success',
        text1: 'OTP Sent',
        text2: 'Enter the 6-digit code sent to your phone (Demo: 123456)',
      });
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'OTP Request Failed',
        text2: err?.message || 'Could not send verification OTP.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length < 4) {
      Toast.show({
        type: 'error',
        text1: 'Invalid OTP',
        text2: 'Please enter the verification code.',
      });
      return;
    }

    setIsLoading(true);
    try {
      const deviceId = await getDeviceId();

      const session = await verifyPhoneOtp(phoneNumber, otpCode, deviceId);

      Toast.show({
        type: 'success',
        text1: 'Phone Verified',
        text2: 'Welcome to CrowdSense Platform.',
      });

      onAuthSuccess(session);
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Verification Failed',
        text2: err?.message || 'Invalid or expired verification code.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialAuth = async (provider: 'google' | 'apple') => {
    setIsSocialLoading(provider);
    try {
      const deviceId = await getDeviceId();
      const session = await signInWithSocial(provider, deviceId, {
        name: provider === 'google' ? 'Google Citizen' : 'Apple Citizen',
        email: `resident_${provider}@example.com`,
      });

      Toast.show({
        type: 'success',
        text1: `${provider === 'google' ? 'Google' : 'Apple'} Sign-In Successful`,
        text2: 'Authenticated with CrowdSense Platform.',
      });

      onAuthSuccess(session);
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Social Sign-In Failed',
        text2: err?.message || 'Could not complete social authentication.',
      });
    } finally {
      setIsSocialLoading(null);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.colors.neutral[100] }]}
    >
      <View style={styles.header}>
        <View style={[styles.logoCircle, { backgroundColor: theme.colors.primaryBg }]}>
          <ShieldCheck size={40} color={theme.colors.primary} />
        </View>
        <Text style={[styles.title, { color: theme.colors.neutral[900] }]}>{t('accountTitle')}</Text>
        <Text style={[styles.subtitle, { color: theme.colors.neutral[600] }]}>
          {t('accountSubtitle')}
        </Text>
      </View>

      <Card style={styles.card} elevation="medium">
        {step === 'phone' ? (
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: theme.colors.neutral[800] }]}>{t('enterPhone')}</Text>
            <View style={[styles.inputRow, { borderColor: theme.colors.neutral[300], backgroundColor: theme.colors.white }]}>
              <View style={styles.countryCode}>
                <Text style={[styles.countryCodeText, { color: theme.colors.neutral[800] }]}>🇮🇳 +91</Text>
              </View>
              <TextInput
                style={[styles.phoneInput, { color: theme.colors.neutral[900] }]}
                placeholder={t('phonePlaceholder')}
                placeholderTextColor={theme.colors.neutral[400]}
                keyboardType="phone-pad"
                maxLength={10}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
              />
            </View>

            <Text style={[styles.helperText, { color: theme.colors.neutral[500] }]}>
              Your phone number is hashed with SHA-256 and never stored plaintext.
            </Text>

            <Button
              title={t('sendOtp')}
              onPress={handleSendOtp}
              loading={isLoading}
              disabled={isLoading}
              style={styles.actionButton}
            />

            {/* Social Sign-In Coexistence Section */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with social identity</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialButtonsCol}>
              <Pressable
                onPress={() => handleSocialAuth('google')}
                disabled={Boolean(isSocialLoading)}
                style={[styles.socialButton, styles.googleButton]}
              >
                <Globe size={18} color="#EA4335" />
                <Text style={styles.googleButtonText}>
                  {isSocialLoading === 'google' ? 'Connecting...' : 'Continue with Google'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => handleSocialAuth('apple')}
                disabled={Boolean(isSocialLoading)}
                style={[styles.socialButton, styles.appleButton]}
              >
                <Apple size={18} color="#FFFFFF" />
                <Text style={styles.appleButtonText}>
                  {isSocialLoading === 'apple' ? 'Connecting...' : 'Continue with Apple'}
                </Text>
              </Pressable>
            </View>

            <View style={styles.capabilityNoticeBox}>
              <CheckCircle2 size={13} color="#64748B" />
              <Text style={styles.capabilityNoticeText}>
                Phone OTP enables emergency SMS hazard alerts. Social sign-in provides instant civic reporting access.
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: theme.colors.neutral[800] }]}>{t('enterOtp')}</Text>
            <Text style={[styles.otpSublabel, { color: theme.colors.neutral[600] }]}>
              {t('otpSentTo')} +91 {phoneNumber}
            </Text>

            <View style={[styles.inputRow, { borderColor: theme.colors.neutral[300], backgroundColor: theme.colors.white }]}>
              <KeyRound size={20} color={theme.colors.neutral[500]} style={{ marginLeft: 12 }} />
              <TextInput
                style={[styles.otpInput, { color: theme.colors.neutral[900] }]}
                placeholder="123456"
                placeholderTextColor={theme.colors.neutral[400]}
                keyboardType="number-pad"
                maxLength={6}
                value={otpCode}
                onChangeText={setOtpCode}
              />
            </View>

            <Button
              title={t('verifyContinue')}
              onPress={handleVerifyOtp}
              loading={isLoading}
              disabled={isLoading}
              style={styles.actionButton}
            />

            <Pressable onPress={() => setStep('phone')} style={styles.changePhoneButton}>
              <Text style={[styles.changePhoneText, { color: theme.colors.primary }]}>{t('changeNumber')}</Text>
            </Pressable>
          </View>
        )}
      </Card>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  card: {
    padding: 20,
  },
  formGroup: {
    gap: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    height: 50,
    overflow: 'hidden',
  },
  countryCode: {
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    height: '100%',
  },
  countryCodeText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 12,
    fontSize: 15,
    letterSpacing: 1,
  },
  otpSublabel: {
    fontSize: 12,
    marginTop: -4,
  },
  otpInput: {
    flex: 1,
    paddingHorizontal: 12,
    fontSize: 16,
    letterSpacing: 2,
  },
  helperText: {
    fontSize: 11,
    lineHeight: 15,
  },
  actionButton: {
    marginTop: 4,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    gap: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  socialButtonsCol: {
    gap: 8,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
  },
  googleButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  appleButton: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  appleButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  capabilityNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  capabilityNoticeText: {
    fontSize: 10,
    color: '#64748B',
    flex: 1,
    lineHeight: 14,
  },
  changePhoneButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  changePhoneText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
