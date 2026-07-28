/**
 * Redux async-thunk type prefix for creating a request at collection root.
 */
export const NEW_REQUEST_IN_COLLECTION_TYPE = 'tabs/newRequestInCollection' as const;

/**
 * Fulfilled lifecycle action type for `newRequestInCollection`.
 */
export const NEW_REQUEST_IN_COLLECTION_FULFILLED_TYPE =
  `${NEW_REQUEST_IN_COLLECTION_TYPE}/fulfilled` as const;

/**
 * Redux async-thunk type prefix for creating a request inside a folder.
 */
export const NEW_REQUEST_IN_FOLDER_TYPE = 'tabs/newRequestInFolder' as const;

/**
 * Fulfilled lifecycle action type for `newRequestInFolder`.
 */
export const NEW_REQUEST_IN_FOLDER_FULFILLED_TYPE =
  `${NEW_REQUEST_IN_FOLDER_TYPE}/fulfilled` as const;
