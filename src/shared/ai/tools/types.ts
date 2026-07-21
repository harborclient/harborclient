/**
 * Arguments for tools that look up a sidebar item by uuid.
 */
export interface GetSidebarItemByUuidToolArgs {
  /**
   * UUID of the collection, folder, or saved request to fetch.
   */
  uuid: string;
}

/**
 * Key-value row accepted by create_collection and create_request tool arguments.
 */
export interface CreateSavedRequestKeyValue {
  /**
   * Header or query param name.
   */
  key: string;

  /**
   * Header or query param value.
   */
  value: string;

  /**
   * Whether the row is active; defaults to true when omitted.
   */
  enabled?: boolean;
}

/**
 * Saved request row accepted by the create_collection tool.
 */
export interface CreateCollectionRequestRow {
  /**
   * Display name for the saved request.
   */
  name: string;

  /**
   * HTTP method (case-insensitive).
   */
  method: string;

  /**
   * Request URL.
   */
  url: string;

  /**
   * Optional folder name within the new collection.
   */
  folder?: string;

  /**
   * Optional request headers as a flat object or key-value rows.
   */
  headers?: Record<string, string> | CreateSavedRequestKeyValue[];

  /**
   * Optional query params as key-value rows.
   */
  params?: CreateSavedRequestKeyValue[];

  /**
   * Optional request body content.
   */
  body?: string;

  /**
   * Optional body content type.
   */
  bodyType?: 'none' | 'json' | 'text' | 'multipart' | 'urlencoded';

  /**
   * Optional free-form notes for the request.
   */
  comment?: string;
}
