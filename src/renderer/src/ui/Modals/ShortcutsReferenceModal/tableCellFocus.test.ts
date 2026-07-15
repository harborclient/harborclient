import type { FocusEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { focusShortcutTableCell } from '#/renderer/src/ui/Modals/ShortcutsReferenceModal/tableCellFocus';

describe('focusShortcutTableCell', () => {
  it('scrolls the focused cell into view inside the shortcuts table', () => {
    const scrollIntoView = vi.fn();
    const cell = { scrollIntoView } as unknown as HTMLTableCellElement;

    focusShortcutTableCell({
      currentTarget: cell
    } as FocusEvent<HTMLTableCellElement>);

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
  });
});
