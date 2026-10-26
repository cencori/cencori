/**
 * What the model reads about each system tool unless the owner writes their
 * own. Kept free of imports so the console can show it ("Show default").
 */
export const END_CONVERSATION_TOOL = 'end_conversation';
export const TRANSFER_TO_HUMAN_TOOL = 'transfer_to_human';
export const REQUEST_CALLBACK_TOOL = 'request_callback';

export const SYSTEM_TOOL_DEFAULT_DESCRIPTIONS = {
    [END_CONVERSATION_TOOL]: 'End the conversation once the person is done: they said goodbye, their request is fully handled, or they asked to stop. Write your goodbye after calling it. Never call it while they still need something.',
    [TRANSFER_TO_HUMAN_TOOL]: 'Hand the person to a human on the team when they ask for one, or when you can\'t help with their request. Ask for their name and how to reach them first. A person follows up; tell them so after calling it.',
    [REQUEST_CALLBACK_TOOL]: 'Ask the team to call the person back, for anything you can\'t settle yourself: a request you can\'t book or answer, a complaint, a large group or private event, or when they ask for a person. Get their name and phone number first. Only tell them someone will call once this succeeds.',
} as const;

export const SYSTEM_TOOL_DESCRIPTION_MAX = 1000;
export const TRANSFER_RULES_MAX = 10;
export const TRANSFER_RULE_MAX = 300;
