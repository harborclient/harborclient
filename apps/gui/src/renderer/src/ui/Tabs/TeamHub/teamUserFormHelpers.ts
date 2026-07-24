import type { CreateHubUserInput, HubUserRecord, UpdateHubUserInput } from '#/shared/types';

/**
 * Form values edited in the Team Hub user modal.
 */
export interface TeamUserFormValues {
  /**
   * Unique display name for the account.
   */
  name: string;

  /**
   * Account role determining API capabilities.
   */
  role: 'admin' | 'user';

  /**
   * Comma-separated collection access ids or `*`.
   */
  collectionAccessText: string;

  /**
   * Comma-separated environment access ids or `*`.
   */
  environmentAccessText: string;

  /**
   * Whether the user may call hub-proxied LLM routes.
   */
  llmAccess: boolean;

  /**
   * Comma-separated LLM model ids or `*`.
   */
  llmModelsText: string;

  /**
   * Monthly token limit as text; blank means unlimited.
   */
  llmMonthlyTokenLimitText: string;
}

/**
 * Default form values for creating a new Team Hub user account.
 */
export const defaultCreateFormValues: TeamUserFormValues = {
  name: '',
  role: 'user',
  collectionAccessText: '',
  environmentAccessText: '',
  llmAccess: false,
  llmModelsText: '',
  llmMonthlyTokenLimitText: ''
};

/**
 * Parses a comma-separated access list from the edit form.
 *
 * @param text - Raw input from the access list field.
 * @returns Trimmed access ids.
 */
export function parseAccessListText(text: string): string[] {
  return text
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/**
 * Returns the access token currently being typed after the last comma.
 *
 * @param text - Raw comma-separated access list input.
 * @returns Trimmed partial token used for autocomplete filtering.
 */
export function getCurrentAccessToken(text: string): string {
  const lastComma = text.lastIndexOf(',');
  const tail = lastComma >= 0 ? text.slice(lastComma + 1) : text;
  return tail.trim();
}

/**
 * Applies an autocomplete selection to a comma-separated access list field.
 *
 * Replaces the partial token after the last comma and deduplicates existing entries.
 *
 * @param text - Current comma-separated access list input.
 * @param suggestionId - Selected access id to insert.
 * @returns Updated comma-separated access list text.
 */
export function applyAccessSuggestion(text: string, suggestionId: string): string {
  const normalizedId = suggestionId.trim();
  if (normalizedId.length === 0) {
    return text;
  }

  const lastComma = text.lastIndexOf(',');
  const existingText = lastComma >= 0 ? text.slice(0, lastComma) : '';
  const existingTokens = parseAccessListText(existingText);
  const deduped = existingTokens.filter((token) => token !== normalizedId);
  deduped.push(normalizedId);
  return deduped.join(', ');
}

/**
 * Filters access list suggestions against the token currently being typed.
 *
 * @param suggestions - Resource options available for selection.
 * @param currentToken - Partial token after the last comma.
 * @returns Matching suggestions with the wildcard entry first when applicable.
 */
export function filterAccessListSuggestions(
  suggestions: Array<{ id: string; label: string }>,
  currentToken: string
): Array<{ id: string; label: string }> {
  const normalizedToken = currentToken.trim().toLowerCase();
  const wildcardSuggestion = { id: '*', label: 'All' };
  const resourceMatches = suggestions.filter((suggestion) => {
    if (normalizedToken.length === 0) {
      return true;
    }

    return (
      suggestion.id.toLowerCase().includes(normalizedToken) ||
      suggestion.label.toLowerCase().includes(normalizedToken)
    );
  });

  const showWildcard =
    normalizedToken.length === 0 ||
    '*'.startsWith(normalizedToken) ||
    'all'.startsWith(normalizedToken);

  return showWildcard ? [wildcardSuggestion, ...resourceMatches] : resourceMatches;
}

/**
 * Formats an access list for display in a comma-separated input.
 *
 * @param access - Collection, environment, or model access ids.
 * @returns Comma-separated text suitable for editing.
 */
export function formatAccessListText(access: string[]): string {
  return access.join(', ');
}

/**
 * Builds react-hook-form default values from a hub user record.
 *
 * @param user - User account being edited.
 * @returns Initial form field values.
 */
export function hubUserToFormValues(user: HubUserRecord): TeamUserFormValues {
  return {
    name: user.name,
    role: user.role,
    collectionAccessText: formatAccessListText(user.collectionAccess),
    environmentAccessText: formatAccessListText(user.environmentAccess),
    llmAccess: user.llmAccess,
    llmModelsText: formatAccessListText(user.llmModels),
    llmMonthlyTokenLimitText:
      user.llmMonthlyTokenLimit != null ? String(user.llmMonthlyTokenLimit) : ''
  };
}

/**
 * Converts validated form values into a management API update payload.
 *
 * @param values - Submitted form values.
 * @returns Partial user update accepted by Team Hub.
 */
export function formValuesToUpdateInput(values: TeamUserFormValues): UpdateHubUserInput {
  const llmLimitText = values.llmMonthlyTokenLimitText.trim();

  return {
    name: values.name.trim(),
    role: values.role,
    collectionAccess:
      values.role === 'admin' ? [] : parseAccessListText(values.collectionAccessText),
    environmentAccess:
      values.role === 'admin' ? [] : parseAccessListText(values.environmentAccessText),
    llmAccess: values.llmAccess,
    llmModels: parseAccessListText(values.llmModelsText),
    llmMonthlyTokenLimit: llmLimitText.length === 0 ? null : Number(llmLimitText)
  };
}

/**
 * Converts validated form values into a management API create payload.
 *
 * @param values - Submitted form values.
 * @returns Create input accepted by Team Hub.
 */
export function formValuesToCreateInput(values: TeamUserFormValues): CreateHubUserInput {
  const llmLimitText = values.llmMonthlyTokenLimitText.trim();

  return {
    name: values.name.trim(),
    role: values.role,
    collectionAccess:
      values.role === 'admin' ? [] : parseAccessListText(values.collectionAccessText),
    environmentAccess:
      values.role === 'admin' ? [] : parseAccessListText(values.environmentAccessText),
    llmAccess: values.llmAccess,
    llmModels: parseAccessListText(values.llmModelsText),
    llmMonthlyTokenLimit: llmLimitText.length === 0 ? null : Number(llmLimitText)
  };
}
