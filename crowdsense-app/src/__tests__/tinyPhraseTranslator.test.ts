/**
 * tinyPhraseTranslator.test.ts
 * 
 * Tests short phrase translation engine:
 * - Hard length cap (>150 characters)
 * - Exact static municipal template matches
 * - Domain vocabulary phrases
 * - Safe fallbacks
 */

import {
  translateTinyPhrase,
  MAX_TRANSLATION_INPUT_CHARS,
} from '../services/tinyPhraseTranslator';

describe('Tiny Phrase Translator Engine', () => {
  test('translates exact municipal templates instantly without model', async () => {
    const res = await translateTinyPhrase('Dispatched to Ward Maintenance Team', 'hi');
    expect(res.translatedText).toBe('वार्ड रखरखाव टीम को भेजा गया');
    expect(res.isStaticMatch).toBe(true);
    expect(res.skippedDueToLength).toBe(false);
  });

  test('translates domain phrases from civic vocabulary', async () => {
    const res = await translateTinyPhrase('pothole fixed', 'hi');
    expect(res.translatedText).toBe('गड्ढा भर दिया गया');
    expect(res.isStaticMatch).toBe(true);
  });

  test('rejects and skips translation when input exceeds 150 characters', async () => {
    const longText = 'A'.repeat(MAX_TRANSLATION_INPUT_CHARS + 20);
    const res = await translateTinyPhrase(longText, 'hi');
    expect(res.skippedDueToLength).toBe(true);
    expect(res.translatedText).toBe(longText); // Preserves original text
    expect(res.isModelTranslated).toBe(false);
  });

  test('returns English text unchanged when target is en', async () => {
    const res = await translateTinyPhrase('Work in progress on-site', 'en');
    expect(res.translatedText).toBe('Work in progress on-site');
  });
});
