import { describe, expect, it } from 'vitest';
import {
  buildConsoleTable,
  formatConsoleArg,
  formatConsoleArgs,
  formatConsoleTable,
  formatConsoleTrace,
  indentConsoleMessage
} from './scriptLogFormat';
import {
  coerceScriptLogs,
  enrichScriptLogLines,
  flattenScriptLogs,
  joinScriptLogMessages
} from './scriptLogs';

describe('formatConsoleArg', () => {
  it('passes strings through', () => {
    expect(formatConsoleArg('hello')).toBe('hello');
  });

  it('pretty-prints objects', () => {
    expect(formatConsoleArg({ idToken: 'a', refreshToken: 'b' })).toBe(
      '{\n  "idToken": "a",\n  "refreshToken": "b"\n}'
    );
  });

  it('pretty-prints arrays', () => {
    expect(formatConsoleArg([1, 2])).toBe('[\n  1,\n  2\n]');
  });

  it('falls back for circular values', () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(formatConsoleArg(circular)).toBe('[object Object]');
  });
});

describe('formatConsoleArgs', () => {
  it('joins mixed args with spaces', () => {
    expect(formatConsoleArgs(['count', { n: 1 }])).toBe('count {\n  "n": 1\n}');
  });
});

describe('indentConsoleMessage', () => {
  it('returns the message unchanged at depth 0', () => {
    expect(indentConsoleMessage('hello\nworld', 0)).toBe('hello\nworld');
  });

  it('prefixes each line with two spaces per depth', () => {
    expect(indentConsoleMessage('hello\nworld', 2)).toBe('    hello\n    world');
  });
});

describe('buildConsoleTable', () => {
  it('builds structured data for an array of objects', () => {
    expect(
      buildConsoleTable([
        { name: 'Ada', age: 36 },
        { name: 'Grace', age: 85 }
      ])
    ).toEqual({
      columns: ['(index)', 'name', 'age'],
      rows: [
        ['0', 'Ada', '36'],
        ['1', 'Grace', '85']
      ]
    });
  });

  it('respects a column allow-list', () => {
    expect(
      buildConsoleTable(
        [
          { name: 'Ada', age: 36, city: 'London' },
          { name: 'Grace', age: 85, city: 'NYC' }
        ],
        ['name']
      )
    ).toEqual({
      columns: ['(index)', 'name'],
      rows: [
        ['0', 'Ada'],
        ['1', 'Grace']
      ]
    });
  });

  it('returns null for non-tabular scalars', () => {
    expect(buildConsoleTable('plain')).toBeNull();
  });
});

describe('formatConsoleTable', () => {
  it('renders an array of objects as an ASCII table', () => {
    const table = formatConsoleTable([
      { name: 'Ada', age: 36 },
      { name: 'Grace', age: 85 }
    ]);
    expect(table).toContain('(index)');
    expect(table).toContain('name');
    expect(table).toContain('age');
    expect(table).toContain('Ada');
    expect(table).toContain('Grace');
  });

  it('returns (empty) for an empty array', () => {
    expect(formatConsoleTable([])).toBe('(empty)');
  });

  it('falls back for non-tabular scalars', () => {
    expect(formatConsoleTable('plain')).toBe('plain');
  });
});

describe('formatConsoleTrace', () => {
  it('emits Trace with no args', () => {
    expect(formatConsoleTrace([], undefined)).toBe('Trace');
  });

  it('includes formatted args after Trace:', () => {
    expect(formatConsoleTrace(['here', 1], undefined)).toBe('Trace: here 1');
  });

  it('appends a sanitized stack', () => {
    const stack =
      'Error\n    at foo (/tmp/secret/file.js:1:1)\n    at bar (evalmachine.<anonymous>:2:3)';
    const out = formatConsoleTrace([], stack);
    expect(out.startsWith('Trace\n')).toBe(true);
    expect(out).toContain('[path]');
    expect(out).toContain('script');
    expect(out).not.toContain('/tmp/secret');
    expect(out).not.toContain('evalmachine');
  });
});

describe('enrichScriptLogLines', () => {
  it('attaches script ownership metadata and preserves method/table', () => {
    expect(
      enrichScriptLogLines(
        [
          {
            message: 'hello',
            level: 'log',
            method: 'log'
          },
          {
            message: 'rows',
            level: 'log',
            method: 'table',
            table: { columns: ['(index)', 'name'], rows: [['0', 'Ada']] }
          }
        ],
        {
          label: 'Request post-request script 1',
          scriptId: 'abc',
          phase: 'post',
          scope: 'request'
        }
      )
    ).toEqual([
      {
        message: 'hello',
        level: 'log',
        method: 'log',
        scriptName: 'Request post-request script 1',
        scriptId: 'abc',
        phase: 'post',
        scope: 'request'
      },
      {
        message: 'rows',
        level: 'log',
        method: 'table',
        table: { columns: ['(index)', 'name'], rows: [['0', 'Ada']] },
        scriptName: 'Request post-request script 1',
        scriptId: 'abc',
        phase: 'post',
        scope: 'request'
      }
    ]);
  });
});

describe('coerceScriptLogs', () => {
  it('returns empty for non-arrays', () => {
    expect(coerceScriptLogs(null)).toEqual([]);
    expect(coerceScriptLogs('x')).toEqual([]);
  });

  it('coerces legacy labeled string aggregates', () => {
    expect(coerceScriptLogs(['[Request post-request script 1]', 'hello', '[error] boom'])).toEqual([
      {
        message: 'hello',
        level: 'log',
        method: 'log',
        scriptName: 'Request post-request script 1'
      },
      {
        message: 'boom',
        level: 'error',
        method: 'error',
        scriptName: 'Request post-request script 1'
      }
    ]);
  });

  it('passes through structured entries', () => {
    expect(
      coerceScriptLogs([
        {
          message: 'ok',
          level: 'log',
          method: 'debug',
          scriptName: 'Pre',
          scriptId: 's1',
          phase: 'pre',
          scope: 'request'
        }
      ])
    ).toEqual([
      {
        message: 'ok',
        level: 'log',
        method: 'debug',
        scriptName: 'Pre',
        scriptId: 's1',
        phase: 'pre',
        scope: 'request'
      }
    ]);
  });

  it('derives method from level when method is omitted', () => {
    expect(
      coerceScriptLogs([
        {
          message: 'careful',
          level: 'warn',
          scriptName: 'Pre'
        }
      ])
    ).toEqual([
      {
        message: 'careful',
        level: 'warn',
        method: 'warn',
        scriptName: 'Pre'
      }
    ]);
  });

  it('preserves table payloads', () => {
    expect(
      coerceScriptLogs([
        {
          message: 't',
          level: 'log',
          method: 'table',
          table: { columns: ['a'], rows: [['1']] },
          scriptName: 'Pre'
        }
      ])
    ).toEqual([
      {
        message: 't',
        level: 'log',
        method: 'table',
        table: { columns: ['a'], rows: [['1']] },
        scriptName: 'Pre'
      }
    ]);
  });

  it('defaults unknown levels to log', () => {
    expect(
      coerceScriptLogs([
        {
          message: 'x',
          level: 'info',
          scriptName: 'Pre'
        }
      ])
    ).toEqual([
      {
        message: 'x',
        level: 'log',
        method: 'log',
        scriptName: 'Pre'
      }
    ]);
  });
});

describe('flattenScriptLogs', () => {
  it('emits legacy labeled separators', () => {
    expect(
      flattenScriptLogs([
        {
          message: 'a',
          level: 'log',
          method: 'log',
          scriptName: 'Pre'
        },
        {
          message: 'b',
          level: 'error',
          method: 'error',
          scriptName: 'Pre'
        },
        {
          message: 'c',
          level: 'log',
          method: 'log',
          scriptName: 'Post'
        }
      ])
    ).toEqual(['[Pre]', 'a', '[error] b', '[Post]', 'c']);
  });

  it('emits warn lines without an error prefix', () => {
    expect(
      flattenScriptLogs([
        {
          message: 'careful',
          level: 'warn',
          method: 'warn',
          scriptName: 'Pre'
        }
      ])
    ).toEqual(['[Pre]', 'careful']);
  });
});

describe('joinScriptLogMessages', () => {
  it('joins messages with error prefixes', () => {
    expect(
      joinScriptLogMessages([
        { message: 'a', level: 'log', method: 'log', scriptName: 'S' },
        { message: 'b', level: 'error', method: 'error', scriptName: 'S' }
      ])
    ).toBe('a\n[error] b');
  });
});
