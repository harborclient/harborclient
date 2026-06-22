import type { TeamHub } from '#/shared/types';

/**
 * Creates an empty team hub form record for add flows.
 *
 * @returns Blank team hub with a default local base URL.
 */
export function createBlankTeamHub(): TeamHub {
  return {
    id: '',
    name: '',
    baseUrl: 'http://127.0.0.1:8788',
    token: ''
  };
}

/**
 * Validates team hub form fields before save.
 *
 * @param hub - Team hub draft from the edit form.
 * @returns Field-specific validation errors, or null when valid.
 */
export function validateTeamHubForm(hub: TeamHub): Record<string, string> | null {
  const errors: Record<string, string> = {};

  if (!hub.name.trim()) {
    errors.name = 'Name is required.';
  }
  if (!hub.baseUrl.trim()) {
    errors.baseUrl = 'Team hub URL is required.';
  }
  if (!hub.token.trim()) {
    errors.token = 'API token is required.';
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
