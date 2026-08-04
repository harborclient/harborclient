// @vitest-environment jsdom
import { act, createElement } from 'react';
import * as React from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setHostReact } from '../../runtime/reactHost.js';
import { SidebarHistoryItem } from './SidebarHistoryItem.js';
import { SidebarListbox } from './SidebarListbox.js';
import { SidebarRequestItem } from './SidebarRequestItem.js';

describe('SidebarListbox', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    setHostReact(React);
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders a listbox container', () => {
    act(() => {
      root.render(
        createElement(SidebarListbox, {
          'aria-label': 'Requests',
          children: createElement(SidebarRequestItem, {
            method: 'GET',
            name: 'List users'
          })
        })
      );
    });

    expect(container.querySelector('[role="listbox"]')).not.toBeNull();
    expect(container.querySelector('[role="listbox"]')?.getAttribute('aria-label')).toBe(
      'Requests'
    );
  });

  it('does not set aria-label on option rows', () => {
    act(() => {
      root.render(
        createElement(SidebarListbox, {
          'aria-label': 'Requests',
          children: createElement(SidebarRequestItem, {
            method: 'GET',
            name: 'List users'
          })
        })
      );
    });

    const option = container.querySelector('[role="option"]');
    expect(option).not.toBeNull();
    expect(option?.hasAttribute('aria-label')).toBe(false);
    expect(option?.textContent).toContain('GET');
    expect(option?.textContent).toContain('List users');
  });

  it('exposes selected state on option rows', () => {
    act(() => {
      root.render(
        createElement(SidebarListbox, {
          'aria-label': 'Requests',
          children: [
            createElement(SidebarRequestItem, {
              method: 'GET',
              name: 'List users',
              selected: true
            }),
            createElement(SidebarRequestItem, {
              method: 'POST',
              name: 'Create user'
            })
          ]
        })
      );
    });

    const options = container.querySelectorAll('[role="option"]');
    expect(options).toHaveLength(2);
    expect(options[0]?.getAttribute('aria-selected')).toBe('true');
    expect(options[1]?.getAttribute('aria-selected')).toBe('false');
  });

  it('does not set aria-selected on nested buttons', () => {
    act(() => {
      root.render(
        createElement(SidebarListbox, {
          'aria-label': 'Requests',
          children: createElement(SidebarRequestItem, {
            method: 'GET',
            name: 'List users',
            selected: true
          })
        })
      );
    });

    expect(container.querySelector('button[aria-selected]')).toBeNull();
  });

  it('activates the option on Enter and Space', () => {
    const onClick = vi.fn();

    act(() => {
      root.render(
        createElement(SidebarListbox, {
          'aria-label': 'Requests',
          children: createElement(SidebarRequestItem, {
            method: 'GET',
            name: 'List users',
            selected: true,
            onClick
          })
        })
      );
    });

    const option = container.querySelector('[role="option"]');
    expect(option).not.toBeNull();

    act(() => {
      option?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
      );
    });
    expect(onClick).toHaveBeenCalledTimes(1);

    act(() => {
      option?.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })
      );
    });
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('sets aria-multiselectable when multiselectable is true', () => {
    act(() => {
      root.render(
        createElement(SidebarListbox, {
          'aria-label': 'History',
          multiselectable: true,
          children: createElement(SidebarRequestItem, {
            method: 'GET',
            name: 'List users'
          })
        })
      );
    });

    expect(container.querySelector('[role="listbox"]')?.getAttribute('aria-multiselectable')).toBe(
      'true'
    );
  });

  it('announces HTTP status in history option aria-label', () => {
    act(() => {
      root.render(
        createElement(SidebarListbox, {
          'aria-label': 'History',
          multiselectable: true,
          children: createElement(SidebarHistoryItem, {
            method: 'GET',
            name: 'https://api.example.com/users',
            status: 200,
            statusText: 'OK',
            ariaLabel: 'GET request'
          })
        })
      );
    });

    const option = container.querySelector('[role="option"]');
    expect(option).not.toBeNull();
    expect(option?.getAttribute('aria-label')).toBe('GET request, responded 200 OK');
  });

  it('renders history HTTP status as a status dot without visible status text', () => {
    act(() => {
      root.render(
        createElement(SidebarListbox, {
          'aria-label': 'History',
          multiselectable: true,
          children: createElement(SidebarHistoryItem, {
            method: 'POST',
            name: 'Echo (Unsupported Media Type)',
            status: 415,
            statusText: 'Unsupported Media Type',
            ariaLabel: 'POST Echo'
          })
        })
      );
    });

    const option = container.querySelector('[role="option"]');
    expect(option).not.toBeNull();
    expect(option?.querySelector('.sr-only')?.textContent).toBe('415 Unsupported Media Type');
    expect(option?.querySelector('[title="415 Unsupported Media Type"]')).not.toBeNull();

    const withoutSrOnly = option?.cloneNode(true) as HTMLElement;
    withoutSrOnly.querySelectorAll('.sr-only').forEach((el) => el.remove());
    expect(withoutSrOnly.textContent).toContain('Echo (Unsupported Media Type)');
    expect(withoutSrOnly.textContent).not.toMatch(/415\s+Unsupported Media Type/);
  });
});
