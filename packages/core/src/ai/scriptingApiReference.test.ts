import { describe, expect, it } from 'vitest';
import { getScriptingApiReferenceText, SCRIPTING_API_REFERENCE } from './scriptingApiReference';

describe('scriptingApiReference', () => {
  it('documents hc.test wrapping and ok property/callable equivalence', () => {
    const text = getScriptingApiReferenceText();
    expect(text).toBe(SCRIPTING_API_REFERENCE);
    expect(text).toContain('hc.test');
    expect(text).toContain('.to.be.ok');
    expect(text).toContain('.to.be.ok()');
    expect(text).toContain('Do **not** tell users that missing parentheses is the problem');
    expect(text).toContain('pm.test');
    expect(text).toContain('hc.response');
  });

  it('documents replace_range edits that preserve surrounding script code', () => {
    const text = getScriptingApiReferenceText();
    expect(text).toContain('replace_range');
    expect(text).toContain('update_request_script');
    expect(text).toContain('Status code is 2xx');
    expect(text).toContain('entire** updated script');
  });
});
