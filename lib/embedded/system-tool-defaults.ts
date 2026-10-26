/**
 * What the model reads about each system tool unless the owner writes their
 * own. Kept free of imports so the console can show it ("Show default").
 */
export const END_CONVERSATION_TOOL = 'end_conversation';
export const TRANSFER_TO_HUMAN_TOOL = 'transfer_to_human';
export const REQUEST_CALLBACK_TOOL = 'request_callback';
/** The switch for payments; the model sees it as two tools. */
export const TAKE_PAYMENTS_TOOL = 'take_payments';
export const REQUEST_PAYMENT_TOOL = 'request_payment';
export const CHECK_PAYMENT_TOOL = 'check_payment';
/** The switch for selling from the product catalog; the model sees it as two tools. */
export const SELL_PRODUCTS_TOOL = 'sell_products';
export const FIND_PRODUCTS_TOOL = 'find_products';
export const PLACE_ORDER_TOOL = 'place_order';

export const SYSTEM_TOOL_DEFAULT_DESCRIPTIONS = {
    [END_CONVERSATION_TOOL]: 'End the conversation once the person is done: they said goodbye, their request is fully handled, or they asked to stop. Write your goodbye after calling it. Never call it while they still need something.',
    [TRANSFER_TO_HUMAN_TOOL]: 'Hand the person to a human on the team when they ask for one, or when you can\'t help with their request. Ask for their name and how to reach them first. A person follows up; tell them so after calling it.',
    [TAKE_PAYMENTS_TOOL]: 'Send the person a payment link for a deposit, an event table or an order, once the amount is settled. Say what it\'s for and the amount. The booking or order is only confirmed once they\'ve paid: they get a confirmation here automatically, or use check_payment when they say they\'ve paid.',
    [SELL_PRODUCTS_TOOL]: 'Look up the business\'s products: what\'s for sale, prices, options and stock. Only quote prices and stock from here, never from memory. Search with the customer\'s own words; with no words it lists the catalog.',
    [REQUEST_CALLBACK_TOOL]: 'Ask the team to call the person back, for anything you can\'t settle yourself: a request you can\'t book or answer, a complaint, a large group or private event, or when they ask for a person. Get their name and phone number first. Only tell them someone will call once this succeeds.',
} as const;

export const SYSTEM_TOOL_DESCRIPTION_MAX = 1000;
export const TRANSFER_RULES_MAX = 10;
export const TRANSFER_RULE_MAX = 300;
