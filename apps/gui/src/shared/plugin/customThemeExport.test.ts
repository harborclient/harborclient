import { describe, expect, it } from 'vitest';
import {
  customThemeExportSchema,
  customThemeToEnvelope,
  envelopeToCustomTheme,
  envelopeToImportDraft,
  formatCustomThemeValue,
  isValidCustomThemeId,
  parseCustomThemeSource,
  validateCustomThemeExport
} from './customThemeExport';

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

  it('validates git request color tokens in theme exports', () => {
    const exportWithGitTokens = {
      ...sampleExport,
      theme: {
        ...sampleExport.theme,
        'git-staged': '#34c759',
        'git-uncommitted': '#ff9500',
        'git-unstaged': 'rgba(0, 0, 0, 0.58)',
        'git-untracked': '#34c759'
      }
    };

    expect(validateCustomThemeExport(exportWithGitTokens)).toEqual(exportWithGitTokens);
  });

  it('validates script stage color tokens in theme exports', () => {
    const exportWithScriptStages = {
      ...sampleExport,
      theme: {
        ...sampleExport.theme,
        'script-stage-before-all': '#1360ae',
        'script-stage-before-each': '#0a84ff',
        'script-stage-main': '#32d2e2',
        'script-stage-after-each': '#ff9f0a',
        'script-stage-after-all': '#ae7213'
      }
    };

    expect(validateCustomThemeExport(exportWithScriptStages)).toEqual(exportWithScriptStages);
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

  it('accepts an optional stylesheet field on theme exports', () => {
    const exportWithStylesheet = {
      ...sampleExport,
      stylesheet: 'styles.css'
    };
    expect(validateCustomThemeExport(exportWithStylesheet)).toEqual(exportWithStylesheet);
  });

  it('accepts inlined CSS as the stylesheet field', () => {
    const exportWithInlinedCss = {
      ...sampleExport,
      stylesheet: ':root { --mac-surface: #000; }'
    };
    expect(validateCustomThemeExport(exportWithInlinedCss)).toEqual(exportWithInlinedCss);
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

  it('preserves stylesheet through envelope conversions', () => {
    const exportWithStylesheet = {
      ...sampleExport,
      stylesheet: ':root[data-theme="custom"] { --extra: 1; }'
    };

    expect(envelopeToCustomTheme('styled', exportWithStylesheet)).toEqual({
      id: 'styled',
      title: 'Nord',
      type: 'dark',
      colors: sampleExport.theme,
      stylesheet: exportWithStylesheet.stylesheet
    });
    expect(envelopeToImportDraft(exportWithStylesheet)).toEqual({
      title: 'Nord',
      type: 'dark',
      colors: sampleExport.theme,
      stylesheet: exportWithStylesheet.stylesheet
    });
  });

  it('round-trips stylesheet through customThemeToEnvelope', () => {
    const envelope = customThemeToEnvelope({
      id: 'styled',
      title: 'Nord',
      type: 'dark',
      colors: sampleExport.theme,
      stylesheet: '.panel { opacity: 0.9; }'
    });

    expect(envelope.stylesheet).toBe('.panel { opacity: 0.9; }');
    expect(envelopeToCustomTheme('styled', envelope).stylesheet).toBe('.panel { opacity: 0.9; }');
  });

  it('omits empty stylesheet from export envelopes', () => {
    const envelope = customThemeToEnvelope({
      id: 'plain',
      title: 'Nord',
      type: 'dark',
      colors: sampleExport.theme,
      stylesheet: '   '
    });

    expect(envelope.stylesheet).toBeUndefined();
  });

  it('validates custom theme ids used as filename stems', () => {
    expect(isValidCustomThemeId('my-theme_1')).toBe(true);
    expect(isValidCustomThemeId('../escape')).toBe(false);
  });
});
