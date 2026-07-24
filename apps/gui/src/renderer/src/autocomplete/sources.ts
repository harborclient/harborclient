import type { AutocompleteSource } from '@harborclient/sdk/components';

/** Autocomplete pool for request URLs. */
export const AUTOCOMPLETE_CATEGORY_URL = 'url';

/** Autocomplete pool for query param keys. */
export const AUTOCOMPLETE_CATEGORY_PARAM_KEY = 'param.key';

/** Autocomplete pool for query param values. */
export const AUTOCOMPLETE_CATEGORY_PARAM_VALUE = 'param.value';

/** Autocomplete pool for HTTP header keys (request and collection). */
export const AUTOCOMPLETE_CATEGORY_HEADER_KEY = 'header.key';

/** Autocomplete pool for HTTP header values (request and collection). */
export const AUTOCOMPLETE_CATEGORY_HEADER_VALUE = 'header.value';

/** Autocomplete pool for cookie names. */
export const AUTOCOMPLETE_CATEGORY_COOKIE_KEY = 'cookie.key';

/** Autocomplete pool for cookie values. */
export const AUTOCOMPLETE_CATEGORY_COOKIE_VALUE = 'cookie.value';

/** Autocomplete pool for form-urlencoded field keys. */
export const AUTOCOMPLETE_CATEGORY_URLENCODED_KEY = 'urlencoded.key';

/** Autocomplete pool for form-urlencoded field values. */
export const AUTOCOMPLETE_CATEGORY_URLENCODED_VALUE = 'urlencoded.value';

/**
 * Builds an {@link AutocompleteSource} backed by main-process persistence for a category.
 *
 * IPC failures are swallowed so autocomplete inputs never reject into the SDK hook.
 *
 * @param category - Stable pool id shared by all editors in the same field category.
 * @returns Async source for SDK autocomplete inputs.
 */
function createAutocompleteSource(category: string): AutocompleteSource {
  return {
    list: async () => {
      try {
        const values = await window.api.getAutocompleteValues(category);
        return Array.isArray(values) ? values : [];
      } catch {
        return [];
      }
    },
    add: async (value) => {
      try {
        await window.api.addAutocompleteValue(category, value);
      } catch {
        // Ignore persistence failures so editing stays responsive.
      }
    }
  };
}

/** Autocomplete source for the request URL bar. */
export const urlSource = createAutocompleteSource(AUTOCOMPLETE_CATEGORY_URL);

/** Autocomplete source for query param keys. */
export const paramKeySource = createAutocompleteSource(AUTOCOMPLETE_CATEGORY_PARAM_KEY);

/** Autocomplete source for query param values. */
export const paramValueSource = createAutocompleteSource(AUTOCOMPLETE_CATEGORY_PARAM_VALUE);

/** Autocomplete source for HTTP header keys. */
export const headerKeySource = createAutocompleteSource(AUTOCOMPLETE_CATEGORY_HEADER_KEY);

/** Autocomplete source for HTTP header values. */
export const headerValueSource = createAutocompleteSource(AUTOCOMPLETE_CATEGORY_HEADER_VALUE);

/** Autocomplete source for cookie names. */
export const cookieKeySource = createAutocompleteSource(AUTOCOMPLETE_CATEGORY_COOKIE_KEY);

/** Autocomplete source for cookie values. */
export const cookieValueSource = createAutocompleteSource(AUTOCOMPLETE_CATEGORY_COOKIE_VALUE);

/** Autocomplete source for form-urlencoded field keys. */
export const urlencodedKeySource = createAutocompleteSource(AUTOCOMPLETE_CATEGORY_URLENCODED_KEY);

/** Autocomplete source for form-urlencoded field values. */
export const urlencodedValueSource = createAutocompleteSource(
  AUTOCOMPLETE_CATEGORY_URLENCODED_VALUE
);
