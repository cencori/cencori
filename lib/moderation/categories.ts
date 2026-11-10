/**
 * Moderation categories.
 *
 * OPENAI_CATEGORIES mirror omni-moderation-latest so responses stay drop-in
 * compatible with OpenAI's API. CENCORI_CATEGORIES are ours: fraud, scams and
 * abuse patterns OpenAI does not cover, tuned for Nigerian English, Pidgin,
 * Yoruba, Igbo and Hausa, and for games and marketplaces.
 */

export const OPENAI_CATEGORIES = [
    'harassment',
    'harassment/threatening',
    'hate',
    'hate/threatening',
    'illicit',
    'illicit/violent',
    'self-harm',
    'self-harm/intent',
    'self-harm/instructions',
    'sexual',
    'sexual/minors',
    'violence',
    'violence/graphic',
] as const;

export const CENCORI_CATEGORIES = {
    fraud: 'Any fraud or scam signal below (the highest fraud/* score).',
    'fraud/phishing': 'Asking for an OTP, PIN, password, BVN, NIN, card details or login, or a fake "verify your account".',
    'fraud/off_platform_payment': 'Moving money outside the platform: bank account numbers, transfers to a personal account, fintech wallets, crypto addresses.',
    'fraud/off_platform_contact': 'Pulling users to another channel: phone numbers, WhatsApp, Telegram and similar handles or links.',
    'fraud/advance_fee': 'Pay-to-receive scams: "send 5k and get 50k back", processing or release fees, fake winnings, inheritance and grants.',
    'fraud/investment': 'Ponzi and "double your money" schemes, guaranteed returns, sure betting odds and fixed matches.',
    'fraud/giveaway': 'Fake giveaways and reward claims ("first 50 people", "claim your free 100k").',
    'fraud/impersonation': 'Posing as staff, admins, support, a bank or an agency (EFCC, CBN, police), or fake account-suspension notices.',
    'fraud/romance': 'Romance and "sugar mummy/daddy connect" scams, and personal money requests dressed up as affection.',
    'fraud/real_money_trading': 'Selling or buying in-game currency, items or accounts for real money, or cash-out offers.',
    'fraud/cybercrime': 'Recruiting for or trading scam tools: "yahoo" formats, picking, carding, bank logs, money rituals.',
    'cheating/exploit': 'Sharing or selling money glitches, hacks, mods, bots and other exploits.',
    'hate/ethnic': 'Slurs and generalisations against Nigerian (and other) ethnic groups, which general-purpose models often miss.',
    'child_safety/grooming': 'Signals of an adult grooming a minor: secrecy requests, asking for pictures, moving to private meetings.',
} as const;

export type OpenAICategory = (typeof OPENAI_CATEGORIES)[number];
export type CencoriCategory = keyof typeof CENCORI_CATEGORIES;
export type ModerationCategory = OpenAICategory | CencoriCategory;

export const ALL_CATEGORIES: ModerationCategory[] = [
    ...OPENAI_CATEGORIES,
    ...(Object.keys(CENCORI_CATEGORIES) as CencoriCategory[]),
];

const CATEGORY_SET = new Set<string>(ALL_CATEGORIES);
export function isModerationCategory(value: string): value is ModerationCategory {
    return CATEGORY_SET.has(value);
}

/** Score at or above which a category is flagged, unless the request overrides it. */
export const DEFAULT_FLAG_THRESHOLD = 0.5;
/** Score at or above which the recommended action becomes "block". */
export const DEFAULT_BLOCK_THRESHOLD = 0.8;
