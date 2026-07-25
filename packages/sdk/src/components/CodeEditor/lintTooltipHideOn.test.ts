import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { lintTooltipHideOn } from './lintTooltipHideOn.js';

describe('lintTooltipHideOn', () => {
  it('returns false when the transaction does not change the document', () => {
    const state = EditorState.create({ doc: 'hc.expect(true).to.be.ok();' });
    const tr = state.update({});

    expect(lintTooltipHideOn(tr, 3, 9)).toBe(false);
  });

  it('returns true when the transaction edits inside the hovered range', () => {
    const state = EditorState.create({ doc: 'hc.expect(true).to.be.ok();' });
    const tr = state.update({
      changes: { from: 3, to: 9, insert: 'assert' }
    });

    expect(lintTooltipHideOn(tr, 3, 9)).toBe(true);
  });

  it('returns false when the transaction edits outside the hovered range', () => {
    const state = EditorState.create({ doc: 'hc.expect(true).to.be.ok();' });
    const tr = state.update({
      changes: { from: 0, to: 2, insert: 'x' }
    });

    expect(lintTooltipHideOn(tr, 10, 14)).toBe(false);
  });
});
