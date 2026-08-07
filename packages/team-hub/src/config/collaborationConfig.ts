/**
 * Normalized collaboration settings loaded from server.yaml.
 */
export interface CollaborationConfig {
  /**
   * When true, discussion comment bodies must be stored as encrypted payloads.
   *
   * Plaintext discussion writes are rejected hub-wide; notices omit body previews.
   */
  e2ee: boolean;
}

/**
 * Default collaboration settings when the section is omitted from server.yaml.
 */
export const DEFAULT_COLLABORATION_CONFIG: CollaborationConfig = {
  e2ee: false
};

/**
 * Converts a validated YAML collaboration section into normalized runtime config.
 *
 * @param section - Parsed collaboration section, or undefined when omitted.
 * @returns Normalized collaboration settings.
 */
export function normalizeCollaborationConfig(
  section: { e2ee?: boolean } | undefined
): CollaborationConfig {
  return {
    e2ee: section?.e2ee ?? false
  };
}

/**
 * Returns whether discussion notice previews may include comment body snippets.
 *
 * @param config - Active collaboration settings for the hub.
 */
export function shouldIncludeDiscussionNoticePreview(config: CollaborationConfig): boolean {
  return !config.e2ee;
}
