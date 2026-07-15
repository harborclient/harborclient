import { describe, expect, it } from 'vitest';
import {
  formatTrashDeletedAt,
  trashEntityTypeLabel
} from '#/renderer/src/ui/Sidebars/CollectionSidebar/Trash/utils';

describe('trash sidebar utils', () => {
  it('maps entity types to readable labels', () => {
    expect(trashEntityTypeLabel('collection')).toBe('Collection');
    expect(trashEntityTypeLabel('runResult')).toBe('Run');
    expect(trashEntityTypeLabel('tabGroup')).toBe('Tab group');
  });

  it('formats deleted timestamps for display', () => {
    expect(formatTrashDeletedAt('not-a-date')).toBe('not-a-date');
    expect(formatTrashDeletedAt('2026-01-15T18:30:00.000Z')).toMatch(/Jan/);
  });
});
