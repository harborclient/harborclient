import { describe, expect, it } from 'vitest';
import {
  customThemeExportSchema,
  envelopeToCustomTheme,
  envelopeToImportDraft,
  formatCustomThemeValue,
  isValidCustomThemeId,
  parseCustomThemeSource,
  validateCustomThemeExport
} from '#/shared/plugin/customThemeExport';

describe('customThemeExport', () => {
  const sampleExport = {
    harborclientVersion: 1 as const,
    harborclientExport: 'theme' as const,
    title: 'Nord',
    type: 'dark' as const,
    theme: {
      surface: '#2e3440',
      accent: '#88c0d0'
    }
  };

  it('validates a portable theme export envelope', () => {
    expect(validateCustomThemeExport(sampleExport)).toEqual(sampleExport);
  });

  it('validates scrollbar color tokens in theme exports', () => {
    const exportWithScrollbars = {
      ...sampleExport,
      theme: {
        ...sampleExport.theme,
        'scrollbar-track': 'transparent',
        'scrollbar-thumb': 'rgba(0, 0, 0, 0.28)',
        'scrollbar-thumb-hover': 'rgba(0, 0, 0, 0.42)',
        'scrollbar-thumb-active': 'rgba(0, 0, 0, 0.55)'
      }
    };

    expect(validateCustomThemeExport(exportWithScrollbars)).toEqual(exportWithScrollbars);
  });

  it('rejects unknown theme tokens in exports', () => {
    const result = customThemeExportSchema.safeParse({
      ...sampleExport,
      theme: {
        ...sampleExport.theme,
        'scrollbar-invalid': '#000000'
      }
    });
    expect(result.success).toBe(false);
  });

  it('rejects export files with the wrong discriminator', () => {
    const result = customThemeExportSchema.safeParse({
      ...sampleExport,
      harborclientExport: 'environment'
    });
    expect(result.success).toBe(false);
  });

  it('parses and formats custom theme source values', () => {
    expect(formatCustomThemeValue('my-theme')).toBe('custom:my-theme');
    expect(parseCustomThemeSource('custom:my-theme')).toEqual({ id: 'my-theme' });
    expect(parseCustomThemeSource('plugin:foo:bar')).toBeNull();
  });

  it('converts envelopes to custom themes and import drafts', () => {
    expect(envelopeToCustomTheme('my-theme', sampleExport)).toEqual({
      id: 'my-theme',
      title: 'Nord',
      type: 'dark',
      colors: sampleExport.theme
    });
    expect(envelopeToImportDraft(sampleExport)).toEqual({
      title: 'Nord',
      type: 'dark',
      colors: sampleExport.theme
    });
  });

  it('validates custom theme ids used as filename stems', () => {
    expect(isValidCustomThemeId('my-theme_1')).toBe(true);
    expect(isValidCustomThemeId('../escape')).toBe(false);
  });
});
