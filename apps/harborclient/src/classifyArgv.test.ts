import { afterEach, describe, expect, it } from 'vitest';
import { classifyArgv, getUserArgv } from './classifyArgv';

describe('getUserArgv', () => {
  const originalDefaultApp = process.defaultApp;

  /**
   * Restores `process.defaultApp` after each case.
   */
  afterEach(() => {
    Object.defineProperty(process, 'defaultApp', {
      value: originalDefaultApp,
      configurable: true
    });
  });

  it('skips execPath only when packaged (not defaultApp)', () => {
    Object.defineProperty(process, 'defaultApp', {
      value: undefined,
      configurable: true
    });
    expect(getUserArgv(['/usr/bin/harborclient', '--seed'])).toEqual(['--seed']);
  });

  it('skips electron and app path when defaultApp is set', () => {
    Object.defineProperty(process, 'defaultApp', {
      value: true,
      configurable: true
    });
    expect(getUserArgv(['electron', '/app', 'GET', 'https://example.com'])).toEqual([
      'GET',
      'https://example.com'
    ]);
  });
});

describe('classifyArgv', () => {
  it('opens the GUI when argv is empty', () => {
    expect(classifyArgv([])).toBe('gui');
  });

  it('selects help for -h and --help', () => {
    expect(classifyArgv(['-h'])).toBe('help');
    expect(classifyArgv(['--help'])).toBe('help');
    expect(classifyArgv(['GET', 'https://example.com', '--help'])).toBe('help');
  });

  it('selects version for -V and --version', () => {
    expect(classifyArgv(['-V'])).toBe('version');
    expect(classifyArgv(['--version'])).toBe('version');
  });

  it('selects CLI for HTTP methods, run, workflow, and servers', () => {
    expect(classifyArgv(['GET', 'https://example.com'])).toBe('cli');
    expect(classifyArgv(['post', 'https://example.com'])).toBe('cli');
    expect(classifyArgv(['run', 'My Collection'])).toBe('cli');
    expect(classifyArgv(['workflow', 'run', 'My Workflow'])).toBe('cli');
    expect(classifyArgv(['servers', 'run', 'Echo Server'])).toBe('cli');
    expect(classifyArgv(['OPTIONS', 'https://example.com', '-v'])).toBe('cli');
  });

  it('opens the GUI for deep links', () => {
    expect(classifyArgv(['harborclient://run/abc'])).toBe('gui');
  });

  it('opens the GUI for GUI-only flags and unknown tokens', () => {
    expect(classifyArgv(['--seed'])).toBe('gui');
    expect(classifyArgv(['--theme', 'dark'])).toBe('gui');
    expect(classifyArgv(['--verbose'])).toBe('gui');
    expect(classifyArgv(['--dev-mode'])).toBe('gui');
    expect(classifyArgv(['something-else'])).toBe('gui');
  });
});
