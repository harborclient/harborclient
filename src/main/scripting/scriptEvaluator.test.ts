import { describe, expect, it } from 'vitest';
import { evaluateScript } from '#/main/scripting/scriptEvaluator';

const baseInput = {
  phase: 'post' as const,
  request: {
    method: 'GET' as const,
    url: 'https://example.com/path',
    headers: [],
    params: [],
    body: '',
    bodyType: 'none' as const
  },
  variables: {},
  response: {
    status: 200,
    statusText: 'OK',
    headers: {},
    body: '',
    timeMs: 1,
    sizeBytes: 0
  }
};

describe('evaluateScript snippet imports', () => {
  it('runs a script that imports a named export from a snippet', async () => {
    const result = await evaluateScript({
      ...baseInput,
      script: `
        import { passTest } from './pass-testing.js';
        passTest(true);
      `,
      snippetModules: {
        'pass-testing.js': `
          export function passTest(value) {
            hc.test('value is truthy', () => {
              hc.expect(value).to.be.true;
            });
          }
        `
      }
    });

    expect(result.error).toBeUndefined();
    expect(result.tests).toHaveLength(1);
    expect(result.tests[0]?.passed).toBe(true);
  });

  it('runs a script that imports a default export from a snippet', async () => {
    const result = await evaluateScript({
      ...baseInput,
      script: `
        import passTest from './pass-testing.js';
        passTest(true);
      `,
      snippetModules: {
        'pass-testing.js': `
          export default function passTest(value) {
            hc.test('default export', () => {
              hc.expect(value).to.be.true;
            });
          }
        `
      }
    });

    expect(result.error).toBeUndefined();
    expect(result.tests[0]?.passed).toBe(true);
  });

  it('runs a snippet entry with exports and top-level side effects', async () => {
    const result = await evaluateScript({
      ...baseInput,
      script: `
        export function passTest(value) {
          hc.test('side effect', () => {
            hc.expect(value).to.be.true;
          });
        }
        passTest(true);
      `
    });

    expect(result.error).toBeUndefined();
    expect(result.tests[0]?.passed).toBe(true);
  });

  it('preserves top-level await after bundling', async () => {
    const result = await evaluateScript({
      ...baseInput,
      phase: 'pre',
      response: undefined,
      script: `
        import { delay } from './delay.js';
        await delay();
        hc.request.variables.set('done', 'yes');
      `,
      snippetModules: {
        'delay.js': `
          export async function delay() {
            await Promise.resolve();
          }
        `
      }
    });

    expect(result.error).toBeUndefined();
    expect(result.variableSets.done).toBe('yes');
  });

  it('returns a compile error for missing snippet imports', async () => {
    const result = await evaluateScript({
      ...baseInput,
      script: "import { x } from './missing.js';",
      snippetModules: {}
    });

    expect(result.error).toContain('Cannot find snippet "missing.js"');
  });

  it('returns a compile error for ambiguous snippet imports', async () => {
    const result = await evaluateScript({
      ...baseInput,
      script: "import { x } from './dup.js';",
      snippetModules: { 'dup.js': 'export const x = 1;' },
      snippetModuleConflicts: ['dup.js']
    });

    expect(result.error).toContain('Ambiguous import');
  });

  it('uses the fast path for scripts without module syntax', async () => {
    const result = await evaluateScript({
      ...baseInput,
      script: `
        hc.test('fast path', () => {
          hc.expect(1 + 1).to.equal(2);
        });
      `
    });

    expect(result.error).toBeUndefined();
    expect(result.tests[0]?.passed).toBe(true);
  });
});
