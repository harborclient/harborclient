import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { describe, expect, it } from 'vitest';
import {
  getPluginReactDomHost,
  getPluginReactHost,
  installPluginReactHost
} from './pluginReactHost';

const shimsDir = join(dirname(fileURLToPath(import.meta.url)), 'shims');

describe('pluginReactHost', () => {
  it('installPluginReactHost publishes React instances on globalThis', () => {
    installPluginReactHost(React, ReactDOM);

    expect(getPluginReactHost()).toBe(React);
    expect(getPluginReactDomHost()).toBe(ReactDOM);
    expect(globalThis.__HARBORCLIENT_REACT__).toBe(React);
    expect(globalThis.__HARBORCLIENT_REACT_DOM__).toBe(ReactDOM);
  });

  it('getPluginReactHost throws when the host is not installed', () => {
    const previousReact = globalThis.__HARBORCLIENT_REACT__;
    const previousReactDom = globalThis.__HARBORCLIENT_REACT_DOM__;
    globalThis.__HARBORCLIENT_REACT__ = undefined;
    globalThis.__HARBORCLIENT_REACT_DOM__ = undefined;

    expect(() => getPluginReactHost()).toThrow('Plugin React host is not installed.');

    globalThis.__HARBORCLIENT_REACT__ = previousReact;
    globalThis.__HARBORCLIENT_REACT_DOM__ = previousReactDom;
  });
});

describe('plugin React shims', () => {
  it('react shim source does not import bare react specifiers', () => {
    const source = readFileSync(join(shimsDir, 'react.ts'), 'utf8');

    expect(source).toContain('__HARBORCLIENT_REACT__');
    expect(source).not.toMatch(/from\s+['"]react['"]/);
    expect(source).not.toMatch(/^import\s+/m);
  });

  it('react-dom shim source does not import bare react-dom specifiers', () => {
    const source = readFileSync(join(shimsDir, 'react-dom.ts'), 'utf8');

    expect(source).toContain('__HARBORCLIENT_REACT_DOM__');
    expect(source).not.toMatch(/from\s+['"]react-dom['"]/);
    expect(source).not.toMatch(/^import\s+/m);
  });

  it('data URL react shim re-exports the installed host React instance', async () => {
    installPluginReactHost(React, ReactDOM);
    const source = readFileSync(join(shimsDir, 'react.ts'), 'utf8');
    const shimUrl = `data:text/javascript,${encodeURIComponent(source)}`;

    const shim = (await import(/* @vite-ignore */ shimUrl)) as { default: typeof React };
    expect(shim.default).toBe(React);
    expect(shim.default.useState).toBe(React.useState);
  });
});
