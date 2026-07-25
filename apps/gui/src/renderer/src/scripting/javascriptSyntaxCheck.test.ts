import { describe, expect, it } from 'vitest';
import { findJavascriptSyntaxError } from './javascriptSyntaxCheck';

describe('findJavascriptSyntaxError', () => {
  it('returns null for valid HarborClient script source', () => {
    const source = `hc.test("Status code is 200", () => {
  hc.expect(hc.response.code).to.equal(200);
});`;

    expect(findJavascriptSyntaxError(source)).toBeNull();
  });

  it('locates the invalid tail left by a mismatched range replacement', () => {
    const source = `// Test
hc.test("Status code is 2xx", () => {
  hc.test("Check response code", () => {
    hc.expect(hc.response.code).to.equal(200);
  });.to.be(200);
});`;

    expect(findJavascriptSyntaxError(source)).toEqual(
      expect.objectContaining({
        line: 5,
        excerpt: '});.to.be(200);'
      })
    );
  });

  it('reports syntax errors in an existing unfinished script', () => {
    const source = 'hc.test("unfinished", () => {';

    expect(findJavascriptSyntaxError(source)).not.toBeNull();
  });
});
