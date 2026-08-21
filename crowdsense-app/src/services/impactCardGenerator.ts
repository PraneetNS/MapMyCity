import { Share, Platform } from 'react-native';

export interface ImpactCardData {
  type: 'resolved_issue' | 'monthly_digest';
  title: string;
  subtitle?: string;
  category?: string;
  wardName?: string;
  issueId?: string;
  beforePhotoUrl?: string;
  resolvedPhotoUrl?: string;
  stats?: {
    issuesResolved?: number;
    trustScorePercent?: number;
    streakWeeks?: number;
    neighborhoodRank?: string;
  };
  isAnonymous?: boolean;
}

/**
 * Builds share text & message payload customized for WhatsApp Status / Instagram Story / Twitter.
 */
export function buildSocialShareMessage(data: ImpactCardData): string {
  if (data.type === 'resolved_issue') {
    const categoryLabel = (data.category || 'civic issue').replace('_', ' ');
    const location = data.isAnonymous ? 'Bengaluru' : data.wardName || 'Bengaluru';
    return (
      `🎉 Verified Civic Action Fixed!\n\n` +
      `The reported ${categoryLabel} in ${location} was resolved by municipal authorities!\n\n` +
      `Mapped & verified via MapMyCity CrowdSense — real-time civic accountability.\n` +
      `👉 Join the movement: https://mapmycity.org/c/${data.issueId ? data.issueId.slice(0, 8) : 'active'}`
    );
  } else {
    const fixed = data.stats?.issuesResolved || 5;
    const trust = data.stats?.trustScorePercent || 94;
    return (
      `🌟 My Monthly Civic Impact on MapMyCity!\n\n` +
      `⚡ I helped resolve ${fixed} neighborhood issues this month.\n` +
      `🛡️ Verified Trust Score: ${trust}%\n` +
      `🔥 Active Streak: ${data.stats?.streakWeeks || 4} weeks\n\n` +
      `Transforming our city streets together with CrowdSense.\n` +
      `👉 Track your neighborhood: https://mapmycity.org`
    );
  }
}

/**
 * Invokes native system share sheet.
 */
export async function shareImpactCard(data: ImpactCardData): Promise<boolean> {
  try {
    const message = buildSocialShareMessage(data);
    const result = await Share.share({
      title: data.title,
      message,
      url: 'https://mapmycity.org',
    });

    if (result.action === Share.sharedAction) {
      return true;
    }
    return false;
  } catch (error) {
    console.error('[ImpactCardGenerator] Share error:', error);
    return false;
  }
}
