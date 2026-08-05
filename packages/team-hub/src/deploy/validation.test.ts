import { describe, expect, it } from 'vitest';
import {
  isSafeDirectoryPath,
  isValidComposeProjectName,
  isValidImageTag,
  isValidPort
} from '#/deploy/validation.js';

describe('deploy validation', () => {
  it('accepts valid image tags', () => {
    expect(isValidImageTag('latest')).toBe(true);
    expect(isValidImageTag('1.2.3')).toBe(true);
    expect(isValidImageTag('0.7.6-rc.1')).toBe(true);
  });

  it('rejects unsafe image tags', () => {
    expect(isValidImageTag('')).toBe(false);
    expect(isValidImageTag('latest;rm -rf /')).toBe(false);
    expect(isValidImageTag('a'.repeat(129))).toBe(false);
  });

  it('validates TCP ports', () => {
    expect(isValidPort('8080')).toBe(true);
    expect(isValidPort('0')).toBe(false);
    expect(isValidPort('70000')).toBe(false);
    expect(isValidPort('abc')).toBe(false);
  });

  it('validates deployment directory paths', () => {
    expect(isSafeDirectoryPath('/home/user/.config/team-hub')).toBe(true);
    expect(isSafeDirectoryPath('/tmp/evil;rm')).toBe(false);
  });

  it('validates compose project names', () => {
    expect(isValidComposeProjectName('team-hub')).toBe(true);
    expect(isValidComposeProjectName('team hub')).toBe(false);
  });
});
