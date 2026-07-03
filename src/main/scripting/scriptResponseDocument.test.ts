import { describe, expect, it } from 'vitest';
import { parseResponseDocument } from '#/main/scripting/scriptResponseDocument';

describe('parseResponseDocument', () => {
  const html = `
    <html>
      <body>
        <h1 class="title">Hello</h1>
        <ul>
          <li>One</li>
          <li>Two</li>
        </ul>
      </body>
    </html>
  `;

  it('querySelector returns textContent and attributes', () => {
    const doc = parseResponseDocument(html);
    const h1 = doc.querySelector('h1');

    expect(h1).not.toBeNull();
    expect(h1?.textContent).toBe('Hello');
    expect(h1?.getAttribute('class')).toBe('title');
    expect(h1?.innerHTML).toBe('Hello');
  });

  it('querySelector returns null for missing selectors', () => {
    const doc = parseResponseDocument(html);
    expect(doc.querySelector('missing')).toBeNull();
  });

  it('querySelectorAll returns every match', () => {
    const doc = parseResponseDocument(html);
    const items = doc.querySelectorAll('li');

    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).toBe('One');
    expect(items[1]?.textContent).toBe('Two');
  });

  it('querySelectorAll returns an empty array when nothing matches', () => {
    const doc = parseResponseDocument(html);
    expect(doc.querySelectorAll('missing')).toEqual([]);
  });

  it('parses an empty body without throwing', () => {
    const doc = parseResponseDocument('');
    expect(doc.querySelector('h1')).toBeNull();
    expect(doc.querySelectorAll('h1')).toEqual([]);
  });
});
