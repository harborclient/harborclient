import type { ReloadConfigResponse } from '#/shared/types';

/**
 * Builds a user-facing alert message when config reload reported errors.
 *
 * @param result - Reload response from the Team Hub server.
 * @returns Alert body text, or null when reload succeeded without issues.
 */
export function getReloadConfigAlertMessage(result: ReloadConfigResponse): string | null {
  if (result.fatalError) {
    return result.fatalError;
  }

  const problemSections = result.sections.filter(
    (section) => section.status === 'failed' || section.status === 'restart-required'
  );

  if (problemSections.length === 0) {
    return null;
  }

  return problemSections
    .map((section) => {
      const detail = section.error ? `: ${section.error}` : '';
      return `${section.section} (${section.status})${detail}`;
    })
    .join('\n');
}
