import { describe, expect, it } from 'vitest';

import { formatMarkdown } from './formatMarkdown';

describe('formatMarkdown', () => {
  it('normalizes heading spacing', async () => {
    const source = '# Title\n\nParagraph';
    const formatted = await formatMarkdown(source);

    expect(formatted).toContain('# Title');
    expect(formatted).toContain('Paragraph');
  });

  it('normalizes unordered list indentation', async () => {
    const source = '- one\n- two\n  - nested';
    const formatted = await formatMarkdown(source);

    expect(formatted).toContain('one');
    expect(formatted).toContain('two');
    expect(formatted).toContain('nested');
    expect(formatted).toMatch(/^\* /m);
  });

  it('preserves GFM table structure', async () => {
    const source = '| A | B |\n|---|---|\n| 1 | 2 |';
    const formatted = await formatMarkdown(source);

    expect(formatted).toContain('| A | B |');
    expect(formatted).toContain('| 1 | 2 |');
  });

  it('preserves fenced code blocks', async () => {
    const source = '```json\n{"a":1}\n```';
    const formatted = await formatMarkdown(source);

    expect(formatted).toContain('```json');
    expect(formatted).toContain('{"a":1}');
  });

  it('preserves HarborClient variable placeholders', async () => {
    const source = 'Use {{baseUrl}} for requests.';
    const formatted = await formatMarkdown(source);

    expect(formatted).toContain('{{baseUrl}}');
  });

  it('returns stable output for already formatted markdown', async () => {
    const source = '# Title\n\nParagraph with text.\n';
    const firstPass = await formatMarkdown(source);
    const secondPass = await formatMarkdown(firstPass);

    expect(secondPass).toBe(firstPass);
  });
});
