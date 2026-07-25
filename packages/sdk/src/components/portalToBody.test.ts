import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { portalToBody } from './portalToBody.js';

describe('portalToBody', () => {
  it('throws when document is unavailable', () => {
    const node = createElement('div');
    expect(() => portalToBody(node)).toThrow('portalToBody requires a DOM document');
  });
});
