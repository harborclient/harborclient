/**
 * Redux async-thunk type prefix for `cancelRequest`.
 *
 * Leaf module so the workflow registry can match pending without importing the
 * requests thunk graph.
 */
export const CANCEL_REQUEST_TYPE = 'tabs/cancelRequest' as const;

/**
 * Pending lifecycle action type for `cancelRequest`.
 */
export const CANCEL_REQUEST_PENDING_TYPE = `${CANCEL_REQUEST_TYPE}/pending` as const;
