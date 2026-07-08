import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const confirmDuplicateImport = vi.fn();
const { getPath } = vi.hoisted(() => ({
  getPath: vi.fn()
}));

vi.mock('#/main/ipc/handlers/importDialogs', () => ({
  confirmDuplicateImport: (...args: unknown[]) => confirmDuplicateImport(...args)
}));

vi.mock('electron', () => ({
  app: {
    getPath
  }
}));

const themeExport = {
  harborclientVersion: 1 as const,
  harborclientExport: 'theme' as const,
  title: 'Ocean Dark',
  type: 'dark' as const,
  theme: {
    surface: '#0f172a',
    accent: '#38bdf8'
  }
};

let userDataPath = '';

describe('importCustomThemeData', () => {
  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'harborclient-theme-import-'));
    getPath.mockReturnValue(userDataPath);
    confirmDuplicateImport.mockReset();
    vi.resetModules();
  });

  afterEach(() => {
    rmSync(userDataPath, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('creates a theme when the title is new', async () => {
    const { listCustomThemes } = await import('#/main/storage/customThemes');
    const { importCustomThemeData } = await import('#/main/ipc/handlers/customThemeImport');
    const result = await importCustomThemeData(null, themeExport);

    expect(result?.action).toBe('created');
    expect(result?.theme.title).toBe('Ocean Dark');
    expect(listCustomThemes()).toHaveLength(1);
  });

  it('updates an existing theme when the user chooses update', async () => {
    const { listCustomThemes, saveCustomTheme } = await import('#/main/storage/customThemes');
    const { importCustomThemeData } = await import('#/main/ipc/handlers/customThemeImport');
    const existing = saveCustomTheme({
      title: 'Ocean Dark',
      type: 'light',
      colors: { surface: '#ffffff' }
    });
    confirmDuplicateImport.mockResolvedValue('update');

    const result = await importCustomThemeData(null, themeExport);

    expect(result?.action).toBe('updated');
    expect(result?.theme.id).toBe(existing.id);
    expect(result?.theme.type).toBe('dark');
    expect(result?.theme.colors.accent).toBe('#38bdf8');
    expect(listCustomThemes()).toHaveLength(1);
  });

  it('creates a copy when the user chooses import as new copy', async () => {
    const { listCustomThemes, saveCustomTheme } = await import('#/main/storage/customThemes');
    const { importCustomThemeData } = await import('#/main/ipc/handlers/customThemeImport');
    const existing = saveCustomTheme({
      title: 'Ocean Dark',
      type: 'light',
      colors: { surface: '#ffffff' }
    });
    confirmDuplicateImport.mockResolvedValue('copy');

    const result = await importCustomThemeData(null, themeExport);

    expect(result?.action).toBe('created');
    expect(listCustomThemes()).toHaveLength(2);
    expect(result?.theme.id).not.toBe(existing.id);
  });

  it('returns null when the user cancels a duplicate import', async () => {
    const { listCustomThemes, saveCustomTheme } = await import('#/main/storage/customThemes');
    const { importCustomThemeData } = await import('#/main/ipc/handlers/customThemeImport');
    saveCustomTheme({
      title: 'Ocean Dark',
      type: 'light',
      colors: { surface: '#ffffff' }
    });
    confirmDuplicateImport.mockResolvedValue('cancel');

    const result = await importCustomThemeData(null, themeExport);

    expect(result).toBeNull();
    expect(listCustomThemes()).toHaveLength(1);
  });
});
