import { describe, expect, it } from 'vitest';
import {
  buildRuntimeExport,
  buildRuntimesExport,
  findMatchingRuntime,
  joinRuntimePath,
  mergeRuntimeEnv,
  normalizeRuntime,
  normalizeRuntimeVersion,
  parseRuntimeVersionOutput,
  pathLooksLikeRuntimeExecutable,
  resolveRuntimeExecutable,
  runtimeRequirementFor
} from './runtime';

describe('normalizeRuntimeVersion', () => {
  it('drops patch segments and optional v prefix', () => {
    expect(normalizeRuntimeVersion('v22.33.3')).toBe('22.33');
    expect(normalizeRuntimeVersion('8.3.6')).toBe('8.3');
    expect(normalizeRuntimeVersion('3.12')).toBe('3.12');
  });

  it('returns empty for blank or invalid values', () => {
    expect(normalizeRuntimeVersion('')).toBe('');
    expect(normalizeRuntimeVersion(null)).toBe('');
    expect(normalizeRuntimeVersion('abc')).toBe('');
  });
});

describe('resolveRuntimeExecutable', () => {
  it('keeps paths that already look like the catalog binary', () => {
    expect(resolveRuntimeExecutable({ kind: 'node', path: '/usr/bin/node' })).toBe('/usr/bin/node');
    expect(resolveRuntimeExecutable({ kind: 'php', path: 'C:\\php\\php.exe' })).toBe(
      'C:\\php\\php.exe'
    );
  });

  it('appends the catalog binary for directory paths', () => {
    expect(resolveRuntimeExecutable({ kind: 'php', path: '/usr/php/7.1/bin' })).toBe(
      '/usr/php/7.1/bin/php'
    );
    expect(resolveRuntimeExecutable({ kind: 'python', path: '/opt/python/bin' }, 'directory')).toBe(
      '/opt/python/bin/python3'
    );
  });

  it('respects an explicit file pathKind even when the basename differs', () => {
    expect(resolveRuntimeExecutable({ kind: 'node', path: '/custom/runtime' }, 'file')).toBe(
      '/custom/runtime'
    );
  });
});

describe('pathLooksLikeRuntimeExecutable / joinRuntimePath', () => {
  it('detects binary basenames with optional .exe', () => {
    expect(pathLooksLikeRuntimeExecutable('node', '/usr/local/bin/node')).toBe(true);
    expect(pathLooksLikeRuntimeExecutable('node', '/usr/local/bin/node.exe')).toBe(true);
    expect(pathLooksLikeRuntimeExecutable('node', '/usr/local/bin')).toBe(false);
  });

  it('joins with the directory separator style', () => {
    expect(joinRuntimePath('C:\\Tools\\node', 'node.exe')).toBe('C:\\Tools\\node\\node.exe');
    expect(joinRuntimePath('/usr/bin/', 'php')).toBe('/usr/bin/php');
  });
});

describe('parseRuntimeVersionOutput', () => {
  it('parses Node, PHP, and Python version banners', () => {
    expect(parseRuntimeVersionOutput('node', 'v22.14.0\n')).toBe('22.14');
    expect(parseRuntimeVersionOutput('php', 'PHP 8.3.6 (cli) (built: ...)\n')).toBe('8.3');
    expect(parseRuntimeVersionOutput('python', 'Python 3.12.4\n')).toBe('3.12');
  });
});

describe('findMatchingRuntime / runtimeRequirementFor', () => {
  const runtimes = [
    normalizeRuntime({
      id: '1',
      name: 'Node v22',
      kind: 'node',
      version: '22.14',
      path: '/usr/bin/node',
      env: []
    })!,
    normalizeRuntime({
      id: '2',
      name: 'Legacy PHP',
      kind: 'php',
      version: '8.2',
      path: '/usr/bin/php',
      env: []
    })!
  ];

  it('prefers kind+version matches', () => {
    expect(
      findMatchingRuntime(runtimes, { kind: 'node', version: '22.14', name: 'Other' })?.id
    ).toBe('1');
  });

  it('falls back to case-insensitive name', () => {
    expect(
      findMatchingRuntime(runtimes, { kind: 'php', version: '7.4', name: 'legacy php' })?.id
    ).toBe('2');
  });

  it('builds portable requirements without the path', () => {
    expect(runtimeRequirementFor(runtimes[0]!)).toEqual({
      kind: 'node',
      version: '22.14',
      name: 'Node v22'
    });
  });
});

describe('mergeRuntimeEnv', () => {
  it('lets command rows override runtime rows and drops disabled keys', () => {
    expect(
      mergeRuntimeEnv(
        [
          { key: 'A', value: 'runtime', enabled: true },
          { key: 'B', value: 'runtime', enabled: true },
          { key: 'SKIP', value: 'x', enabled: false }
        ],
        [
          { key: 'B', value: 'command', enabled: true },
          { key: 'C', value: 'command', enabled: true }
        ]
      )
    ).toEqual({
      A: 'runtime',
      B: 'command',
      C: 'command'
    });
  });
});

describe('buildRuntimeExport / buildRuntimesExport', () => {
  const sample = normalizeRuntime({
    id: 'rt-1',
    name: 'Node v22',
    kind: 'node',
    version: '22.12.0',
    path: '/usr/bin/node',
    env: [{ key: 'NODE_ENV', value: 'test', enabled: true }]
  })!;

  it('builds a single-runtime envelope with full machine-local fields', () => {
    expect(buildRuntimeExport(sample)).toEqual({
      harborclientVersion: 1,
      harborclientExport: 'runtime',
      id: 'rt-1',
      name: 'Node v22',
      kind: 'node',
      version: '22.12',
      path: '/usr/bin/node',
      env: [{ key: 'NODE_ENV', value: 'test', enabled: true }]
    });
  });

  it('builds a multi-runtime envelope and drops invalid entries', () => {
    expect(
      buildRuntimesExport([
        sample,
        { id: 'bad', name: 'x', kind: 'ruby' as never, version: '1', path: '', env: [] }
      ])
    ).toEqual({
      harborclientVersion: 1,
      harborclientExport: 'runtimes',
      runtimes: [
        {
          id: 'rt-1',
          name: 'Node v22',
          kind: 'node',
          version: '22.12',
          path: '/usr/bin/node',
          env: [{ key: 'NODE_ENV', value: 'test', enabled: true }]
        }
      ]
    });
  });
});
