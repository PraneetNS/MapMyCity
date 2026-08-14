import { getAppLanguage, LanguageCode } from '../config/i18n';
import { translateTinyPhrase, PhraseTranslationResult } from './tinyPhraseTranslator';

export interface DynamicTranslationResult {
  translatedText: string;
  isModelTranslated: boolean;
  sourceLanguage: string;
  targetLanguage: LanguageCode;
}

/**
 * Translates incoming dynamic moderator / municipal partner notes using
 * bounded on-device phrase translation with hard input caps and template fallback.
 */
export async function translateDynamicNote(
  rawText: string,
  targetLang?: LanguageCode
): Promise<DynamicTranslationResult> {
  const result: PhraseTranslationResult = await translateTinyPhrase(rawText, targetLang);
  return {
    translatedText: result.translatedText,
    isModelTranslated: result.isModelTranslated,
    sourceLanguage: result.sourceLanguage,
    targetLanguage: result.targetLanguage,
  };
}
