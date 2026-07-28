/**
 * Serializes workspace settings form fields for dirty-state comparison.
 *
 * @param name - Workspace display name.
 * @param activeEnvironmentUuid - Environment uuid applied when the workspace opens, or null.
 */
export function serializeWorkspaceForm(name: string, activeEnvironmentUuid: string | null): string {
  return JSON.stringify({
    name: name.trim(),
    activeEnvironmentUuid
  });
}
