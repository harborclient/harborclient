import { describe, expect, it } from 'vitest';
import { pluginSidebarSections } from './sidebarConstants';

describe('pluginSidebarSections', () => {
  it('includes Settings on the Plugins tab', () => {
    expect(pluginSidebarSections('plugins').map((item) => item.value)).toEqual([
      'installed',
      'marketplace',
      'install',
      'settings'
    ]);
  });

  it('omits Settings and adds Designer on the Themes tab', () => {
    expect(pluginSidebarSections('themes').map((item) => item.value)).toEqual([
      'installed',
      'marketplace',
      'designer',
      'install'
    ]);
  });
});
