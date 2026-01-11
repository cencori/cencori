/**
 * JSON Parser for partial/incomplete JSON strings
 *
 * Used during streaming to parse tool call arguments that may be incomplete.
 */
/**
 * JSON Parser interface - allows for custom parser implementations
 */
export interface JSONParser {
    /**
     * Parse a JSON string (may be incomplete/partial)
     * @param jsonString - The JSON string to parse
     * @returns The parsed object, or undefined if parsing fails
     */
    parse: (jsonString: string) => any;
}
/**
 * Partial JSON Parser implementation using the partial-json library
 * This parser can handle incomplete JSON strings during streaming
 */
export declare class PartialJSONParser implements JSONParser {
    /**
     * Parse a potentially incomplete JSON string
     * @param jsonString - The JSON string to parse (may be incomplete)
     * @returns The parsed object, or undefined if parsing fails
     */
    parse(jsonString: string): any;
}
/**
 * Default parser instance
 */
export declare const defaultJSONParser: PartialJSONParser;
/**
 * Parse partial JSON string (convenience function)
 * @param jsonString - The JSON string to parse (may be incomplete)
 * @returns The parsed object, or undefined if parsing fails
 */
export declare function parsePartialJSON(jsonString: string): any;
