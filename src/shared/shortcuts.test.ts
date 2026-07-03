import { describe, expect, it } from 'vitest';
import {
  acceleratorMatchesChord,
  bindingsToOverrides,
  formatAcceleratorDisplay,
  getShortcutDef,
  normalizeAcceleratorForCompare,
  normalizeShortcutOverrides,
  resolveShortcuts,
  validateShortcutOverrides,
  type KeyChord
} from '#/shared/shortcuts';

describe('normalizeShortcutOverrides', () => {
  it('returns an empty object for invalid input', () => {
    expect(normalizeShortcutOverrides(null)).toEqual({});
    expect(normalizeShortcutOverrides('bad')).toEqual({});
  });

  it('keeps known ids and drops unknown or empty values', () => {
    expect(
      normalizeShortcutOverrides({
        save: 'CmdOrCtrl+Shift+S',
        unknown: 'CmdOrCtrl+K',
        settings: '   '
      })
    ).toEqual({
      save: 'CmdOrCtrl+Shift+S'
    });
  });
});

describe('resolveShortcuts', () => {
  it('uses defaults when no overrides are present', () => {
    const save = resolveShortcuts({}).find((binding) => binding.id === 'save');
    expect(save?.accelerator).toBe('CmdOrCtrl+S');
    expect(save?.defaultAccelerator).toBe('CmdOrCtrl+S');
  });

  it('applies overrides on top of defaults', () => {
    const save = resolveShortcuts({ save: 'CmdOrCtrl+Alt+S' }).find(
      (binding) => binding.id === 'save'
    );
    expect(save?.accelerator).toBe('CmdOrCtrl+Alt+S');
  });

  it('includes default bindings for File menu shortcuts', () => {
    const bindings = resolveShortcuts({});
    expect(bindings.find((binding) => binding.id === 'sync')?.accelerator).toBe(
      'CmdOrCtrl+Shift+S'
    );
    expect(bindings.find((binding) => binding.id === 'plugins')?.accelerator).toBe('Alt+Shift+P');
    expect(bindings.find((binding) => binding.id === 'team-hubs')?.accelerator).toBe(
      'CmdOrCtrl+Shift+H'
    );
    expect(bindings.find((binding) => binding.id === 'sharing-keys')?.accelerator).toBe(
      'CmdOrCtrl+Shift+K'
    );
    expect(bindings.find((binding) => binding.id === 'import')?.accelerator).toBe(
      'CmdOrCtrl+Shift+I'
    );
  });

  it('includes default bindings for Help menu shortcuts', () => {
    const bindings = resolveShortcuts({});
    expect(bindings.find((binding) => binding.id === 'documentation')?.accelerator).toBe(
      'CmdOrCtrl+Shift+D'
    );
    expect(bindings.find((binding) => binding.id === 'report-issue')?.accelerator).toBe(
      'CmdOrCtrl+Shift+R'
    );
    expect(bindings.find((binding) => binding.id === 'check-for-updates')?.accelerator).toBe(
      'CmdOrCtrl+Shift+U'
    );
    expect(bindings.find((binding) => binding.id === 'shortcuts-reference')?.accelerator).toBe(
      'Alt+Shift+K'
    );
    expect(bindings.find((binding) => binding.id === 'search-anything')?.accelerator).toBe(
      'CmdOrCtrl+Shift+P'
    );
    expect(bindings.find((binding) => binding.id === 'about')?.accelerator).toBe(
      'CmdOrCtrl+Shift+A'
    );
  });

  it('includes default bindings for request shortcuts', () => {
    const bindings = resolveShortcuts({});
    expect(bindings.find((binding) => binding.id === 'send-request')?.accelerator).toBe('F5');
    expect(bindings.find((binding) => binding.id === 'previous-request-tab')?.accelerator).toBe(
      'CmdOrCtrl+Shift+Comma'
    );
    expect(bindings.find((binding) => binding.id === 'next-request-tab')?.accelerator).toBe(
      'CmdOrCtrl+Shift+Period'
    );
    expect(bindings.find((binding) => binding.id === 'set-method-get')?.accelerator).toBe(
      'Alt+Shift+1'
    );
    expect(bindings.find((binding) => binding.id === 'set-method-post')?.accelerator).toBe(
      'Alt+Shift+2'
    );
    expect(bindings.find((binding) => binding.id === 'set-method-put')?.accelerator).toBe(
      'Alt+Shift+3'
    );
    expect(bindings.find((binding) => binding.id === 'set-method-patch')?.accelerator).toBe(
      'Alt+Shift+4'
    );
    expect(bindings.find((binding) => binding.id === 'set-method-delete')?.accelerator).toBe(
      'Alt+Shift+5'
    );
    expect(bindings.find((binding) => binding.id === 'set-method-head')?.accelerator).toBe(
      'Alt+Shift+6'
    );
    expect(bindings.find((binding) => binding.id === 'set-method-options')?.accelerator).toBe(
      'Alt+Shift+7'
    );
    expect(bindings.find((binding) => binding.id === 'focus-sidebar-search')?.accelerator).toBe(
      'CmdOrCtrl+F'
    );
    expect(bindings.find((binding) => binding.id === 'focus-request-url')?.accelerator).toBe(
      'Alt+Shift+R'
    );
    expect(bindings.find((binding) => binding.id === 'focus-first-collection')?.accelerator).toBe(
      'Alt+Shift+C'
    );
    expect(bindings.find((binding) => binding.id === 'focus-first-environment')?.accelerator).toBe(
      'Alt+Shift+E'
    );
    expect(bindings.find((binding) => binding.id === 'focus-first-request-tab')?.accelerator).toBe(
      'Alt+Shift+O'
    );
    expect(bindings.find((binding) => binding.id === 'focus-response-editor')?.accelerator).toBe(
      'Alt+Shift+T'
    );
    expect(bindings.find((binding) => binding.id === 'toggle-variables')?.accelerator).toBe(
      'Alt+Shift+V'
    );
    expect(bindings.find((binding) => binding.id === 'toggle-console')?.accelerator).toBe(
      'Alt+Shift+L'
    );
    expect(bindings.find((binding) => binding.id === 'next-sidebar-list-item')?.accelerator).toBe(
      'CmdOrCtrl+Tab'
    );
    expect(
      bindings.find((binding) => binding.id === 'previous-sidebar-list-item')?.accelerator
    ).toBe('CmdOrCtrl+Shift+Tab');
  });

  it('includes default bindings for sidebar section toggles', () => {
    const bindings = resolveShortcuts({});
    expect(bindings.find((binding) => binding.id === 'toggle-sidebar')?.accelerator).toBe(
      'CmdOrCtrl+B'
    );
    expect(bindings.find((binding) => binding.id === 'toggle-ai-sidebar')?.accelerator).toBe(
      'CmdOrCtrl+Shift+B'
    );
    expect(bindings.find((binding) => binding.id === 'toggle-request-editor')?.accelerator).toBe(
      'CmdOrCtrl+Alt+R'
    );
    expect(bindings.find((binding) => binding.id === 'toggle-response-editor')?.accelerator).toBe(
      'CmdOrCtrl+Alt+Y'
    );
    expect(
      bindings.find((binding) => binding.id === 'toggle-collections-section')?.accelerator
    ).toBe('CmdOrCtrl+Shift+C');
    expect(
      bindings.find((binding) => binding.id === 'toggle-environments-section')?.accelerator
    ).toBe('CmdOrCtrl+Shift+E');
  });

  it('includes default bindings for zoom shortcuts', () => {
    const bindings = resolveShortcuts({});
    expect(bindings.find((binding) => binding.id === 'zoom-in')?.accelerator).toBe(
      'CmdOrCtrl+Plus'
    );
    expect(bindings.find((binding) => binding.id === 'zoom-out')?.accelerator).toBe('CmdOrCtrl+-');
    expect(bindings.find((binding) => binding.id === 'reset-zoom')?.accelerator).toBe(
      'CmdOrCtrl+0'
    );
  });
});

describe('bindingsToOverrides', () => {
  it('stores only values that differ from defaults', () => {
    const bindings = resolveShortcuts({ save: 'CmdOrCtrl+Alt+S' });
    expect(bindingsToOverrides(bindings)).toEqual({
      save: 'CmdOrCtrl+Alt+S'
    });
  });
});

describe('validateShortcutOverrides', () => {
  it('accepts valid overrides', () => {
    expect(validateShortcutOverrides({ save: 'CmdOrCtrl+Alt+S' }).valid).toBe(true);
  });

  it('accepts all default bindings without conflicts', () => {
    expect(validateShortcutOverrides({}).valid).toBe(true);
  });

  it('marks sidebar list navigation shortcuts as renderer-only', () => {
    expect(getShortcutDef('next-sidebar-list-item')?.rendererOnly).toBe(true);
    expect(getShortcutDef('previous-sidebar-list-item')?.rendererOnly).toBe(true);
    expect(getShortcutDef('next-sidebar-list-item')?.actionId).toBeUndefined();
  });

  it('rejects modifier-less letter keys', () => {
    const result = validateShortcutOverrides({ save: 'S' });
    expect(result.valid).toBe(false);
    expect(result.errors.save).toMatch(/modifier/i);
  });

  it('rejects duplicate accelerators', () => {
    const result = validateShortcutOverrides({
      save: 'CmdOrCtrl+Alt+S',
      settings: 'CmdOrCtrl+Alt+S'
    });
    expect(result.valid).toBe(false);
    expect(result.errors.save).toMatch(/already assigned/i);
    expect(result.errors.settings).toMatch(/already assigned/i);
  });

  it('allows standalone function keys', () => {
    expect(validateShortcutOverrides({ 'toggle-fullscreen': 'F11' }).valid).toBe(true);
  });
});

describe('formatAcceleratorDisplay', () => {
  it('formats accelerators for the settings table', () => {
    expect(formatAcceleratorDisplay('CmdOrCtrl+Shift+N')).toBe('ctrl-shift-n');
    expect(formatAcceleratorDisplay('CmdOrCtrl+,')).toBe('ctrl-comma');
    expect(formatAcceleratorDisplay('F11')).toBe('f11');
  });
});

describe('acceleratorMatchesChord', () => {
  const f5Chord: KeyChord = {
    key: 'F5',
    control: false,
    meta: false,
    alt: false,
    shift: false
  };

  it('matches standalone function keys', () => {
    expect(acceleratorMatchesChord('F5', f5Chord)).toBe(true);
    expect(acceleratorMatchesChord('F6', f5Chord)).toBe(false);
  });

  it('matches CmdOrCtrl chords from control or meta', () => {
    const controlF: KeyChord = {
      key: 'f',
      control: true,
      meta: false,
      alt: false,
      shift: false
    };
    const metaF: KeyChord = {
      key: 'f',
      control: false,
      meta: true,
      alt: false,
      shift: false
    };
    const plainF: KeyChord = {
      key: 'f',
      control: false,
      meta: false,
      alt: false,
      shift: false
    };

    expect(acceleratorMatchesChord('CmdOrCtrl+F', controlF)).toBe(true);
    expect(acceleratorMatchesChord('CmdOrCtrl+F', metaF)).toBe(true);
    expect(acceleratorMatchesChord('CmdOrCtrl+F', plainF)).toBe(false);
  });

  it('matches modifier chords with punctuation keys', () => {
    const previousTabChord: KeyChord = {
      key: ',',
      control: true,
      meta: false,
      alt: false,
      shift: true
    };

    expect(acceleratorMatchesChord('CmdOrCtrl+Shift+Comma', previousTabChord)).toBe(true);
    expect(acceleratorMatchesChord('CmdOrCtrl+Shift+Period', previousTabChord)).toBe(false);
  });

  it('normalizes equivalent modifier spellings', () => {
    expect(normalizeAcceleratorForCompare('CmdOrCtrl+Shift+Comma')).toBe(
      normalizeAcceleratorForCompare('Ctrl+Shift+,')
    );
  });

  it('matches Alt+Shift+digit when Shift produces a symbol key', () => {
    const altShiftBang: KeyChord = {
      key: '!',
      control: false,
      meta: false,
      alt: true,
      shift: true
    };

    expect(acceleratorMatchesChord('Alt+Shift+1', altShiftBang)).toBe(true);
    expect(acceleratorMatchesChord('Alt+Shift+2', { ...altShiftBang, key: '@' })).toBe(true);
    expect(acceleratorMatchesChord('Alt+Shift+7', { ...altShiftBang, key: '&' })).toBe(true);
  });

  it('matches Alt+Shift+O when Alt produces an unmapped character but code is KeyO', () => {
    const altShiftO: KeyChord = {
      key: 'ø',
      code: 'KeyO',
      control: false,
      meta: false,
      alt: true,
      shift: true
    };

    expect(acceleratorMatchesChord('Alt+Shift+O', altShiftO)).toBe(true);
    expect(acceleratorMatchesChord('Alt+Shift+O', { ...altShiftO, key: 'O' })).toBe(true);
  });

  it('matches Alt+Shift+P for Plugins when Shift produces uppercase P or code is KeyP', () => {
    const altShiftP: KeyChord = {
      key: 'p',
      code: 'KeyP',
      control: false,
      meta: false,
      alt: true,
      shift: true
    };

    expect(acceleratorMatchesChord('Alt+Shift+P', altShiftP)).toBe(true);
    expect(acceleratorMatchesChord('Alt+Shift+P', { ...altShiftP, key: 'P' })).toBe(true);
  });
});
