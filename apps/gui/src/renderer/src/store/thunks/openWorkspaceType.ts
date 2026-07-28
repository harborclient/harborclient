/**
 * Redux async-thunk type prefix for `openWorkspace`.
 *
 * Kept in a leaf module so the workflow recorder can suppress fan-out and the
 * registry can match pending without importing the workspaces thunk graph.
 */
export const OPEN_WORKSPACE_TYPE = 'workspaces/open' as const;

/**
 * Pending lifecycle action type for `openWorkspace`.
 */
export const OPEN_WORKSPACE_PENDING_TYPE = `${OPEN_WORKSPACE_TYPE}/pending` as const;

/**
 * Fulfilled lifecycle action type for `openWorkspace`.
 */
export const OPEN_WORKSPACE_FULFILLED_TYPE = `${OPEN_WORKSPACE_TYPE}/fulfilled` as const;

/**
 * Rejected lifecycle action type for `openWorkspace`.
 */
export const OPEN_WORKSPACE_REJECTED_TYPE = `${OPEN_WORKSPACE_TYPE}/rejected` as const;
