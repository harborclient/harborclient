import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getPath = vi.fn();

vi.mock('electron', () => ({
  app: {
    getPath,
    isPackaged: false,
    getAppPath: vi.fn(() => join(process.cwd()))
  }
}));

let userDataPath = '';

describe('customThemes storage', () => {
  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'harborclient-custom-themes-'));
    getPath.mockReturnValue(userDataPath);
    vi.resetModules();
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

  it('seeds missing built-in themes and marks them as builtin', async () => {
    const { getCustomTheme, listCustomThemes, seedMissingBuiltinThemes } =
      await import('#/main/storage/customThemes');

    seedMissingBuiltinThemes();

    const themes = listCustomThemes();
    expect(themes).toHaveLength(3);
    expect(themes.every((theme) => theme.builtin === true)).toBe(true);
    expect(themes.map((theme) => theme.id)).toEqual(['light', 'dark', 'high-contrast']);
    expect(getCustomTheme('light')?.title).toBe('Light');
  });

  it('does not overwrite existing built-in files during seeding', async () => {
    const { getCustomTheme, seedMissingBuiltinThemes } =
      await import('#/main/storage/customThemes');

    seedMissingBuiltinThemes();
    const directory = join(userDataPath, 'custom_themes');
    writeFileSync(
      join(directory, 'light.json'),
      `${JSON.stringify(
        {
          harborclientVersion: 1,
          harborclientExport: 'theme',
          title: 'Edited Light',
          type: 'light',
          theme: { surface: '#111111', accent: '#222222' }
        },
        null,
        2
      )}\n`,
      'utf-8'
    );

    seedMissingBuiltinThemes();

    expect(getCustomTheme('light')?.title).toBe('Edited Light');
    expect(getCustomTheme('light')?.colors.surface).toBe('#111111');
  });

  it('restores one built-in theme from packaged resources', async () => {
    const { getCustomTheme, restoreBuiltinTheme, seedMissingBuiltinThemes } =
      await import('#/main/storage/customThemes');

    seedMissingBuiltinThemes();
    const directory = join(userDataPath, 'custom_themes');
    writeFileSync(
      join(directory, 'dark.json'),
      `${JSON.stringify(
        {
          harborclientVersion: 1,
          harborclientExport: 'theme',
          title: 'Edited Dark',
          type: 'dark',
          theme: { surface: '#111111', accent: '#222222' }
        },
        null,
        2
      )}\n`,
      'utf-8'
    );

    const restored = restoreBuiltinTheme('dark');

    expect(restored.builtin).toBe(true);
    expect(restored.title).toBe('Dark');
    expect(getCustomTheme('dark')?.colors.surface).toBe('#1e1e1e');
  });

  it('rejects deleting built-in themes', async () => {
    const { deleteCustomTheme, seedMissingBuiltinThemes } =
      await import('#/main/storage/customThemes');

    seedMissingBuiltinThemes();

    expect(() => deleteCustomTheme('light')).toThrow('Built-in themes cannot be deleted');
  });

  it('allows saving edits to built-in themes', async () => {
    const { getCustomTheme, saveCustomTheme, seedMissingBuiltinThemes } =
      await import('#/main/storage/customThemes');

    seedMissingBuiltinThemes();
    const saved = saveCustomTheme({
      id: 'light',
      title: 'Custom Light',
      type: 'light',
      colors: {
        surface: '#fefefe',
        accent: '#123456'
      }
    });

    expect(saved.builtin).toBe(true);
    expect(getCustomTheme('light')?.title).toBe('Custom Light');
    expect(getCustomTheme('light')?.colors.accent).toBe('#123456');
  });
});
