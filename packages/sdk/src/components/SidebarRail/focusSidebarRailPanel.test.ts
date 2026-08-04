// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  focusSidebarRailPanel,
  focusSidebarRailTabFromPanel,
  sidebarRailTabId
} from './focusSidebarRailPanel.js';

describe('focusSidebarRailPanel helpers', () => {
  it('builds a stable tab id from the item id', () => {
    expect(sidebarRailTabId('collections')).toBe('hc-sidebar-rail-tab-collections');
  });

  it('focuses the first focusable descendant in the panel', () => {
    const panel = document.createElement('div');
    const first = document.createElement('button');
    first.type = 'button';
    first.textContent = 'First';
    const second = document.createElement('button');
    second.type = 'button';
    second.textContent = 'Second';
    panel.append(first, second);
    document.body.appendChild(panel);

    expect(focusSidebarRailPanel(panel)).toBe(true);
    expect(document.activeElement).toBe(first);

    panel.remove();
  });

  it('focuses the panel itself when it has no focusable descendants', () => {
    const panel = document.createElement('div');
    panel.textContent = 'Empty';
    document.body.appendChild(panel);

    expect(focusSidebarRailPanel(panel)).toBe(true);
    expect(document.activeElement).toBe(panel);
    expect(panel.tabIndex).toBe(-1);

    panel.remove();
  });

  it('returns focus to the labelling tab from the panel', () => {
    const tab = document.createElement('button');
    tab.id = sidebarRailTabId('collections');
    tab.type = 'button';
    tab.textContent = 'Collections';
    document.body.appendChild(tab);

    const panel = document.createElement('div');
    panel.setAttribute('aria-labelledby', tab.id);
    const control = document.createElement('button');
    control.type = 'button';
    control.textContent = 'Row';
    panel.appendChild(control);
    document.body.appendChild(panel);

    control.focus();
    expect(focusSidebarRailTabFromPanel(panel)).toBe(true);
    expect(document.activeElement).toBe(tab);

    tab.remove();
    panel.remove();
  });

  it('does not steal focus from CodeMirror editors', () => {
    const tab = document.createElement('button');
    tab.id = sidebarRailTabId('collections');
    tab.type = 'button';
    document.body.appendChild(tab);

    const panel = document.createElement('div');
    panel.setAttribute('aria-labelledby', tab.id);
    const editor = document.createElement('div');
    editor.className = 'cm-editor';
    const input = document.createElement('textarea');
    editor.appendChild(input);
    panel.appendChild(editor);
    document.body.appendChild(panel);

    input.focus();
    expect(focusSidebarRailTabFromPanel(panel)).toBe(false);
    expect(document.activeElement).toBe(input);

    tab.remove();
    panel.remove();
  });
});
