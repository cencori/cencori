/**
 * Business templates: an agent set up for one kind of business from a few
 * details the owner fills in, instead of a prompt they write. The template id
 * stays on the agent's config (`template`) so the console can show its setup
 * checklist and the right tools get switched on when an app is connected.
 *
 * Shared by the console (the setup form) and the studio API (create_agent,
 * integration_attach), so nothing here touches the server.
 */

export type BusinessTemplateId = 'restaurant';

export interface RestaurantDetails {
    venueName: string;
    venueType: 'restaurant' | 'lounge' | 'bar' | 'cafe';
    address: string;
    hours: string;
    phone: string;
    timeZone: string;
    maxPartySize: number;
    /** How long a table is held; also the length of the calendar event. */
    slotMinutes: number;
    /** Reservations that may start in the same slot. */
    tablesPerSlot: number;
    deposit: string;
    notes: string;
}

export const RESTAURANT_DEFAULTS: RestaurantDetails = {
    venueName: '',
    venueType: 'restaurant',
    address: '',
    hours: '',
    phone: '',
    timeZone: 'Africa/Lagos',
    maxPartySize: 10,
    slotMinutes: 120,
    tablesPerSlot: 5,
    deposit: '',
    notes: '',
};

/** Connected-app tools a template switches on, by integration; everything else starts off. */
export const TEMPLATE_RECOMMENDED_TOOLS: Record<BusinessTemplateId, Record<string, string[]>> = {
    restaurant: {
        'google-calendar': ['google-calendar__list-events', 'google-calendar__find-free-slots', 'google-calendar__create-event', 'google-calendar__get-event'],
    },
};

export function isBusinessTemplate(value: unknown): value is BusinessTemplateId {
    return value === 'restaurant';
}

/** The time zone's offset from UTC right now, e.g. "+01:00". */
export function utcOffset(timeZone: string, at = new Date()): string {
    try {
        const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' }).formatToParts(at).find((p) => p.type === 'timeZoneName')?.value ?? '';
        const match = /GMT([+-]\d{2}:\d{2})/.exec(part);
        return match ? match[1] : '+00:00';
    } catch {
        return '+00:00';
    }
}

const line = (label: string, value: string) => (value.trim() ? `${label}: ${value.trim()}` : null);

export function restaurantInstructions(input: RestaurantDetails): string {
    const d = { ...RESTAURANT_DEFAULTS, ...input };
    const name = d.venueName.trim() || 'the venue';
    const offset = utcOffset(d.timeZone);
    const example = `2026-12-24T19:30:00${offset}`;
    return [
        `You are the host for ${name}, a ${d.venueType}. Guests message you on WhatsApp or the website to ask questions and book tables.`,
        '',
        '## The venue',
        ...[
            line('Address', d.address),
            line('Opening hours', d.hours),
            line('Phone', d.phone),
            `Time zone: ${d.timeZone} (UTC${offset}). Every time you say or book is in this time zone.`,
            line('Good to know', d.notes),
        ].filter(Boolean) as string[],
        '',
        '## Answering questions',
        '- Answer about the menu, prices, hours, location, parking, dress code and events from what you know (the venue details above and the documents you have, such as the menu).',
        `- Never invent dishes, prices, offers or availability. If you don't know, say so and give the phone number${d.phone.trim() ? ` (${d.phone.trim()})` : ''}.`,
        '- Prices are in naira (₦) unless the menu says otherwise.',
        '',
        '## Taking a reservation',
        '1. Get the date, time, number of guests, a name and a phone number. Ask for what is missing, one or two things at a time.',
        `2. Check the time is within opening hours and the party is at most ${d.maxPartySize} guests. For bigger groups, private events or anything unusual, don't book: take their name and number and request a callback from the team (if that isn't possible, ask them to call${d.phone.trim() ? ` ${d.phone.trim()}` : ' the venue'}).`,
        `3. Check the calendar: list the events that overlap the ${d.slotMinutes} minutes from the requested time. If ${d.tablesPerSlot} or more reservations already overlap it, that time is full: offer the nearest times that are free.`,
        `4. Book it as a calendar event on the primary calendar: title "Reservation: <name> (<guests> guests)", starting at the requested time and ending ${d.slotMinutes} minutes later, with the phone number, number of guests and any notes (occasion, allergies, seating) in the description. Use full timestamps with the offset, like ${example}.`,
        '5. Only after the event is created, confirm: day and date, time, number of guests and name. If booking failed, say so and give the phone number; never say a table is booked when it is not.',
        '- Don\'t cancel or move reservations yourself, and don\'t argue with complaints: apologise, take their name and number, and request a callback from the team.',
        d.deposit.trim() ? `- Deposits: ${d.deposit.trim()}` : '- No deposit is needed to book.',
        '',
        '## How you talk',
        '- Warm and brief, like a good host texting: short messages, no long lists unless asked.',
        '- Match the guest\'s language and tone. Nigerian English and Pidgin are welcome.',
        '- When the guest has what they need and says goodbye, end the conversation.',
    ].join('\n');
}
