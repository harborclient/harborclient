/**
 * Redux async-thunk type prefix for `sendRequest`.
 *
 * Kept in a leaf module so allowlists (workflow registry, busy middleware) can
 * share the string without importing the full requests thunk graph.
 */
export const SEND_REQUEST_TYPE = 'tabs/sendRequest' as const;

/**
 * Pending lifecycle action type for `sendRequest` (`${SEND_REQUEST_TYPE}/pending`).
 */
export const SEND_REQUEST_PENDING_TYPE = `${SEND_REQUEST_TYPE}/pending` as const;
