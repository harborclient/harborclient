// @vitest-environment jsdom
import { act, createElement } from 'react';
import * as React from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setHostReact } from '../../runtime/reactHost.js';
import { Button } from './index.js';

describe('Button', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    setHostReact(React);
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

  it('applies an outline focus ring on secondary (shadow) variants', () => {
    act(() => {
      root.render(createElement(Button, { variant: 'secondary', children: 'Copy' }));
    });

    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    expect(button?.className).toContain('focus-visible:outline-accent');
    expect(button?.className).toContain('shadow-sm');
  });

  it('applies surface focus feedback on icon variants', () => {
    act(() => {
      root.render(
        createElement(Button, {
          variant: 'icon',
          'aria-label': 'Expand',
          children: 'x'
        })
      );
    });

    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    expect(button?.className).toContain('focus-visible:bg-selection');
    expect(button?.className).not.toContain('shadow-sm');
  });
});
