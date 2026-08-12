import { describe, expect, it } from 'vitest';
import { resolveVariableSelectionTooltipAction } from './variableSelectionTooltipAction.js';

describe('resolveVariableSelectionTooltipAction', () => {
  it('hides when the caret is not inside a variable token', () => {
    expect(
      resolveVariableSelectionTooltipAction({
        hasMatch: false,
        selectionSet: true,
        docChanged: false,
        pointerSelect: false,
        isOpen: true
      })
    ).toBe('hide');
  });

  it('hides on pointer caret placement so click does not stick the popup', () => {
    expect(
      resolveVariableSelectionTooltipAction({
        hasMatch: true,
        selectionSet: true,
        docChanged: false,
        pointerSelect: true,
        isOpen: false
      })
    ).toBe('hide');
  });

  it('shows on keyboard (non-pointer) selection into a variable', () => {
    expect(
      resolveVariableSelectionTooltipAction({
        hasMatch: true,
        selectionSet: true,
        docChanged: false,
        pointerSelect: false,
        isOpen: false
      })
    ).toBe('show');
  });

  it('repositions an open tooltip when the document changes inside a variable', () => {
    expect(
      resolveVariableSelectionTooltipAction({
        hasMatch: true,
        selectionSet: false,
        docChanged: true,
        pointerSelect: false,
        isOpen: true
      })
    ).toBe('show');
  });

  it('does not open from a document change alone after a click cleared the tooltip', () => {
    expect(
      resolveVariableSelectionTooltipAction({
        hasMatch: true,
        selectionSet: false,
        docChanged: true,
        pointerSelect: false,
        isOpen: false
      })
    ).toBe('ignore');
  });
});
