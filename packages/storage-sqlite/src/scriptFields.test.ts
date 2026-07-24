import { describe, expect, it } from 'vitest';
import { createInlineScriptRef } from '#/shared/scriptRefs';
import { teamHubScriptColumn, teamHubScriptRefsFromColumn } from './scriptFields';

describe('teamHubScriptColumn', () => {
  it('JSON-encodes a single anonymous empty inline script (default seeded script)', () => {
    const refs = [createInlineScriptRef('')];
    const column = teamHubScriptColumn(refs);

    expect(column.trim().startsWith('[')).toBe(true);
    expect(JSON.parse(column)).toHaveLength(1);
    expect(JSON.parse(column)[0]).toMatchObject({
      enabled: true,
      kind: 'inline',
      code: ''
    });
  });

  it('stores a single anonymous inline script with code as plain source', () => {
    const column = teamHubScriptColumn([createInlineScriptRef('console.log(1);')]);

    expect(column).toBe('console.log(1);');
    expect(column.trim().startsWith('[')).toBe(false);
  });

  it('JSON-encodes a single named empty inline script', () => {
    const column = teamHubScriptColumn([createInlineScriptRef('', 'Unnamed script...')]);

    expect(column.trim().startsWith('[')).toBe(true);
    expect(JSON.parse(column)[0]?.name).toBe('Unnamed script...');
  });
});

describe('teamHubScriptRefsFromColumn', () => {
  it('round-trips a JSON-encoded single anonymous empty inline script', () => {
    const refs = [createInlineScriptRef('')];
    const column = teamHubScriptColumn(refs);
    const restored = teamHubScriptRefsFromColumn(column);

    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({
      enabled: true,
      kind: 'inline',
      code: ''
    });
  });

  it('reads a plain legacy source string as one inline script', () => {
    const restored = teamHubScriptRefsFromColumn('console.log(1);');

    expect(restored).toHaveLength(1);
    expect(restored[0]?.code).toBe('console.log(1);');
  });
});
