import type { EditorTab, GeneralSettings } from '@harborclient/core/types';

/**
 * Copy for one built-in request editor tab notice.
 */
export interface RequestEditorNoticeCopy {
  /** Human-readable tab name used in the dismiss button accessible name. */
  label: string;
  /** One to two sentence description of what the tab does. */
  description: string;
}

/**
 * Inline help copy for every built-in request editor tab, keyed by tab id.
 * Plugin-contributed tabs intentionally have no notice.
 */
export const REQUEST_EDITOR_NOTICES: Record<EditorTab, RequestEditorNoticeCopy> = {
  params: {
    label: 'Params',
    description:
      'Change the ?query parameters sent with the request using the key/value editor. Edits stay in sync with the query string in the URL bar.'
  },
  body: {
    label: 'Body',
    description:
      'Configure the outgoing request body by selecting a content type and filling in the matching editor. GET and HEAD requests do not send a body.'
  },
  headers: {
    label: 'Headers',
    description:
      'Configure the headers sent with the request using the key/value editor. The User-Agent header can be overridden separately below.'
  },
  auth: {
    label: 'Authorization',
    description:
      'Choose an authorization scheme and HarborClient attaches the matching credentials when the request is sent.'
  },
  cookies: {
    label: 'Cookies',
    description:
      'Review and edit the cookies stored for this request URL. Matching cookies are sent automatically with the request.'
  },
  pre: {
    label: 'PreRequest',
    description:
      'Run scripts before the request is sent to set variables, sign payloads, or modify the outgoing request.'
  },
  post: {
    label: 'PostRequest',
    description:
      'Run scripts after the response arrives to test results, extract values, or chain follow-up requests.'
  },
  comment: {
    label: 'Discuss',
    description:
      'Document this request with tags and notes, or start a Team Hub discussion when communication is enabled for the collection.'
  }
};

/**
 * All built-in tab ids that show a dismissible notice, in tab display order.
 */
export const REQUEST_EDITOR_NOTICE_TABS = Object.keys(REQUEST_EDITOR_NOTICES) as EditorTab[];

/**
 * Returns whether the notice for a tab has been dismissed.
 *
 * @param general - Live general settings from the renderer store.
 * @param tab - Built-in editor tab id.
 */
export function isRequestEditorNoticeDismissed(general: GeneralSettings, tab: EditorTab): boolean {
  return general.dismissedRequestEditorNotices.includes(tab);
}

/**
 * Builds a general-settings patch that dismisses one tab notice, preserving
 * previously dismissed tabs and avoiding duplicates.
 *
 * @param general - Live general settings from the renderer store.
 * @param tab - Built-in editor tab id to dismiss.
 */
export function dismissRequestEditorNoticePatch(
  general: GeneralSettings,
  tab: EditorTab
): Partial<GeneralSettings> {
  return {
    dismissedRequestEditorNotices: [...new Set([...general.dismissedRequestEditorNotices, tab])]
  };
}
