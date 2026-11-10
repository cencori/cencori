/**
 * Layer 1 of the moderation pipeline: pattern rules.
 *
 * Free, local and sub-millisecond, so it runs on every input. It targets the
 * fraud and abuse that general moderation models miss, in the way people
 * actually write in Nigeria: English, Pidgin, Yoruba, Igbo and Hausa slang.
 *
 * Each rule adds a weight (0–1) to one or more categories. Weights for the same
 * category combine as independent evidence: score = 1 − Π(1 − w). One weak
 * signal stays low; several together cross the flag threshold. Rules that look
 * like an ask ("send your OTP") are skipped when negated ("never send your OTP").
 */

import type { ModerationCategory } from './categories';

export const RULES_VERSION = 'cencori-rules-2026-11-10';

export interface RuleMatch {
    rule: string;
    category: ModerationCategory;
    weight: number;
    /** The matched text, trimmed to 80 chars. */
    text: string;
}

export interface RulesResult {
    scores: Partial<Record<ModerationCategory, number>>;
    matches: RuleMatch[];
}

interface Rule {
    id: string;
    pattern: RegExp;
    weights: Partial<Record<ModerationCategory, number>>;
    /** Skip the match when a negation ("never", "don't", "no") comes just before it. */
    negatable?: boolean;
    /** Also try the de-leeted text (0→o, 1→i, @→a…). Off for rules that match digits. */
    leet?: boolean;
}

// ── Shared vocab ────────────────────────────────────────────────────────────

const BANKS =
    'opay|palm ?pay|moniepoint|kuda|gtb|gtbank|guaranty trust|access ?bank|zenith|uba|first ?bank|fbn|wema|alat|sterling|fcmb|union ?bank|polaris|fidelity|ecobank|stanbic|keystone|providus|jaiz|unity ?bank|carbon|fairmoney|vbank|paga|chipper|moniepont|9 ?psb|mtn momo|momo psb|smartcash';
const ETHNIC =
    'igbo|ibo|yoruba|yorubas|hausa|fulani|ijaw|efik|ibibio|urhobo|edo|bini|tiv|kanuri|itsekiri|igala|idoma|nupe|northerners?|southerners?|easterners?|westerners?|aboki|biafrans?|nigerians?|ghanaians?';
const ACCOUNT_WORDS = '(?:account|acct|acc|a\\/c|wallet|number|details|opay|palm ?pay|moniepoint|kuda)';
const PRONOUN = '(?:my|me|this|dis|our|the|una|i|we)';
const NEG = /\b(?:never|don'?t|do not|dont|no|not|nor|shouldn'?t|must not|no dey|no go|avoid|beware of|stop)\b[^.!?\n]{0,15}$/;

const r = (src: string) => new RegExp(src, 'i');

const RULES: Rule[] = [
    // ── Phishing ──────────────────────────────────────────────────────────
    {
        id: 'credential_request',
        pattern: r(
            `\\b(?:send|give|share|drop|tell|forward|provide|input|enter|type|show|read out|what(?:'s| is)|wetin be)\\b[^.!?\\n]{0,30}\\b(?:otp|o\\.t\\.p|one[- ]time (?:pass(?:word|code)|pin)|pin|password|passcode|bvn|nin|cvv|card (?:details|number)|atm card|login(?: details)?|verification code|security code|recovery code|seed phrase|code (?:wey|that|which) (?:dem|they) (?:send|sent))\\b`,
        ),
        weights: { 'fraud/phishing': 0.85 },
        negatable: true,
        leet: true,
    },
    {
        id: 'credential_mention',
        pattern: r('\\b(?:otp|bvn|cvv|seed phrase|card pin|atm pin)\\b'),
        weights: { 'fraud/phishing': 0.25 },
        negatable: true,
        leet: true,
    },
    {
        id: 'verify_account',
        pattern: r('\\b(?:verify|confirm|reactivate|unlock|restore|update|validate)\\b[^.!?\\n]{0,25}\\b(?:your|ur|you) (?:account|wallet|profile|bvn|details)\\b'),
        weights: { 'fraud/phishing': 0.45, 'fraud/impersonation': 0.2 },
        leet: true,
    },
    {
        id: 'account_threat',
        pattern: r('\\b(?:your|ur) (?:account|wallet|profile) (?:has been|have been|will be|is being|is|don|go)\\s*(?:suspended|banned|blocked|flagged|deactivated|locked|restricted|closed|deleted)\\b'),
        weights: { 'fraud/impersonation': 0.45, 'fraud/phishing': 0.35 },
        leet: true,
    },
    {
        id: 'link_shortener',
        pattern: r('\\b(?:bit\\.ly|tinyurl\\.com|cutt\\.ly|rb\\.gy|is\\.gd|t\\.co|shorturl\\.at|tiny\\.cc|ow\\.ly|rebrand\\.ly)\\/'),
        weights: { 'fraud/phishing': 0.35 },
    },

    // ── Off-platform payment ──────────────────────────────────────────────
    {
        id: 'bank_name',
        pattern: r(`\\b(?:${BANKS})\\b`),
        weights: { 'fraud/off_platform_payment': 0.3 },
    },
    {
        id: 'payment_to_personal_account',
        pattern: r(`\\b(?:send|sen|transfer|pay|credit|deposit|drop|wire)\\b[^.!?\\n]{0,25}\\b(?:to|into|for|enter|inside)?\\s*${PRONOUN}\\s+${ACCOUNT_WORDS}\\b`),
        weights: { 'fraud/off_platform_payment': 0.6 },
        negatable: true,
        leet: true,
    },
    {
        id: 'account_details_phrase',
        pattern: r('\\b(?:acct?\\.? ?(?:no|num|number|details)|account (?:no|num|number|details|name)|a\\/c (?:no|number)|acc no|bank details)\\b'),
        weights: { 'fraud/off_platform_payment': 0.35 },
        leet: true,
    },
    {
        id: 'nuban_account_number',
        // 10 digits, optionally spaced or dashed. Phone numbers (11 digits) are handled below.
        pattern: /(?<![\d+])(?:\d[\s.-]?){9}\d(?![\d])/,
        weights: { 'fraud/off_platform_payment': 0.35 },
    },
    {
        id: 'crypto_address',
        pattern: /\b(?:0x[a-fA-F0-9]{40}|bc1[a-z0-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|T[1-9A-HJ-NP-Za-km-z]{33})\b/,
        weights: { 'fraud/off_platform_payment': 0.6 },
    },
    {
        id: 'crypto_payment_words',
        pattern: r('\\b(?:usdt|bitcoin|btc|binance p2p|bybit p2p|trc20|erc20|gift ?cards?|itunes card|steam card|amazon card)\\b'),
        weights: { 'fraud/off_platform_payment': 0.25 },
        leet: true,
    },

    // ── Off-platform contact ──────────────────────────────────────────────
    {
        id: 'ng_phone_number',
        pattern: /(?<![\d])(?:\+?234[\s.-]?|0)[789][01](?:[\s.-]?\d){8}(?![\d])/,
        weights: { 'fraud/off_platform_contact': 0.6 },
    },
    {
        id: 'intl_phone_number',
        pattern: /(?<![\d])\+(?!234)\d{1,3}(?:[\s.-]?\d){7,12}(?![\d])/,
        weights: { 'fraud/off_platform_contact': 0.45 },
    },
    {
        id: 'spelled_out_number',
        pattern: r('\\b(?:(?:zero|oh|one|two|three|four|five|six|seven|eight|nine)[\\s,.-]*){8,}'),
        weights: { 'fraud/off_platform_contact': 0.55 },
    },
    {
        id: 'messaging_app',
        pattern: r('\\b(?:whatsapp|whatsap|watsapp|watsap|wassap|wa\\.me|telegram|t\\.me|signal app|snapchat|imo app)\\b'),
        weights: { 'fraud/off_platform_contact': 0.35 },
        leet: true,
    },
    {
        id: 'move_off_platform',
        pattern: r('\\b(?:dm|text|chat|add|message|holla|hit|reach|call|contact|ping|buzz|find)\\s+(?:me|us)\\b[^.!?\\n]{0,15}\\b(?:on|via|for|through|thru|for my)\\b\\s*(?:whatsapp|watsapp|wa|telegram|tg|ig|insta|instagram|snap|snapchat|tiktok|x|twitter|facebook|fb|my number|dis number|this number)\\b'),
        weights: { 'fraud/off_platform_contact': 0.55 },
        leet: true,
    },

    // ── Advance fee / pay-to-receive ──────────────────────────────────────
    {
        id: 'send_to_receive',
        pattern: r('\\b(?:send|pay|transfer|drop|deposit)\\b[^.!?\\n]{0,30}\\b(?:receive|get|collect|recieve|earn|cash ?out|go get|go collect|you go see)\\b[^.!?\\n]{0,30}(?:\\d|double|triple|back|10x|5x|2x)'),
        weights: { 'fraud/advance_fee': 0.75, 'fraud/investment': 0.3 },
        leet: true,
    },
    {
        id: 'fee_to_release',
        pattern: r('\\b(?:processing|release|clearance|registration|activation|delivery|transfer|unlock|withdrawal|verification|tax|cot|upgrade|connection|connect|joining)\\s+(?:fee|fees|charge|charges)\\b'),
        weights: { 'fraud/advance_fee': 0.45 },
        leet: true,
    },
    {
        id: 'you_won',
        pattern: r("\\b(?:you(?:'ve| have)? won|you don win|you are (?:the |our )?(?:lucky )?winner|lucky winner|congratulations?,? you(?:'ve| have)? been selected|you have been selected)\\b"),
        weights: { 'fraud/advance_fee': 0.45, 'fraud/giveaway': 0.25 },
        leet: true,
    },
    {
        id: 'inheritance_grant',
        pattern: r('\\b(?:inheritance|next of kin|unclaimed (?:funds|money|fund)|dormant account|deceased (?:client|customer)|foreign (?:contract|transfer)|consignment box|diplomat|cbn grant|fg grant|federal government grant|empowerment (?:fund|grant|scheme)|lottery|jackpot winner)\\b'),
        weights: { 'fraud/advance_fee': 0.45 },
        leet: true,
    },

    // ── Investment / Ponzi / betting ──────────────────────────────────────
    {
        id: 'double_money',
        pattern: r('\\b(?:double|triple|multiply)\\s+(?:your|ur|you|una|my)?\\s*(?:money|cash|investment|funds?|naira|capital|coins)\\b|\\b(?:money|cash|naira) (?:doubl(?:ing|er|e)|flip(?:ping)?)\\b|\\bflip (?:your|ur) (?:money|cash)\\b'),
        weights: { 'fraud/investment': 0.75 },
        leet: true,
    },
    {
        id: 'guaranteed_returns',
        pattern: r('\\b(?:guaranteed|guarantee|sure|100%|risk[- ]free|no risk|zero risk)\\s*(?:daily |weekly |monthly )?(?:profit|returns?|income|interest|roi|payout|win|odds|banker)\\b'),
        weights: { 'fraud/investment': 0.6 },
        leet: true,
    },
    {
        id: 'invest_and_earn',
        pattern: r('\\b(?:invest|put in|drop|deposit)\\b[^.!?\\n]{0,30}\\b(?:get|receive|collect|earn|make|cash ?out|withdraw)\\b[^.!?\\n]{0,30}(?:\\d+\\s*(?:%|percent|k|m|x)|double|triple|daily|weekly|every (?:day|week))'),
        weights: { 'fraud/investment': 0.6 },
        leet: true,
    },
    {
        id: 'ponzi_terms',
        pattern: r('\\b(?:ponzi|mmm|cbex|crowd ?funding scheme|daily roi|roi daily|forex signals?|account management|mining pool|recharge and earn|task and earn)\\b'),
        weights: { 'fraud/investment': 0.4 },
        leet: true,
    },
    {
        id: 'betting_tips',
        pattern: r('\\b(?:sure (?:odds|banker|tips?|games?)|fixed (?:match|matches|games?|odds)|betting tips|booking codes?|sure 2 odds|rollover tips|vip (?:tips|odds|games))\\b'),
        weights: { 'fraud/investment': 0.5 },
        leet: true,
    },

    // ── Giveaways ─────────────────────────────────────────────────────────
    {
        id: 'giveaway',
        pattern: r('\\bgive ?away\\b|\\bairdrop\\b'),
        weights: { 'fraud/giveaway': 0.35 },
        leet: true,
    },
    {
        id: 'first_n_people',
        pattern: r('\\b(?:first|1st)\\s+\\d+\\s+(?:people|persons?|users?|players?|to (?:dm|comment|reply|send|message|join))\\b'),
        weights: { 'fraud/giveaway': 0.35 },
    },
    {
        id: 'claim_reward',
        pattern: r('\\b(?:claim|collect|redeem|withdraw)\\b[^.!?\\n]{0,20}\\b(?:reward|prize|gift|bonus|airdrop|free (?:money|cash|naira|coins))\\b'),
        weights: { 'fraud/giveaway': 0.45 },
        leet: true,
    },
    {
        id: 'free_money_amount',
        pattern: r('\\bfree\\b[^.!?\\n]{0,15}(?:₦|\\bn)?\\d[\\d,.]*\\s*(?:k|m|b|bn|naira|million|billion|thousand)\\b'),
        weights: { 'fraud/giveaway': 0.45 },
    },

    // ── Impersonation ─────────────────────────────────────────────────────
    {
        id: 'claims_staff',
        pattern: r("\\b(?:i am|i'm|im|i be|this is|we are|we're|na me be|na we be|message from|from the)\\b[^.!?\\n]{0,20}\\b(?:admin|administrator|moderator|support team|support staff|customer care|customer service|staff|dev team|developer|official team|game master|gm team|management)\\b"),
        weights: { 'fraud/impersonation': 0.5 },
        leet: true,
    },
    {
        id: 'agency_threat',
        pattern: r('\\b(?:efcc|cbn|central bank|police|dss|interpol|nimc|ndlea|icpc|court order)\\b[^.!?\\n]{0,40}\\b(?:arrest|fine|pay|unblock|freeze|frozen|warrant|clear your name|settle)\\b'),
        weights: { 'fraud/impersonation': 0.55, 'fraud/advance_fee': 0.25 },
        leet: true,
    },

    // ── Romance ───────────────────────────────────────────────────────────
    {
        id: 'sugar_connect',
        pattern: r('\\bsugar (?:mummy|mommy|mama|daddy|papa|baby)\\b|\\b(?:hookup|hook[- ]up|runs) connect\\b'),
        weights: { 'fraud/romance': 0.6 },
        leet: true,
    },
    {
        id: 'personal_money_ask',
        pattern: r('\\b(?:send|give|borrow|lend|dash|help)\\b\\s*(?:me|mi)\\b[^.!?\\n]{0,25}\\b(?:transport|t-?fare|transport fare|airtime|recharge card|data|small money|something small|urgent \\d+k?|hospital bill|school fees|rent)\\b'),
        weights: { 'fraud/romance': 0.35 },
        leet: true,
    },
    {
        id: 'term_of_endearment',
        pattern: r('\\b(?:my love|babe|baby|darling|sweetheart|my dear|honey|bae|my king|my queen)\\b'),
        weights: { 'fraud/romance': 0.15 },
    },

    // ── Real-money trading ────────────────────────────────────────────────
    {
        id: 'trade_game_assets',
        pattern: r('\\b(?:sell(?:ing)?|buy(?:ing)?|trade|trading|swap|exchange|cash ?out|convert)\\b[^.!?\\n]{0,25}\\b(?:game (?:money|cash|naira|coins?|currency|gold|items?)|in-?game (?:money|cash|currency|naira|items?)|coins|gems|diamonds|credits|tokens|gold)\\b[^.!?\\n]{0,30}\\b(?:real (?:money|cash|naira)|naira|transfer|bank|usdt|cash)\\b'),
        weights: { 'fraud/real_money_trading': 0.65 },
        leet: true,
    },
    {
        id: 'account_for_sale',
        pattern: r('\\b(?:account|acct|acc|id|profile) (?:for sale|dey for sale|available for sale|up for sale)\\b|\\bselling (?:my |this |dis )?(?:game )?(?:account|acct|acc)\\b|\\bbuy (?:my |this |dis )?(?:game )?(?:account|acct|acc)\\b'),
        weights: { 'fraud/real_money_trading': 0.6 },
        leet: true,
    },
    {
        id: 'real_money_words',
        pattern: r('\\b(?:real (?:money|cash|naira)|withdraw(?:al)? to (?:your |my )?(?:bank|account)|cash ?out to (?:bank|account))\\b'),
        weights: { 'fraud/real_money_trading': 0.4 },
        leet: true,
    },

    // ── Cybercrime / yahoo ────────────────────────────────────────────────
    {
        id: 'yahoo',
        pattern: r('\\byahoo[\\s-]?(?:yahoo|boys?|plus|\\+|format|work|business|biz|guy)\\b|\\byahoo\\+'),
        weights: { 'fraud/cybercrime': 0.7 },
        leet: true,
    },
    {
        id: 'scam_format',
        pattern: r('\\b(?:billing|dating|military|investment|crypto|gift ?card|bitcoin|hookup|inheritance|loan|bank)\\s+formats?\\b|\\bformats?\\b[^.!?\\n]{0,20}\\b(?:client|maga|mugu|mgbada)\\b'),
        weights: { 'fraud/cybercrime': 0.75 },
        leet: true,
    },
    {
        id: 'maga_paid',
        pattern: r('\\b(?:maga|mugu|mgbada)\\b[^.!?\\n]{0,20}\\b(?:pay|paid|don pay|don drop|drop|bill|billed|picking)\\b|\\bpicking\\b[^.!?\\n]{0,15}\\b(?:client|maga|format)\\b'),
        weights: { 'fraud/cybercrime': 0.65 },
        leet: true,
    },
    {
        id: 'money_ritual',
        pattern: r('\\b(?:money ritual|ritual money|blood money|oke ite|osole|ogwu ego|juju for money|sakawa|yahoo plus|native doctor for money)\\b'),
        weights: { 'fraud/cybercrime': 0.7 },
        leet: true,
    },
    {
        id: 'carding_logs',
        pattern: r('\\b(?:carding|cc dumps?|fullz|cvv shop|bank logs?|logs for sale|cashapp logs|hacked (?:fb|facebook|ig|instagram|whatsapp|tiktok) accounts?)\\b'),
        weights: { 'fraud/cybercrime': 0.75 },
        leet: true,
    },
    {
        id: 'hustle_slang',
        pattern: r('\\b(?:g[- ]?boy|hustle kit|client (?:don|has) (?:pay|paid|drop))\\b'),
        weights: { 'fraud/cybercrime': 0.35 },
        leet: true,
    },

    // ── Cheating / exploits ───────────────────────────────────────────────
    {
        id: 'money_glitch',
        pattern: r('\\b(?:money|cash|naira|coins?|gems?|xp|energy)\\s*(?:glitch|hack|cheat|exploit|bug|generator|gen|duplication|dupe)\\b|\\b(?:glitch|hack|exploit|cheat|dupe)\\b[^.!?\\n]{0,20}\\b(?:money|cash|naira|coins|unlimited|infinite)\\b'),
        weights: { 'cheating/exploit': 0.7 },
        leet: true,
    },
    {
        id: 'unlimited_resources',
        pattern: r('\\b(?:unlimited|infinite)\\s+(?:money|cash|naira|coins|energy|gems|diamonds)\\b'),
        weights: { 'cheating/exploit': 0.5 },
        leet: true,
    },
    {
        id: 'cheat_tools',
        pattern: r('\\b(?:mod ?apk|modded (?:apk|version|game)|cheat engine|aimbot|auto ?clicker|game ?guardian|speed ?hack|hack (?:tool|script|version))\\b'),
        weights: { 'cheating/exploit': 0.5 },
        leet: true,
    },

    // ── Ethnic hate ───────────────────────────────────────────────────────
    {
        id: 'ethnic_slur',
        pattern: r('\\b(?:nyamiri|ofe ?mmanu|gambari|ngwa ngwa ibo|hausa goat|fulani cow|aboki goat|ibo thief|igbo thief|yoruba demon|yoruba ritualist)\\b'),
        weights: { 'hate/ethnic': 0.75, hate: 0.6 },
        leet: true,
    },
    {
        id: 'ethnic_generalisation',
        pattern: r(`\\b(?:all|una|those|these|dem|every|una all)?\\s*(?:${ETHNIC})\\s*(?:people|men|boys|girls|women|folks)?\\s+(?:are|na|be|dey|is)\\s+(?:all\\s+|just\\s+|only\\s+)?(?:thieves|thief|ole|oles|criminals?|ritualists?|terrorists?|killers?|animals?|goats?|cows?|fools?|idiots?|dirty|useless|evil|scammers?|fraudsters?|beggars?|cowards?|slaves?|monkeys?|bastards?|parasites?|cursed)\\b`),
        weights: { 'hate/ethnic': 0.75, hate: 0.6 },
        leet: true,
    },
    {
        id: 'ethnic_violence',
        pattern: r(`\\b(?:kill|wipe out|chase out|send back|burn|deal with|finish|slaughter|exterminate)\\s+(?:all\\s+)?(?:the\\s+|dis\\s+|these\\s+|those\\s+)?(?:${ETHNIC})\\b`),
        weights: { 'hate/ethnic': 0.9, hate: 0.8, 'hate/threatening': 0.8 },
        leet: true,
    },

    // ── Harassment in Pidgin / Yoruba / Igbo / Hausa ──────────────────────
    {
        id: 'local_insult',
        pattern: r('\\b(?:werey|weyrey|mumu|olodo|ode|oloriburuku|agbaya|apari|ewure|efulefu|onye ara|ewu|dan iska|your head no correct|you dey craze|mugun|yeye (?:boy|girl|person|man))\\b'),
        weights: { harassment: 0.35 },
        leet: true,
    },
    {
        id: 'local_sexual_insult',
        pattern: r('\\b(?:ashawo|ashewo|olosho|oloshi|omo ale|ashi|karuwa|akwuna)\\b'),
        weights: { harassment: 0.55 },
        leet: true,
    },
    {
        id: 'pidgin_threat',
        pattern: r("\\b(?:i go|i will|i'll|we go|we will|i fit|make i)\\s+(?:kill|wound|beat|deal with|finish|slap|stab|shoot|burn|wreck|scatter|break)\\s+(?:you|u|una|ur|your|ya)\\b|\\bi (?:know|sabi) where (?:you|u) (?:dey|live|stay)\\b|\\bi go (?:find|catch) (?:you|u)\\b"),
        weights: { 'harassment/threatening': 0.7, harassment: 0.5, violence: 0.4 },
        leet: true,
    },

    // ── Sexual (Pidgin) and child safety ──────────────────────────────────
    {
        id: 'pidgin_sexual',
        pattern: r('\\b(?:knack|nack|ikebe|toto|preeq|blow ?job|send nudes|nudes)\\b'),
        weights: { sexual: 0.5 },
        leet: true,
    },
    {
        id: 'picture_request',
        pattern: r('\\b(?:send|show|snap)\\b[^.!?\\n]{0,15}\\b(?:nudes?|naked|pics? of (?:you|ur|your)|your (?:pic|picture|photo|body)|ur (?:pic|picture|photo|body)|bra|pant(?:s|ies)?)\\b'),
        weights: { 'child_safety/grooming': 0.4, sexual: 0.3 },
        leet: true,
    },
    {
        id: 'secrecy_request',
        pattern: r("\\b(?:don'?t|do not|no)\\s+(?:tell|show|let)\\s+(?:your|ur)\\s+(?:parents?|mum|mom|mummy|mommy|dad|daddy|father|mother|teacher|guardian)\\b|\\bour (?:little )?secret\\b|\\bdelete (?:this|our|the) (?:chat|messages?)\\b"),
        weights: { 'child_safety/grooming': 0.55 },
        leet: true,
    },
    {
        id: 'age_probe',
        pattern: r("\\b(?:how old are (?:you|u)|wetin be your age|what(?:'s| is) your age|what class are you|which class you dey|are (?:you|u) (?:alone|home alone)|you dey alone)\\b"),
        weights: { 'child_safety/grooming': 0.25 },
        leet: true,
    },
    {
        id: 'meet_in_person',
        pattern: r('\\b(?:come to|come meet me (?:at|in)|visit me (?:at|in)|meet (?:me )?(?:irl|in person|offline|at my)|come (?:my|to my) (?:house|place|hotel|room))\\b'),
        weights: { 'child_safety/grooming': 0.3 },
        leet: true,
    },
];

// ── Text preparation ────────────────────────────────────────────────────────

export function normalize(text: string): string {
    return text
        .normalize('NFKC')
        .replace(/[​-‍⁠﻿­]/g, '')
        .replace(/\s+/g, ' ')
        .toLowerCase();
}

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '|': 'i' };
function deLeet(text: string): string {
    return text.replace(/[013457@$|]/g, (c) => LEET[c] ?? c);
}

function isNegated(text: string, index: number): boolean {
    return NEG.test(text.slice(Math.max(0, index - 30), index));
}

function snippet(text: string): string {
    const t = text.trim();
    return t.length > 80 ? `${t.slice(0, 77)}...` : t;
}

/** Signals that a fraud category is being run through an outside channel. */
const OFF_PLATFORM: ModerationCategory[] = ['fraud/off_platform_contact', 'fraud/off_platform_payment'];
const FRAUD_PREFIX = 'fraud/';

// ── Scoring ─────────────────────────────────────────────────────────────────

export interface RulesOptions {
    /** The customer's own brand and product names, to catch staff impersonation. */
    brandNames?: string[];
}

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const brandRuleCache = new Map<string, Rule[]>();
function brandRules(names: string[] | undefined): Rule[] {
    const clean = (names ?? []).map((n) => normalize(n).trim()).filter((n) => n.length >= 2).slice(0, 20);
    if (!clean.length) return [];
    const key = clean.join('\u0000');
    const cached = brandRuleCache.get(key);
    if (cached) return cached;
    const alt = clean.map((n) => escapeRegex(n).replace(/\s+/g, '\\s*')).join('|');
    const rules: Rule[] = [
        {
            id: 'brand_staff_claim',
            pattern: r(`(?:${alt})\\s*(?:'s\\s*)?(?:admin|administrator|moderator|support|customer care|customer service|staff|team|official|management|developer|dev team|ceo|founder)\\b|\\b(?:admin|moderator|support|staff|team|ceo|founder|official)\\s+(?:of|for|from|at)\\s+(?:${alt})`),
            weights: { 'fraud/impersonation': 0.6 },
            leet: true,
        },
    ];
    if (brandRuleCache.size > 500) brandRuleCache.clear();
    brandRuleCache.set(key, rules);
    return rules;
}

export function runRules(input: string, options: RulesOptions = {}): RulesResult {
    const base = normalize(input);
    if (!base.trim()) return { scores: {}, matches: [] };
    const leet = deLeet(base);

    const evidence = new Map<ModerationCategory, number[]>();
    const matches: RuleMatch[] = [];

    for (const rule of [...RULES, ...brandRules(options.brandNames)]) {
        let m = rule.pattern.exec(base);
        let source = base;
        if (!m && rule.leet && leet !== base) {
            m = rule.pattern.exec(leet);
            source = leet;
        }
        if (!m) continue;
        if (rule.negatable && isNegated(source, m.index)) continue;

        for (const [category, weight] of Object.entries(rule.weights) as [ModerationCategory, number][]) {
            const list = evidence.get(category) ?? [];
            list.push(weight);
            evidence.set(category, list);
            matches.push({ rule: rule.id, category, weight, text: snippet(m[0]) });
        }
    }

    // A scam that also moves the victim off-platform (phone, WhatsApp, bank
    // account) is much more likely to be real: add that as extra evidence.
    const offPlatform = OFF_PLATFORM.some((c) => evidence.has(c));
    if (offPlatform) {
        for (const [category, list] of evidence) {
            if (category.startsWith(FRAUD_PREFIX) && !OFF_PLATFORM.includes(category)) list.push(0.3);
        }
    }
    // A payment ask that comes with a phone number or app handle is a payment
    // scam signal on its own.
    if (evidence.has('fraud/off_platform_payment') && evidence.has('fraud/off_platform_contact')) {
        evidence.get('fraud/off_platform_payment')!.push(0.25);
    }

    const scores: Partial<Record<ModerationCategory, number>> = {};
    for (const [category, list] of evidence) {
        const miss = list.reduce((acc, w) => acc * (1 - w), 1);
        scores[category] = round(Math.min(0.99, 1 - miss));
    }

    let fraud = 0;
    for (const [category, score] of Object.entries(scores)) {
        if (category.startsWith(FRAUD_PREFIX) && category !== 'fraud/off_platform_contact') fraud = Math.max(fraud, score ?? 0);
    }
    if (fraud > 0) scores.fraud = fraud;

    return { scores, matches };
}

function round(n: number): number {
    return Math.round(n * 1000) / 1000;
}
