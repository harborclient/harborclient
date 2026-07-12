import { describe, expect, it } from 'vitest';

import { clipboardHasRichHtml, shouldParsePasteAsMarkdown } from './pasteMarkdownUtils';

describe('shouldParsePasteAsMarkdown', () => {
  it('returns false for empty or whitespace-only text', () => {
    expect(shouldParsePasteAsMarkdown('')).toBe(false);
    expect(shouldParsePasteAsMarkdown('   \n  ')).toBe(false);
  });

  it('returns false for plain single-line snippets', () => {
    expect(shouldParsePasteAsMarkdown('hello world')).toBe(false);
    expect(shouldParsePasteAsMarkdown('curl https://example.com')).toBe(false);
  });

  it('returns true for fenced code blocks', () => {
    const markdown = `# Title

\`\`\`bash
curl https://echo.example.com/get
\`\`\`
`;
    expect(shouldParsePasteAsMarkdown(markdown)).toBe(true);
  });

  it('returns true for tilde-fenced code blocks', () => {
    const markdown = `Intro

~~~json
{ "ok": true }
~~~
`;
    expect(shouldParsePasteAsMarkdown(markdown)).toBe(true);
  });

  it('returns true for multi-line documents with ATX headings', () => {
    const markdown = `# HarborClient Echo Server

## Using The Echo Service

The API supports GET and POST.
`;
    expect(shouldParsePasteAsMarkdown(markdown)).toBe(true);
  });

  it('returns false for a single ATX heading line without other block markers', () => {
    expect(shouldParsePasteAsMarkdown('# Just a heading')).toBe(false);
  });

  it('normalizes CRLF line endings before detection', () => {
    const markdown = '# Title\r\n\r\nBody\r\n';
    expect(shouldParsePasteAsMarkdown(markdown)).toBe(true);
  });
});

describe('clipboardHasRichHtml', () => {
  it('returns false when clipboard is null', () => {
    expect(clipboardHasRichHtml(null)).toBe(false);
  });

  it('returns true when text/html is non-empty', () => {
    const clipboard = {
      getData: (type: string) => (type === 'text/html' ? '<p>Hello</p>' : '')
    } as DataTransfer;

    expect(clipboardHasRichHtml(clipboard)).toBe(true);
  });

  it('returns false when only plain text is available', () => {
    const clipboard = {
      getData: (type: string) => (type === 'text/plain' ? 'plain' : '')
    } as DataTransfer;

    expect(clipboardHasRichHtml(clipboard)).toBe(false);
  });
});
