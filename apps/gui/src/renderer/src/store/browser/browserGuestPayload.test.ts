import { describe, expect, it } from 'vitest';
import { normalizeAuth, type AuthConfig } from '@harborclient/core/auth';
import type { Variable } from '@harborclient/core/types';
import { buildBrowserHcScriptsPayload } from './browserGuestPayload';

/**
 * Builds a Variable row for payload tests.
 *
 * @param key - Variable key.
 * @param value - Variable value.
 * @returns Enabled variable row.
 */
function variable(key: string, value: string): Variable {
  return { key, value, defaultValue: '', enabled: true, share: false };
}

/**
 * Tab-shaped fixture accepted by {@link buildBrowserHcScriptsPayload}.
 */
type TabFields = {
  scripts: never[];
  savedScripts: never[];
  pre_request_scripts: never[];
  post_request_scripts: never[];
  savedPreRequestScripts: never[];
  savedPostRequestScripts: never[];
  headers: never[];
  savedHeaders: never[];
  auth: AuthConfig;
  savedAuth: AuthConfig;
  userAgent: string;
  savedUserAgent: string;
  variables: Variable[];
  savedVariables: Variable[];
  websiteUuid: string | null;
};

/**
 * Minimal browser-tab fields for buildBrowserHcScriptsPayload.
 *
 * @param overrides - Partial tab fields to merge.
 * @returns Tab-shaped object accepted by the payload builder.
 */
function tabFields(
  overrides: Partial<{
    variables: Variable[];
    savedVariables: Variable[];
    websiteUuid: string | null;
  }> = {}
): TabFields {
  return {
    scripts: [],
    savedScripts: [],
    pre_request_scripts: [],
    post_request_scripts: [],
    savedPreRequestScripts: [],
    savedPostRequestScripts: [],
    headers: [],
    savedHeaders: [],
    auth: normalizeAuth({ type: 'none' }),
    savedAuth: normalizeAuth({ type: 'none' }),
    userAgent: '',
    savedUserAgent: '',
    variables: overrides.variables ?? [],
    savedVariables: overrides.savedVariables ?? [],
    websiteUuid: overrides.websiteUuid ?? null
  };
}

describe('buildBrowserHcScriptsPayload', () => {
  it('merges base variables with live-page overrides', () => {
    const payload = buildBrowserHcScriptsPayload(
      tabFields({
        savedVariables: [variable('host', 'live.example'), variable('token', 'live-token')]
      }),
      [],
      [variable('host', 'base.example'), variable('env', 'prod')],
      true
    );
    expect(payload.variables).toEqual({
      host: 'live.example',
      env: 'prod',
      token: 'live-token'
    });
  });

  it('uses savedVariables when useSaved is true', () => {
    const payload = buildBrowserHcScriptsPayload(
      tabFields({
        variables: [variable('token', 'draft')],
        savedVariables: [variable('token', 'saved')]
      }),
      [],
      [],
      true
    );
    expect(payload.variables).toEqual({ token: 'saved' });
  });

  it('uses draft variables when useSaved is false', () => {
    const payload = buildBrowserHcScriptsPayload(
      tabFields({
        variables: [variable('token', 'draft')],
        savedVariables: [variable('token', 'saved')]
      }),
      [],
      [],
      false
    );
    expect(payload.variables).toEqual({ token: 'draft' });
  });

  it('includes livepageId from websiteUuid when linked', () => {
    const payload = buildBrowserHcScriptsPayload(
      tabFields({ websiteUuid: '  website-uuid  ' }),
      [],
      [],
      true
    );
    expect(payload.livepageId).toBe('website-uuid');
  });

  it('uses empty livepageId when the tab is not linked', () => {
    const payload = buildBrowserHcScriptsPayload(tabFields(), [], [], true);
    expect(payload.livepageId).toBe('');
  });
});
