/**
 * Cached per-hub OpenAI capability flags discovered from GET /llm/models.
 */
const hubOpenAiById = new Map<string, boolean>();

/**
 * Records whether a Team Hub advertises an OpenAI provider key.
 *
 * @param hubId - Team Hub connection id from local settings.
 * @param hasOpenAi - Value from the hub capabilities payload.
 */
export function setHubOpenAiCapability(hubId: string, hasOpenAi: boolean): void {
  hubOpenAiById.set(hubId, hasOpenAi);
}

/**
 * Returns the cached OpenAI capability for a Team Hub, when known.
 *
 * @param hubId - Team Hub connection id from local settings.
 */
export function getHubOpenAiCapability(hubId: string): boolean | undefined {
  return hubOpenAiById.get(hubId);
}

/**
 * Clears cached hub OpenAI capability flags (for tests).
 */
export function clearHubOpenAiCapabilities(): void {
  hubOpenAiById.clear();
}
