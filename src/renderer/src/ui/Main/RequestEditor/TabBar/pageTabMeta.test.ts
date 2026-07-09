import { describe, expect, it } from 'vitest';
import { pageTabMeta } from '#/renderer/src/ui/Main/RequestEditor/TabBar/pageTabMeta';

describe('pageTabMeta', () => {
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
});
