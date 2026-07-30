import { describe, expect, it } from 'vitest';
import type { BrowserDownloadEntry } from '@harborclient/core/types/api/browser';
import {
  BROWSER_RECENT_DOWNLOADS_MAX,
  prependRecentDownload,
  removeRecentDownload,
  updateRecentDownload
} from '#/main/browser/browserRecentDownloads';

/**
 * Builds a download entry for ring-buffer tests.
 *
 * @param id - Entry id used as the filename stem.
 * @param status - Download status (defaults to completed).
 * @returns Minimal download fixture.
 */
function entry(
  id: string,
  status: BrowserDownloadEntry['status'] = 'completed'
): BrowserDownloadEntry {
  return {
    id,
    fileName: `${id}.bin`,
    filePath: `/tmp/${id}.bin`,
    sizeBytes: 100,
    completedAt: status === 'completed' ? Date.now() : 0,
    status
  };
}

describe('prependRecentDownload', () => {
  it('prepends newest entries first', () => {
    const first = entry('a');
    const second = entry('b');
    const list = prependRecentDownload(prependRecentDownload([], first), second);
    expect(list.map((item) => item.id)).toEqual(['b', 'a']);
  });

  it(`caps the list at ${BROWSER_RECENT_DOWNLOADS_MAX}`, () => {
    let list: BrowserDownloadEntry[] = [];
    for (let i = 0; i < BROWSER_RECENT_DOWNLOADS_MAX + 2; i += 1) {
      list = prependRecentDownload(list, entry(`d${i}`));
    }
    expect(list).toHaveLength(BROWSER_RECENT_DOWNLOADS_MAX);
    expect(list.map((item) => item.id)).toEqual(['d6', 'd5', 'd4', 'd3', 'd2']);
  });
});

describe('updateRecentDownload', () => {
  it('replaces an existing entry by id without changing order', () => {
    const list = prependRecentDownload(prependRecentDownload([], entry('a')), entry('b'));
    const updated = updateRecentDownload(list, {
      ...entry('a'),
      sizeBytes: 999,
      status: 'completed'
    });
    expect(updated.map((item) => item.id)).toEqual(['b', 'a']);
    expect(updated[1]?.sizeBytes).toBe(999);
  });

  it('prepends when the id is missing', () => {
    const list = prependRecentDownload([], entry('a'));
    const updated = updateRecentDownload(list, entry('missing'));
    expect(updated.map((item) => item.id)).toEqual(['missing', 'a']);
  });
});

describe('removeRecentDownload', () => {
  it('removes the matching id', () => {
    const list = prependRecentDownload(prependRecentDownload([], entry('a')), entry('b'));
    expect(removeRecentDownload(list, 'b').map((item) => item.id)).toEqual(['a']);
  });

  it('returns the same ids when the id is absent', () => {
    const list = prependRecentDownload([], entry('a'));
    expect(removeRecentDownload(list, 'nope').map((item) => item.id)).toEqual(['a']);
  });
});
