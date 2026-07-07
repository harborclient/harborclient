import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getPath = vi.fn();

vi.mock('electron', () => ({
  app: {
    getPath
  }
}));

let userDataPath = '';

describe('customThemes storage', () => {
  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'harborclient-custom-themes-'));
    getPath.mockReturnValue(userDataPath);
  });

  afterEach(() => {
    rmSync(userDataPath, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('saves, lists, reads, and deletes custom theme files', async () => {
    const { deleteCustomTheme, getCustomTheme, listCustomThemes, saveCustomTheme } =
      await import('#/main/storage/customThemes');

    const saved = saveCustomTheme({
      title: 'Default',
      type: 'light',
      colors: {
        surface: '#f5f5f7',
        accent: '#007aff'
      }
    });

    expect(saved.id).toBeTruthy();
    expect(listCustomThemes()).toEqual([saved]);
    expect(getCustomTheme(saved.id)).toEqual(saved);

    const fileContents = JSON.parse(
      readFileSync(join(userDataPath, 'custom_themes', `${saved.id}.json`), 'utf-8')
    ) as {
      harborclientExport: string;
      title: string;
      theme: Record<string, string>;
    };
    expect(fileContents.harborclientExport).toBe('theme');
    expect(fileContents.title).toBe('Default');
    expect(fileContents.theme.surface).toBe('#f5f5f7');

    deleteCustomTheme(saved.id);
    expect(listCustomThemes()).toEqual([]);
  });
});
