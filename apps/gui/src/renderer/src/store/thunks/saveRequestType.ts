/**
 * Redux async-thunk type prefix for `saveRequest`.
 *
 * Leaf module so the workflow registry can match fulfilled without importing
 * the requests thunk graph.
 */
export const SAVE_REQUEST_TYPE = 'tabs/saveRequest' as const;

/**
 * Fulfilled lifecycle action type for `saveRequest`.
 */
export const SAVE_REQUEST_FULFILLED_TYPE = `${SAVE_REQUEST_TYPE}/fulfilled` as const;
