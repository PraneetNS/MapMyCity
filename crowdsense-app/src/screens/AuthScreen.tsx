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
import { ShieldCheck, Phone, KeyRound, ArrowRight } from 'lucide-react-native';

import { useTheme } from '../theme/ThemeContext';
import { Button, Card } from '../components';
import { requestPhoneOtp, verifyPhoneOtp, UserSession } from '../services/auth';
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
    marginBottom: 32,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  card: {
    padding: 20,
  },
  formGroup: {
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    height: 52,
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
    fontSize: 15,
    fontWeight: 'bold',
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 12,
    fontSize: 16,
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
    lineHeight: 16,
  },
  actionButton: {
    marginTop: 8,
  },
  changePhoneButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  changePhoneText: {
    fontSize: 13,
    fontWeight: 'semibold',
  },
});
