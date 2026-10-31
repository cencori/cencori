/**
 * Studio setup: the kinds of business an owner picks from, what each is
 * asked, and the instructions its assistant starts with. Restaurants use the
 * restaurant template (bookings, deposits); every other kind gets plain
 * instructions written from the answers. Client-safe: nothing here touches
 * the server.
 */

import { RESTAURANT_DEFAULTS, restaurantInstructions } from "@/lib/embedded/templates";

export type BusinessKind = "restaurant" | "shop" | "salon" | "clinic" | "services" | "other";

export const BUSINESS_KINDS: Array<{ id: BusinessKind; name: string; hint: string; noun: string }> = [
    { id: "restaurant", name: "Restaurant or lounge", hint: "Bookings, menu, deposits", noun: "restaurant" },
    { id: "shop", name: "Shop", hint: "Orders, prices, delivery", noun: "shop" },
    { id: "salon", name: "Salon or beauty", hint: "Appointments, services", noun: "salon" },
    { id: "clinic", name: "Clinic", hint: "Appointments, questions", noun: "clinic" },
    { id: "services", name: "Services", hint: "Quotes, bookings, leads", noun: "business" },
    { id: "other", name: "Something else", hint: "Answer customer questions", noun: "business" },
];

export type AnswerKey = "name" | "venue" | "offer" | "address" | "hours" | "phone" | "list" | "deposit";

export interface SetupQuestion {
    key: AnswerKey;
    ask: (answers: Partial<Record<AnswerKey, string>>) => string;
    placeholder: string;
    /** Quick answers shown as chips. */
    choices?: string[];
    optional?: boolean;
    long?: boolean;
}

const LIST_QUESTION: Record<BusinessKind, string> = {
    restaurant: "Paste your menu with prices. Anything is fine: a list, a copied message, even rough notes.",
    shop: "Paste your price list: what you sell and how much.",
    salon: "Paste your services and prices.",
    clinic: "What services do you offer, and what do they cost?",
    services: "Paste your services and prices, or how you usually quote.",
    other: "What should your assistant know? Prices, policies, anything customers ask about.",
};

/** One question at a time, in order; optional ones can be skipped. */
export function setupQuestions(kind: BusinessKind): SetupQuestion[] {
    return [
        { key: "name", ask: () => "What's the business called?", placeholder: "Arcie Lounge" },
        ...(kind === "restaurant"
            ? [{ key: "venue" as const, ask: () => "Is it a restaurant, lounge, bar or café?", placeholder: "Lounge", choices: ["Restaurant", "Lounge", "Bar", "Café"] }]
            : [{ key: "offer" as const, ask: () => "In a sentence, what do you sell or do?", placeholder: kind === "shop" ? "Women's clothing and shoes, delivered in Lagos" : "Braids, nails and lashes" }]),
        { key: "address", ask: (a) => `Where is ${a.name || "it"}?`, placeholder: "14 Admiralty Way, Lekki", optional: true },
        { key: "hours", ask: () => "When are you open?", placeholder: "Tue–Sun, 5pm–2am", optional: true },
        { key: "phone", ask: () => "What number can customers call?", placeholder: "0803 123 4567", optional: true },
        { key: "list", ask: () => LIST_QUESTION[kind], placeholder: "Jollof rice ₦6,500…", optional: true, long: true },
        ...(kind === "restaurant"
            ? [{ key: "deposit" as const, ask: () => "Do you take a deposit for table bookings?", placeholder: "₦20,000, taken off the bill", choices: ["No deposit"], optional: true }]
            : []),
    ];
}

const VENUE: Record<string, "restaurant" | "lounge" | "bar" | "cafe"> = { restaurant: "restaurant", lounge: "lounge", bar: "bar", café: "cafe", cafe: "cafe" };

/** The assistant's instructions from the answers. */
/** timeZone: the owner's (their phone or browser's), for a restaurant's bookings; Lagos without one. */
export function setupInstructions(kind: BusinessKind, answers: Partial<Record<AnswerKey, string>>, timeZone?: string): string {
    const name = answers.name?.trim() || "the business";
    if (kind === "restaurant") {
        const deposit = answers.deposit?.trim();
        return restaurantInstructions({
            ...RESTAURANT_DEFAULTS,
            venueName: name,
            venueType: VENUE[(answers.venue ?? "").trim().toLowerCase()] ?? "restaurant",
            address: answers.address?.trim() ?? "",
            hours: answers.hours?.trim() ?? "",
            phone: answers.phone?.trim() ?? "",
            ...(timeZone ? { timeZone } : {}),
            deposit: deposit && !/^no\b/i.test(deposit) ? deposit : "",
        });
    }
    const noun = BUSINESS_KINDS.find((item) => item.id === kind)?.noun ?? "business";
    const lines = [
        `You are the assistant for ${name}, a ${noun}. Customers message you on WhatsApp, on the website and through a link. Help them quickly and warmly, the way a good member of staff would.`,
        "",
        "About the business:",
        answers.offer?.trim() && `- What it offers: ${answers.offer.trim()}`,
        answers.address?.trim() && `- Where: ${answers.address.trim()}`,
        answers.hours?.trim() && `- Opening hours: ${answers.hours.trim()}`,
        answers.phone?.trim() && `- Phone: ${answers.phone.trim()}`,
        "",
        "How to help:",
        "- Answer questions about products, services, prices and opening hours from your knowledge. Never make up a price, a service or a policy; if you don't know, say so and offer to have the team call them back.",
        kind === "shop" && "- When someone wants to buy, confirm the items, quantities, sizes or options, and their delivery address, then arrange for the team to confirm and take payment (request a callback).",
        (kind === "salon" || kind === "clinic" || kind === "services") && "- When someone wants an appointment or a quote, get their name, what they need and their preferred day and time, then request a callback so the team confirms it. Don't confirm a time yourself.",
        "- If they ask for a person, are unhappy, or need something you can't do, request a callback with their name, number and what they need.",
        "",
        "Style: short, friendly messages that read well on WhatsApp. Reply in the language they write in (English, Pidgin, Yoruba, Igbo, Hausa…). No headings. Ask one thing at a time.",
    ];
    return lines.filter((line) => line !== false && line !== undefined && line !== null).join("\n").replace(/\n{3,}/g, "\n\n");
}

/** What the assistant knows from day one: the pasted menu or price list. */
export function setupKnowledge(kind: BusinessKind, answers: Partial<Record<AnswerKey, string>>): { name: string; text: string } | null {
    const text = answers.list?.trim();
    if (!text) return null;
    const name = kind === "restaurant" ? "Menu" : kind === "other" ? "About the business" : "Prices";
    return { name, text };
}
