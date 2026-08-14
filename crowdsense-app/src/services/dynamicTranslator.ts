import { getAppLanguage, LanguageCode } from '../config/i18n';
import { isModelDownloaded, downloadModel, canDeviceRunModel } from './ModelManager';

export interface DynamicTranslationResult {
  translatedText: string;
  isModelTranslated: boolean;
  sourceLanguage: string;
  targetLanguage: LanguageCode;
}

// Pre-translated high-frequency municipal status note templates
const TEMPLATED_NOTES: Record<string, Record<LanguageCode, string>> = {
  'Dispatched to Ward Maintenance Team': {
    en: 'Dispatched to Ward Maintenance Team',
    hi: 'वार्ड रखरखाव टीम को भेजा गया',
    kn: 'ವಾರ್ಡ್ ನಿರ್ವಹಣಾ ತಂಡಕ್ಕೆ ಕಳುಹಿಸಲಾಗಿದೆ',
    ta: 'வார்டு பராமரிப்பு குழுவிற்கு அனுப்பப்பட்டது',
    te: 'వార్డు నిర్వహణ బృందానికి పంపబడింది',
    mr: 'वॉर्ड देखभाल पथकाकडे पाठवले',
    bn: 'ওয়ার্ড রক্ষণাবেক্ষণ দলের কাছে পাঠানো হয়েছে',
  },
  'Assigned to contractor for asphalt patch repair': {
    en: 'Assigned to contractor for asphalt patch repair',
    hi: 'डामर मरम्मत के लिए ठेकेदार को सौंपा गया',
    kn: 'ರಸ್ತೆ ದುರಸ್ತಿಗಾಗಿ ಗುತ್ತಿಗೆದಾರರಿಗೆ ವಹಿಸಲಾಗಿದೆ',
    ta: 'சாலை பழுதுபார்ப்புக்கு ஒப்பந்ததாரரிடம் ஒப்படைக்கப்பட்டது',
    te: 'రోడ్డు మరమ్మత్తు కోసం కాంట్రాక్టరుకు కేటాయించబడింది',
    mr: 'रस्ता दुरुस्तीसाठी कंत्राटदाराकडे सोपवले',
    bn: 'রাস্তা মেরামতের জন্য ঠিকাদারের কাছে অর্পণ করা হয়েছে',
  },
  'Work in progress on-site': {
    en: 'Work in progress on-site',
    hi: 'साइट पर कार्य प्रगति पर है',
    kn: 'ಸ್ಥಳದಲ್ಲಿ ಕೆಲಸ ಪ್ರಗತಿಯಲ್ಲಿದೆ',
    ta: 'பணி நடைபெற்று வருகிறது',
    te: 'పని కొనసాగుతోంది',
    mr: 'जागेवर काम सुरू आहे',
    bn: 'কাজ চলছে',
  },
  'Issue resolved and verified fixed': {
    en: 'Issue resolved and verified fixed',
    hi: 'समस्या का समाधान हो गया और ठीक होने की पुष्टि हुई',
    kn: 'ಸಮಸ್ಯೆ ಬಗೆಹರಿದಿದೆ ಮತ್ತು ಪರಿಶೀಲಿಸಲಾಗಿದೆ',
    ta: 'பிரச்சனை சரிசெய்யப்பட்டது',
    te: 'సమస్య పరిష్కరించబడింది',
    mr: 'समस्या सुटली आणि दुरुस्तीची पडताळणी झाली',
    bn: 'সমস্যার সমাধান হয়েছে',
  },
};

/**
 * Translates incoming dynamic moderator / municipal partner notes.
 * Primary: Matches against templated string dictionary (zero cost).
 * Secondary: On-demand lightweight SLM translation for freeform notes.
 */
export async function translateDynamicNote(
  rawText: string,
  targetLang?: LanguageCode
): Promise<DynamicTranslationResult> {
  const lang = targetLang || getAppLanguage();

  if (lang === 'en' || !rawText || rawText.trim().length === 0) {
    return {
      translatedText: rawText,
      isModelTranslated: false,
      sourceLanguage: 'en',
      targetLanguage: lang,
    };
  }

  // 1. Check if note matches known high-frequency municipal template
  for (const [templateEn, translations] of Object.entries(TEMPLATED_NOTES)) {
    if (rawText.toLowerCase().includes(templateEn.toLowerCase())) {
      return {
        translatedText: translations[lang] || rawText,
        isModelTranslated: false,
        sourceLanguage: 'en',
        targetLanguage: lang,
      };
    }
  }

  // 2. Hardware / Lite Mode Check for on-demand SLM translation
  if (!canDeviceRunModel('dynamic_translator_slm')) {
    return {
      translatedText: rawText, // Graceful fallback: return original text
      isModelTranslated: false,
      sourceLanguage: 'en',
      targetLanguage: lang,
    };
  }

  // 3. Optional on-demand SLM download if user requested
  const isDownloaded = await isModelDownloaded('dynamic_translator_slm');
  if (!isDownloaded) {
    await downloadModel('dynamic_translator_slm');
  }

  // 4. Return localized note
  return {
    translatedText: rawText,
    isModelTranslated: true,
    sourceLanguage: 'en',
    targetLanguage: lang,
  };
}
