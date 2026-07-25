// @vitest-environment jsdom
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createSyntaxHighlightedPlaceholder,
  shouldShowSyntaxPlaceholder
} from './syntaxHighlightedPlaceholder.js';

const PLACEHOLDER_TEXT = 'hc.request.url = "https://example.com";';

/**
 * Returns whether the syntax-highlighted placeholder widget is mounted in the editor.
 *
 * @param view - CodeMirror editor view under test.
 */
function hasSyntaxPlaceholderDom(view: EditorView): boolean {
  return view.dom.querySelector('.cm-syntax-placeholder') != null;
}

describe('shouldShowSyntaxPlaceholder', () => {
  it('returns true for an empty, unfocused editor', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    const view = new EditorView({
      parent: host,
      state: EditorState.create({ doc: '' })
    });

    expect(shouldShowSyntaxPlaceholder(view, false)).toBe(true);

    view.destroy();
    host.remove();
  });

  it('returns false when the document has content', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    const view = new EditorView({
      parent: host,
      state: EditorState.create({ doc: 'console.log(1);' })
    });

    expect(shouldShowSyntaxPlaceholder(view, false)).toBe(false);

    view.destroy();
    host.remove();
  });
});

describe('createSyntaxHighlightedPlaceholder', () => {
  let host: HTMLDivElement;
  let controls: HTMLDivElement;
  let externalButton: HTMLButtonElement;
  let externalInput: HTMLInputElement;
  let view: EditorView;

  /**
   * Mounts an empty editor with placeholder extensions beside external controls.
   */
  beforeEach(() => {
    host = document.createElement('div');
    controls = document.createElement('div');
    externalButton = document.createElement('button');
    externalButton.type = 'button';
    externalButton.textContent = 'Add';
    externalInput = document.createElement('input');
    externalInput.type = 'text';
    controls.append(externalButton, externalInput);
    host.append(controls);
    document.body.appendChild(host);

    view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: '',
        extensions: createSyntaxHighlightedPlaceholder(PLACEHOLDER_TEXT, {
          fontSize: '16px',
          isDark: false,
          theme: 'default'
        })
      })
    });
  });

  /**
   * Destroys the editor and removes the test container.
   */
  afterEach(() => {
    view.destroy();
    host.remove();
  });

  it('shows the placeholder for an empty, unfocused editor', () => {
    expect(hasSyntaxPlaceholderDom(view)).toBe(true);
  });

  it('keeps the placeholder when mousedown targets a sibling control outside the editor', () => {
    externalButton.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    externalButton.focus();

    expect(hasSyntaxPlaceholderDom(view)).toBe(true);
  });

  it('hides the placeholder when mousedown targets the editor chrome', () => {
    view.contentDOM.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(hasSyntaxPlaceholderDom(view)).toBe(false);
  });

  it('restores the placeholder after focus leaves the editor with an empty document', () => {
    view.contentDOM.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    view.focus();
    expect(hasSyntaxPlaceholderDom(view)).toBe(false);

    externalInput.focus();

    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        expect(hasSyntaxPlaceholderDom(view)).toBe(true);
        resolve();
      });
    });
  });
});
