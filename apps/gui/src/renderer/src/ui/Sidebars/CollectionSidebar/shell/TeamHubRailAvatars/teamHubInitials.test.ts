import { describe, expect, it } from 'vitest';
import { teamHubAvatarColorClass, teamHubInitials } from './teamHubInitials';

describe('teamHubInitials', () => {
  it('uses the first letter of the first two words', () => {
    expect(teamHubInitials('Local Sean')).toBe('LS');
    expect(teamHubInitials('Sean (OVH)')).toBe('SO');
  });

  it('uses the first two letters of a single token', () => {
    expect(teamHubInitials('OVH')).toBe('OV');
    expect(teamHubInitials('A')).toBe('A');
  });

  it('returns a placeholder for blank names', () => {
    expect(teamHubInitials('')).toBe('?');
    expect(teamHubInitials('   ')).toBe('?');
  });

  it('skips non-letter characters when picking initials', () => {
    expect(teamHubInitials('123 Alpha')).toBe('A');
    expect(teamHubInitials('(Sean)')).toBe('SE');
    expect(teamHubInitials('(A)')).toBe('A');
  });
});

describe('teamHubAvatarColorClass', () => {
  it('returns a stable palette class for the same hub id', () => {
    expect(teamHubAvatarColorClass('hub-a')).toBe(teamHubAvatarColorClass('hub-a'));
  });

  it('returns a known palette class', () => {
    expect(teamHubAvatarColorClass('hub-a')).toMatch(/^bg-/);
  });
});
