import { describe, expect, test } from 'vitest';
import { runRules } from '@/lib/moderation/rules';
import { moderate, normalizeInput, ModerationInputError } from '@/lib/moderation';
import { DEFAULT_FLAG_THRESHOLD } from '@/lib/moderation/categories';

const flaggedBy = (text: string) =>
    Object.entries(runRules(text).scores)
        .filter(([, s]) => (s ?? 0) >= DEFAULT_FLAG_THRESHOLD)
        .map(([c]) => c);

// Each sample must be flagged for the listed category.
const SCAMS: [string, string][] = [
    ['Abeg send me the OTP wey dem send to your phone make I credit you', 'fraud/phishing'],
    ['Pls share your BVN and card details to verify your account', 'fraud/phishing'],
    ['Send 5k to my opay 8123456789 and receive 50k back in 1 hour', 'fraud/advance_fee'],
    ['send 2000 naira, you go collect 20000 back sharp sharp', 'fraud/advance_fee'],
    ['Transfer to my account 0123456789 GTBank, name Chidi O', 'fraud/off_platform_payment'],
    ['DM me on WhatsApp 08031234567 for the cheapest coins', 'fraud/off_platform_contact'],
    ['add me for whatsapp zero eight zero three one two three four five six seven', 'fraud/off_platform_contact'],
    ['Double your money in 24 hours, guaranteed profit, no risk', 'fraud/investment'],
    ['Invest 10k and get 30% daily returns, message me', 'fraud/investment'],
    ['Sure odds today 100% banker, buy booking code now', 'fraud/investment'],
    ['GIVEAWAY!! first 50 people to dm me get free 100k, claim your reward', 'fraud/giveaway'],
    ["I'm from the Lagos Life support team, your account has been suspended. Verify your account now", 'fraud/impersonation'],
    ['EFCC will arrest you unless you pay the fine today', 'fraud/impersonation'],
    ['Sugar mummy connect available, pay connection fee of 10k', 'fraud/romance'],
    ['Selling 50 million game naira for 5k real money, transfer to my opay', 'fraud/real_money_trading'],
    ['Account for sale, level 40 with house and car, pay into my kuda', 'fraud/real_money_trading'],
    ['who get billing format for client? maga don pay', 'fraud/cybercrime'],
    ['yahoo plus boys only, money ritual native doctor for money', 'fraud/cybercrime'],
    ['money glitch!! unlimited naira, use this hack', 'cheating/exploit'],
    ['all igbo people are thieves', 'hate/ethnic'],
    ['we go chase out all the hausa from lagos', 'hate/ethnic'],
    ['I go kill you if I catch you, I know where you dey', 'harassment/threatening'],
    ['you be olosho, ashawo werey', 'harassment'],
    ["don't tell your mum about our chat, send me your picture, our little secret", 'child_safety/grooming'],
    // Obfuscation
    ['s3nd y0ur 0tp n0w', 'fraud/phishing'],
    ['d0uble y0ur m0ney t0day', 'fraud/investment'],
];

// Normal game chat, warnings and banter: must not be flagged.
const CLEAN: string[] = [
    'Never share your OTP with anyone, not even staff',
    'Who wan go Quilox tonight? I just got my salary',
    'I just bought a house in Lekki, rent was 2 million game naira',
    'Abeg how I go take get more energy?',
    'My bank for the game don almost empty, I need to work more',
    'Congrats on your new car bro',
    'The danfo too slow today, traffic for Third Mainland',
    'I love Amala Shitta, best food spot in the game',
    'The Yoruba side of the map is beautiful',
    'Hausa food at the mall is sweet',
    'Send me the link to the game update notes',
    'I need to pay my rent before Friday',
    'Use the menu to check your account balance',
    'my phone battery is dying, brb',
    'This game is so fun, invest your time in the jobs',
    'how do I get a job at the bank in the game?',
    'Thank you baby, see you at the club later',
    'He scored 2 goals in the football match',
    'I dropped a pin at the mall so you can find me',
    'werey dey play, this game sweet die',
    'My level is 1234567 points',
    'Free food at the party tonight',
    'The first 3 people to reach the beach win the race',
    'Sell your old car at the dealership to get money for a new one',
    'I called customer care at the mall about my lost item',
    'The police in the game arrested a robber near Ikeja',
    'my love for this game no get part 2',
    'The account menu shows your game naira balance',
    'please send the screenshot of the bug to the devs',
];

describe('moderation rules: scams and abuse are flagged', () => {
    test.each(SCAMS)('%s → %s', (text, category) => {
        expect(flaggedBy(text)).toContain(category);
    });

    test('fraud rolls up the highest fraud/* score', () => {
        const { scores } = runRules('Double your money in 24 hours, guaranteed profit');
        expect(scores.fraud).toBe(scores['fraud/investment']);
    });
});

describe('moderation rules: normal chat is not flagged', () => {
    test.each(CLEAN)('%s', (text) => {
        expect(flaggedBy(text)).toEqual([]);
    });
});

describe('moderation pipeline', () => {
    const noOpenAI = { getOpenAI: async () => null };

    test('rules-only request returns OpenAI-shaped results with an action', async () => {
        const res = await moderate(
            ['Send 5k to my opay 8123456789 and receive 50k back', 'hello'],
            { layers: ['rules'] },
            noOpenAI,
        );
        expect(res.results).toHaveLength(2);
        expect(res.results[0].flagged).toBe(true);
        expect(res.results[0].categories['fraud/advance_fee']).toBe(true);
        expect(res.results[0].action).toBe('block');
        expect(res.results[0].matches.some((m) => m.layer === 'rules')).toBe(true);
        expect(res.results[1]).toMatchObject({ flagged: false, action: 'allow' });
        expect(res.layers).toEqual({ rules: 'ok', openai: 'skipped', llm: 'skipped' });
    });

    test('a failing OpenAI layer degrades to rules and reports it', async () => {
        const res = await moderate('Double your money today', {}, { getOpenAI: async () => null });
        expect(res.layers.openai).toBe('error');
        expect(res.errors?.[0]).toMatch(/openai/);
        expect(res.results[0].flagged).toBe(true);
    });

    test('merges OpenAI scores and honours its flags', async () => {
        const fake = {
            moderations: {
                create: async () => ({
                    id: 'modr-1',
                    model: 'omni-moderation-latest',
                    results: [
                        {
                            flagged: true,
                            categories: { harassment: true },
                            category_scores: { harassment: 0.62, violence: 0.01 },
                            category_applied_input_types: { harassment: ['text'] },
                        },
                    ],
                }),
            },
        };
        const res = await moderate('you are useless', {}, { getOpenAI: async () => fake as never });
        expect(res.model).toBe('omni-moderation-latest');
        expect(res.results[0].categories.harassment).toBe(true);
        expect(res.results[0].category_scores.harassment).toBe(0.62);
        expect(res.results[0].action).toBe('review');
    });

    test('custom thresholds tighten flagging', async () => {
        const text = 'I use whatsapp a lot';
        const loose = await moderate(text, { layers: ['rules'] }, noOpenAI);
        expect(loose.results[0].flagged).toBe(false);
        const strict = await moderate(text, { layers: ['rules'], thresholds: { 'fraud/off_platform_contact': 0.3 } }, noOpenAI);
        expect(strict.results[0].categories['fraud/off_platform_contact']).toBe(true);
    });

    test('validates input', () => {
        expect(() => normalizeInput('')).toThrow(ModerationInputError);
        expect(() => normalizeInput(Array(101).fill('x'))).toThrow(/at most 100/);
        expect(() => normalizeInput([{ type: 'image_url', image_url: { url: 'http://x' } }])).toThrow(/https/);
        expect(normalizeInput([{ type: 'text', text: 'hi' }, { type: 'image_url', image_url: { url: 'https://x/y.png' } }]))
            .toEqual([{ text: 'hi', hasImages: true }]);
    });

    test('images need the openai layer', async () => {
        await expect(
            moderate([{ type: 'image_url', image_url: { url: 'https://x/y.png' } }], { layers: ['rules'] }, noOpenAI),
        ).rejects.toThrow(/openai/);
    });
});
