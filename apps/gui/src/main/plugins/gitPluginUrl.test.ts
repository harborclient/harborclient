import { describe, expect, it } from 'vitest';
import { assertSafeGitPluginUrl } from './gitPluginUrl';

describe('assertSafeGitPluginUrl', () => {
  it('accepts https repository URLs', () => {
    expect(assertSafeGitPluginUrl('https://github.com/example/my-plugin.git')).toBe(
      'https://github.com/example/my-plugin.git'
    );
  });

  it('accepts http repository URLs', () => {
    expect(assertSafeGitPluginUrl(' http://git.example.com/plugins/demo.git ')).toBe(
      'http://git.example.com/plugins/demo.git'
    );
  });

  it('rejects empty URLs', () => {
    expect(() => assertSafeGitPluginUrl('   ')).toThrow(/required/i);
  });

  it('rejects ssh-style URLs', () => {
    expect(() => assertSafeGitPluginUrl('git@github.com:example/my-plugin.git')).toThrow(/ssh/i);
  });

  it('rejects file URLs', () => {
    expect(() => assertSafeGitPluginUrl('file:///tmp/my-plugin')).toThrow(/http and https/i);
  });

  it('rejects relative paths', () => {
    expect(() => assertSafeGitPluginUrl('../my-plugin')).toThrow(/not valid/i);
  });
});
