import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COLLABORATION_CONFIG,
  normalizeCollaborationConfig,
  shouldIncludeDiscussionNoticePreview
} from '#/config/collaborationConfig.js';

describe('normalizeCollaborationConfig', () => {
  it('defaults e2ee to false when the section is omitted', () => {
    expect(normalizeCollaborationConfig(undefined)).toEqual(DEFAULT_COLLABORATION_CONFIG);
  });

  it('preserves an explicit e2ee flag', () => {
    expect(normalizeCollaborationConfig({ e2ee: true })).toEqual({ e2ee: true });
  });
});

describe('shouldIncludeDiscussionNoticePreview', () => {
  it('allows previews on plaintext hubs', () => {
    expect(shouldIncludeDiscussionNoticePreview({ e2ee: false })).toBe(true);
  });

  it('suppresses previews when discussion E2EE is enabled', () => {
    expect(shouldIncludeDiscussionNoticePreview({ e2ee: true })).toBe(false);
  });
});
