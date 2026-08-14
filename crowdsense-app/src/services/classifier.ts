export type MissionTypeId = 'pothole' | 'garbage' | 'noise' | 'accessibility' | 'infrastructure';

export type ClassificationResult = MissionTypeId | 'unknown';

interface CategoryKeywords {
  id: MissionTypeId;
  keywords: string[];
}

const CATEGORY_RULES: CategoryKeywords[] = [
  {
    id: 'pothole',
    keywords: [
      'pothole',
      'potholes',
      'hole',
      'holes',
      'gaddha',
      'gaddhe',
      'gadda',
      'pit',
      'road damage',
      'broken road',
      'crater',
      'asphalt',
      'road hole',
      'tar road',
      'tarmac',
      'गड्ढा',
      'गड्ढे',
      'सड़क',
      'टूटी सड़क',
      'खड्डा',
    ],
  },
  {
    id: 'garbage',
    keywords: [
      'garbage',
      'trash',
      'kachra',
      'kuchra',
      'waste',
      'litter',
      'dump',
      'dumping',
      'filth',
      'smell',
      'stink',
      'bin',
      'plastic',
      'rubbish',
      'dirt',
      'कचरा',
      'कूड़ा',
      'गंदगी',
      'बदबू',
      'प्लास्टिक',
    ],
  },
  {
    id: 'noise',
    keywords: [
      'noise',
      'loud',
      'shor',
      'horn',
      'horns',
      'speaker',
      'speakers',
      'sound',
      'music',
      'decibel',
      'blast',
      'dj',
      'firecracker',
      ' शोर',
      'आवाज',
      'डीजे',
      'लाउडस्पीकर',
      'हॉर्न',
    ],
  },
  {
    id: 'accessibility',
    keywords: [
      'accessibility',
      'accessible',
      'ramp',
      'wheelchair',
      'sidewalk',
      'footpath',
      'blind',
      'barrier',
      'stairs',
      'handicap',
      'disabled',
      'divyang',
      'pavement',
      'विकलांग',
      'फुटपाथ',
      'रैंप',
      'व्हीलचेयर',
      'सीढ़ी',
    ],
  },
  {
    id: 'infrastructure',
    keywords: [
      'infrastructure',
      'light',
      'lights',
      'pole',
      'poles',
      'wire',
      'wires',
      'pipe',
      'pipes',
      'water',
      'leak',
      'leaking',
      'bridge',
      'streetlight',
      'transformer',
      'pillar',
      'drain',
      'drainage',
      'sewer',
      'बिजली',
      'पोल',
      'पानी',
      'पाइप',
      'लाइट',
      'नाली',
      'तार',
    ],
  },
];

/**
 * On-device keyword issue text classifier.
 * Evaluates rule matches against English & Hindi keywords.
 * Swap point for future TFLite / ONNX on-device classification models.
 */
export function classifyIssueText(text: string): ClassificationResult {
  if (!text || text.trim().length === 0) {
    return 'unknown';
  }

  const normalizedText = text.toLowerCase();

  let bestMatch: MissionTypeId | 'unknown' = 'unknown';
  let highestScore = 0;

  for (const rule of CATEGORY_RULES) {
    let score = 0;
    for (const keyword of rule.keywords) {
      if (normalizedText.includes(keyword.toLowerCase())) {
        // Longer exact keyword matches get slightly higher weight
        score += keyword.length > 5 ? 2 : 1;
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = rule.id;
    }
  }

  // Require a minimum match score threshold of 1
  return highestScore > 0 ? bestMatch : 'unknown';
}
