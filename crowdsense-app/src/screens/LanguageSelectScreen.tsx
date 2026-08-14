import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
} from 'react-native';
import { Languages, Check, ArrowRight } from 'lucide-react-native';
import { setAppLanguage, t } from '../config/i18n';

export const INDIAN_LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'hi', name: 'Hindi', native: 'हिंदी' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
];

interface LanguageSelectScreenProps {
  onSelectLanguage: (code: string) => void;
}

export default function LanguageSelectScreen({ onSelectLanguage }: LanguageSelectScreenProps) {
  const [selected, setSelected] = useState('en');

  const handleContinue = () => {
    setAppLanguage(selected);
    onSelectLanguage(selected);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Languages size={32} color="#4F46E5" />
        </View>
        <Text style={styles.title}>Choose Your Language</Text>
        <Text style={styles.subtitle}>
          भाषा चुनें • भाषा निवडा • ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ
        </Text>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {INDIAN_LANGUAGES.map((lang) => {
          const isSelected = selected === lang.code;
          return (
            <Pressable
              key={lang.code}
              style={[styles.card, isSelected && styles.cardSelected]}
              onPress={() => setSelected(lang.code)}
            >
              <View>
                <Text style={[styles.nativeText, isSelected && styles.textSelected]}>
                  {lang.native}
                </Text>
                <Text style={styles.englishText}>{lang.name}</Text>
              </View>

              {isSelected && (
                <View style={styles.checkCircle}>
                  <Check size={16} color="#FFFFFF" />
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={styles.continueBtn}
          onPress={handleContinue}
        >
          <Text style={styles.continueText}>{t('continue')}</Text>
          <ArrowRight size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 20,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  cardSelected: {
    borderColor: '#4F46E5',
    backgroundColor: '#F5F3FF',
  },
  nativeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  textSelected: {
    color: '#4F46E5',
  },
  englishText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  continueBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#4F46E5',
    paddingVertical: 16,
    borderRadius: 14,
  },
  continueText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
