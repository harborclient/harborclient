/**
 * Parses a JSON string, returning a fallback value on failure or when empty.
 *
 * @param value - JSON string to parse.
 * @param fallback - Value returned when parsing fails or value is empty.
 */
export function parseJson(value, fallback) {
    if (!value)
        return fallback;
    try {
        return JSON.parse(value);
    }
    catch {
        return fallback;
    }
}
//# sourceMappingURL=parseJson.js.map