import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SupportedLanguage = 'en' | 'hi' | 'mr' | 'kn';

const LANGUAGE_STORAGE_KEY = 'mapmycity.preferred_locale';

export interface TranslationDict {
  app_name: string;
  report_issue: string;
  capture_photo: string;
  detecting_location: string;
  offline_notice: string;
  sync_now: string;
  status_submitted: string;
  status_in_progress: string;
  status_resolved: string;
  category_pothole: string;
  category_garbage: string;
  category_infrastructure: string;
  category_accessibility: string;
  category_safety: string;
  severity_low: string;
  severity_medium: string;
  severity_high: string;
  severity_critical: string;
  submit_report: string;
  cancel: string;
  retry: string;
}

const translations: Record<SupportedLanguage, TranslationDict> = {
  en: {
    app_name: 'MapMyCity',
    report_issue: 'Report Civic Issue',
    capture_photo: 'Take Photo',
    detecting_location: 'Detecting GPS location...',
    offline_notice: 'Offline mode active — reports will sync when connected.',
    sync_now: 'Sync Now',
    status_submitted: 'Report Submitted',
    status_in_progress: 'Municipal Work In Progress',
    status_resolved: 'Resolved by Ward Team',
    category_pothole: 'Pothole / Road Damage',
    category_garbage: 'Garbage & Waste Pile',
    category_infrastructure: 'Broken Streetlight / Utility',
    category_accessibility: 'Blocked Sidewalk / Ramp',
    category_safety: 'Safety Concern / Open Drain',
    severity_low: 'Low',
    severity_medium: 'Medium',
    severity_high: 'High',
    severity_critical: 'Critical Emergency',
    submit_report: 'Submit Report',
    cancel: 'Cancel',
    retry: 'Retry',
  },
  hi: {
    app_name: 'मैपमायसिटी',
    report_issue: 'नागरिक समस्या दर्ज करें',
    capture_photo: 'फोटो खींचें',
    detecting_location: 'जीपीएस स्थान प्राप्त किया जा रहा है...',
    offline_notice: 'ऑफ़लाइन मोड सक्रिय — इंटरनेट मिलने पर सिंक होगा।',
    sync_now: 'अभी सिंक करें',
    status_submitted: 'शिकायत दर्ज',
    status_in_progress: 'कार्य प्रगति पर है',
    status_resolved: 'वार्ड टीम द्वारा हल किया गया',
    category_pothole: 'सड़क का गड्ढा / खराबी',
    category_garbage: 'कचरे का ढेर',
    category_infrastructure: 'टूटी स्ट्रीट लाइट / उपयोगिता',
    category_accessibility: 'अवरुद्ध फुटपाथ / रैंप',
    category_safety: 'सुरक्षा चिंता / खुला नाला',
    severity_low: 'कम',
    severity_medium: 'मध्यम',
    severity_high: 'गंभीर',
    severity_critical: 'अति गंभीर आपातकाल',
    submit_report: 'रिपोर्ट सबमिट करें',
    cancel: 'रद्द करें',
    retry: 'पुनः प्रयास करें',
  },
  mr: {
    app_name: 'मॅपमायसिटी',
    report_issue: 'नागरी तक्रार नोंदवा',
    capture_photo: 'फोटो काढा',
    detecting_location: 'स्थान शोधत आहे...',
    offline_notice: 'ऑफलाइन मोड सक्रिय — इंटरनेट जोडणीवर सिंक होईल.',
    sync_now: 'आता सिंक करा',
    status_submitted: 'तक्रार नोंदवली',
    status_in_progress: 'काम प्रगतीपथावर आहे',
    status_resolved: 'प्रभाग पथकाद्वारे निवारण झाले',
    category_pothole: 'रस्त्यावरील खड्डा / नुकसान',
    category_garbage: 'कचऱ्याचा ढीग',
    category_infrastructure: 'बंद पथदिवा / वीज समस्या',
    category_accessibility: 'अडथळा असलेला पदपथ / रॅम्प',
    category_safety: 'सुरक्षा धोका / उघडी गटारे',
    severity_low: 'कमी',
    severity_medium: 'मध्यम',
    severity_high: 'तीव्र',
    severity_critical: 'तातडीची आणीबाणी',
    submit_report: 'तक्रार पाठवा',
    cancel: 'रद्द करा',
    retry: 'पुन्हा प्रयत्न करा',
  },
  kn: {
    app_name: 'ಮ್ಯಾಪ್‌ಮೈಸಿಟಿ',
    report_issue: 'ನಾಗರಿಕ ಸಮಸ್ಯೆ ವರದಿ ಮಾಡಿ',
    capture_photo: 'ಫೋಟೋ ತೆಗೆಯಿರಿ',
    detecting_location: 'ಸ್ಥಳ ಪತ್ತೆ ಮಾಡಲಾಗುತ್ತಿದೆ...',
    offline_notice: 'ಆಫ್‌ಲೈನ್ ಮೋಡ್ ಸಕ್ರಿಯ — ಇಂಟರ್ನೆಟ್ ಸಿಕ್ಕಾಗ ಸಿಂಕ್ ಆಗುತ್ತದೆ.',
    sync_now: 'ಈಗ ಸಿಂಕ್ ಮಾಡಿ',
    status_submitted: 'ವರದಿ ಸಲ್ಲಿಕೆಯಾಗಿದೆ',
    status_in_progress: 'ಕೆಲಸ ಪ್ರಗತಿಯಲ್ಲಿದೆ',
    status_resolved: 'ಪರಿಹರಿಸಲಾಗಿದೆ',
    category_pothole: 'ರಸ್ತೆ ಗುಂಡಿ / ಹಾನಿ',
    category_garbage: 'ಕಸದ ರಾಶಿ',
    category_infrastructure: 'ಹಾಳಾದ ಬೀದಿ ದೀಪ',
    category_accessibility: 'ಅಡಚಣೆಯಾದ ಪಾದಚಾರಿ ಮಾರ್ಗ',
    category_safety: 'ಸುರಕ್ಷತಾ ಕಾಳಜಿ / ತೆರೆದ ಚರಂಡಿ',
    severity_low: 'ಕಡಿಮೆ',
    severity_medium: 'ಮಧ್ಯಮ',
    severity_high: 'ಹೆಚ್ಚು',
    severity_critical: 'ತುರ್ತು ಸಮಸ್ಯೆ',
    submit_report: 'ವರದಿ ಸಲ್ಲಿಸಿ',
    cancel: 'ರದ್ದುಮಾಡಿ',
    retry: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ',
  },
};

let currentLanguage: SupportedLanguage = 'en';
const listeners = new Set<(lang: SupportedLanguage) => void>();

export async function initLanguage(): Promise<SupportedLanguage> {
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved && (saved === 'en' || saved === 'hi' || saved === 'mr' || saved === 'kn')) {
      currentLanguage = saved;
    }
  } catch {
    currentLanguage = 'en';
  }
  return currentLanguage;
}

export async function setLanguage(lang: SupportedLanguage): Promise<void> {
  currentLanguage = lang;
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch (e) {
    console.warn('Failed to save language preference', e);
  }
  listeners.forEach((fn) => fn(lang));
}

export function getCurrentLanguage(): SupportedLanguage {
  return currentLanguage;
}

export function t(key: keyof TranslationDict): string {
  const dict = translations[currentLanguage] || translations.en;
  return dict[key] || translations.en[key] || String(key);
}

export function useTranslation() {
  const [lang, setLangState] = useState<SupportedLanguage>(currentLanguage);

  useEffect(() => {
    const handler = (newLang: SupportedLanguage) => setLangState(newLang);
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  return {
    t: (key: keyof TranslationDict) => {
      const dict = translations[lang] || translations.en;
      return dict[key] || translations.en[key] || String(key);
    },
    language: lang,
    setLanguage,
  };
}
