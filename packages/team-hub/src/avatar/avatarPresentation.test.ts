import { describe, expect, it } from 'vitest';
import {
  avatarColorFromSeed,
  avatarInitialsFromName,
  defaultAvatarPresentation,
  normalizeAvatarColor,
  normalizeAvatarInitials
} from '#/avatar/avatarPresentation.js';

describe('avatarInitialsFromName', () => {
  it('derives two initials from first and last name words', () => {
    expect(avatarInitialsFromName('Jane Doe')).toBe('JD');
  });

  it('falls back to the first two letters of a single token', () => {
    expect(avatarInitialsFromName('Harbor')).toBe('HA');
  });

  it('returns ? for empty names', () => {
    expect(avatarInitialsFromName('   ')).toBe('?');
  });
});

describe('avatarColorFromSeed', () => {
  it('returns a stable color for the same seed', () => {
    expect(avatarColorFromSeed('user-123')).toBe(avatarColorFromSeed('user-123'));
  });
});

describe('defaultAvatarPresentation', () => {
  it('combines initials from the name and color from the seed', () => {
    expect(defaultAvatarPresentation('Alice Example', 'user-abc')).toEqual({
      initials: 'AE',
      color: avatarColorFromSeed('user-abc')
    });
  });
});

describe('normalizeAvatarInitials', () => {
  it('accepts one or two letters', () => {
    expect(normalizeAvatarInitials('ab')).toBe('AB');
  });

  it('rejects non-letter characters', () => {
    expect(() => normalizeAvatarInitials('A1')).toThrow(/letters only/i);
  });
});

describe('normalizeAvatarColor', () => {
  it('accepts supported palette keys', () => {
    expect(normalizeAvatarColor('sky-600')).toBe('sky-600');
  });

  it('rejects unknown palette keys', () => {
    expect(() => normalizeAvatarColor('pink-600')).toThrow(/must be one of/i);
  });
});
