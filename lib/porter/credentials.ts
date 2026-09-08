/** Porter widget keys are restricted to the public Porter endpoints. */
export function isPorterApiKey(key: { client_app?: unknown }): boolean {
    return key.client_app === 'porter';
}
