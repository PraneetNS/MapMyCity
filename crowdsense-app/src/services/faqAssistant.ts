/**
 * Scoped FAQ Help Assistant
 * Retrieval-based matching against a curated knowledge base of app workflows,
 * DPDP privacy rules, and reporting mechanics.
 * Strictly avoids hallucination by falling back to Contact Support when confidence is low.
 */

export interface FAQEntry {
  id: string;
  question: string;
  answer: string;
  category: 'reporting' | 'privacy' | 'clusters' | 'rewards' | 'performance';
  keywords: string[];
}

export interface FAQMatchResult {
  matched: boolean;
  bestMatch?: FAQEntry;
  confidence: number;
  allMatches: FAQEntry[];
  fallbackToSupport: boolean;
}

export const FAQ_KNOWLEDGE_BASE: FAQEntry[] = [
  {
    id: 'faq_clustering',
    question: 'How do report clusters work?',
    answer:
      'Reports submitted within 20 meters and 72 hours of an existing issue are automatically grouped into a single civic cluster. This avoids duplicate tickets and shows city officials the collective urgency of the community.',
    category: 'clusters',
    keywords: ['cluster', 'duplicate', 'group', 'multiple', 'same', 'incident'],
  },
  {
    id: 'faq_status_lifecycle',
    question: 'What happens after I submit a report?',
    answer:
      'Your report passes on-device checks and enters the moderation queue. Once approved, it is prioritized for ward engineers, moves to "In Progress", and finally "Resolved" once fixed.',
    category: 'reporting',
    keywords: ['status', 'timeline', 'track', 'lifecycle', 'approved', 'progress', 'fixed', 'after submit'],
  },
  {
    id: 'faq_privacy_dpdp',
    question: 'Is my personal data and location private?',
    answer:
      'Yes. In compliance with the DPDP Act 2023, your exact phone number is hashed cryptographically and never exposed. Women’s safety reports are strictly anonymized without device identifiers.',
    category: 'privacy',
    keywords: ['privacy', 'phone', 'anonymous', 'dpdp', 'identity', 'data', 'delete account'],
  },
  {
    id: 'faq_offline_queue',
    question: 'Can I report issues when offline or with poor network?',
    answer:
      'Yes! Reports captured without an internet connection are saved to your phone’s local SQLite queue and automatically synchronize with the server once connectivity is restored.',
    category: 'reporting',
    keywords: ['offline', 'no internet', 'network', 'draft', 'sync', 'queue', 'connectivity'],
  },
  {
    id: 'faq_lite_mode',
    question: 'What is Lite Mode and how do I enable it?',
    answer:
      'Lite Mode reduces RAM, background animations, and mobile data usage for budget smartphones. You can toggle Lite Mode anytime in your Profile & Legal settings.',
    category: 'performance',
    keywords: ['lite mode', 'slow phone', 'ram', 'battery', 'data saver', 'performance'],
  },
  {
    id: 'faq_voice_reporting',
    question: 'How does voice reporting work in regional languages?',
    answer:
      'Tap the microphone icon on the report screen to speak in Kannada, Hindi, Tamil, Telugu, Malayalam, or English. On-device models transcribe and extract the category automatically.',
    category: 'reporting',
    keywords: ['voice', 'microphone', 'speak', 'kannada', 'hindi', 'regional', 'language'],
  },
  {
    id: 'faq_trust_score',
    question: 'How is my Civic Trust Score calculated?',
    answer:
      'Your trust score increases when your submissions are verified and resolved by municipal staff. Consistent, accurate reporting gives your reports higher priority in the triage queue.',
    category: 'rewards',
    keywords: ['trust score', 'reputation', 'score', 'badge', 'points', 'streak'],
  },
];

/**
 * Calculates keyword overlap and string similarity between user query and FAQ entries.
 */
export function queryFAQAssistant(userQuery: string): FAQMatchResult {
  const query = (userQuery || '').toLowerCase().trim();
  if (!query || query.length < 3) {
    return {
      matched: false,
      confidence: 0,
      allMatches: [],
      fallbackToSupport: false,
    };
  }

  const queryWords = query.split(/\s+/);
  const scored = FAQ_KNOWLEDGE_BASE.map((entry) => {
    let score = 0;

    // Check direct substring matches
    if (entry.question.toLowerCase().includes(query)) {
      score += 0.8;
    }

    // Check keyword matches
    for (const kw of entry.keywords) {
      if (query.includes(kw)) {
        score += 0.35;
      }
      for (const qw of queryWords) {
        if (kw === qw) {
          score += 0.25;
        }
      }
    }

    // Check word matches in answer
    const answerLower = entry.answer.toLowerCase();
    for (const qw of queryWords) {
      if (qw.length > 3 && answerLower.includes(qw)) {
        score += 0.1;
      }
    }

    return { entry, score: Math.min(1.0, score) };
  });

  scored.sort((a, b) => b.score - a.score);

  const best = scored[0];
  const matched = best && best.score >= 0.35;
  const filteredMatches = scored.filter((s) => s.score >= 0.35).map((s) => s.entry);

  return {
    matched,
    bestMatch: matched ? best.entry : undefined,
    confidence: best ? best.score : 0,
    allMatches: filteredMatches,
    fallbackToSupport: !matched,
  };
}
