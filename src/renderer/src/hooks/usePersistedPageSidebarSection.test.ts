import { describe, expect, it } from 'vitest';
import { resolvePageSidebarSection } from '#/renderer/src/hooks/usePersistedPageSidebarSection.resolve';

const isSettingsSection = (section: string): section is 'general' | 'proxy' | 'ai' =>
  section === 'general' || section === 'proxy' || section === 'ai';

describe('resolvePageSidebarSection', () => {
  it('prefers explicit navigation overrides', () => {
    expect(
      resolvePageSidebarSection({
        defaultSection: 'general',
        navigationOverride: 'ai',
        persisted: 'proxy',
        isValidSection: isSettingsSection
      })
    ).toBe('ai');
  });

  it('uses persisted memory when no override is present', () => {
    expect(
      resolvePageSidebarSection({
        defaultSection: 'general',
        persisted: 'proxy',
        isValidSection: isSettingsSection
      })
    ).toBe('proxy');
  });

  it('falls back to the default when persisted and override values are invalid', () => {
    expect(
      resolvePageSidebarSection({
        defaultSection: 'general',
        navigationOverride: 'shortcuts' as 'general',
        persisted: 'shortcuts',
        isValidSection: isSettingsSection
      })
    ).toBe('general');
  });
});
