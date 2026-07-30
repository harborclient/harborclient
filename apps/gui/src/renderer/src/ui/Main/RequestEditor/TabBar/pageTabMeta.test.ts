import { describe, expect, it } from 'vitest';
import { pageTabMeta } from './pageTabMeta';

describe('pageTabMeta', () => {
  it('labels getting started tabs', () => {
    const meta = pageTabMeta({ type: 'getting-started' });

    expect(meta.title).toBe('Getting Started');
  });

  it('uses the resolved team hub name for team hub admin tabs', () => {
    const meta = pageTabMeta(
      { type: 'team-hub-admin', hubId: 'hub-123', label: 'Local' },
      { teamHubName: 'Local' }
    );

    expect(meta.title).toBe('Local');
  });

  it('falls back to Untitled for team hub admin tabs without a resolved name', () => {
    const meta = pageTabMeta({ type: 'team-hub-admin', hubId: 'hub-123' });

    expect(meta.title).toBe('Untitled');
    expect(meta.title).not.toBe('Team Hub');
  });

  it('uses the resolved runner target name for collection runner tabs', () => {
    const meta = pageTabMeta(
      { type: 'collection-runner', collectionId: 1 },
      { runnerTargetName: 'Demo API' }
    );

    expect(meta.title).toBe('Run Demo API');
  });

  it('falls back to Runner when no collection runner target name is resolved', () => {
    const meta = pageTabMeta({ type: 'collection-runner', collectionId: 1 });

    expect(meta.title).toBe('Runner');
  });

  it('uses the stored label for plugin detail tabs', () => {
    const meta = pageTabMeta({
      type: 'plugin-detail',
      kind: 'plugins',
      source: 'installed',
      id: 'curl',
      label: 'cURL'
    });

    expect(meta.title).toBe('cURL');
  });

  it('uses the stored label for snippet edit tabs', () => {
    const meta = pageTabMeta({
      type: 'snippet-edit',
      mode: 'new',
      label: 'New snippet'
    });

    expect(meta.title).toBe('New snippet');
  });

  it('uses the stored label for script editor tabs', () => {
    const meta = pageTabMeta({
      type: 'script-editor',
      requestTabId: 'tab-1',
      phase: 'pre',
      scriptId: 'script-1',
      label: 'Auth helper'
    });

    expect(meta.title).toBe('Auth helper');
  });

  it('uses the stored label for response viewer tabs', () => {
    const meta = pageTabMeta({
      type: 'response-viewer',
      requestTabId: 'tab-1',
      viewerTab: 'body',
      label: 'Get Users — Body'
    });

    expect(meta.title).toBe('Get Users — Body');
  });

  it('uses the shortened label for image view tabs', () => {
    const meta = pageTabMeta({
      type: 'image-view',
      fileName: 'screenshot-2024-01-15-at-midnight.png',
      shortLabel: 'screenshot…night.png',
      source: { kind: 'path', path: '/tmp/screenshot-2024-01-15-at-midnight.png' }
    });

    expect(meta.title).toBe('screenshot…night.png');
  });

  it('uses the resolved live server name for live-server logs tabs', () => {
    const meta = pageTabMeta(
      { type: 'live-server-logs', savedId: 3 },
      { liveServerName: 'Docs site' }
    );

    expect(meta.title).toBe('Logs: Docs site');
  });

  it('falls back when no live server name is resolved for logs tabs', () => {
    const meta = pageTabMeta({ type: 'live-server-logs', savedId: 3 });

    expect(meta.title).toBe('Live server logs');
  });
});
