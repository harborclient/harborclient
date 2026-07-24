import { describe, expect, it } from 'vitest';

import { findVariableKeysInText } from './applyVariableHighlights';

describe('findVariableKeysInText', () => {
  it('finds a plain {{host}} token', () => {
    expect(findVariableKeysInText('https://{{host}}/users')).toEqual([
      { key: 'host', start: 8, end: 16 }
    ]);
  });

  it('finds spaced tokens like {{ host }}', () => {
    expect(findVariableKeysInText('https://{{ host }}/users')).toEqual([
      { key: 'host', start: 8, end: 18 }
    ]);
  });

  it('finds dynamic keys like {{$guid}}', () => {
    expect(findVariableKeysInText('id={{$guid}}')).toEqual([{ key: '$guid', start: 3, end: 12 }]);
  });

  it('does not match braces outside variable syntax', () => {
    expect(findVariableKeysInText('use { braces } only')).toEqual([]);
  });
});
