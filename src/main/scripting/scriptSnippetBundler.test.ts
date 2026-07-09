import { describe, expect, it } from 'vitest';
import {
  bundleUserScript,
  resolveSnippetImportPath,
  scriptUsesModuleSyntax
} from '#/main/scripting/scriptSnippetBundler';

describe('scriptUsesModuleSyntax', () => {
  it('detects import and export statements', () => {
    expect(scriptUsesModuleSyntax("import { x } from './foo.js';")).toBe(true);
    expect(scriptUsesModuleSyntax('export function foo() {}')).toBe(true);
    expect(scriptUsesModuleSyntax('hc.test("ok", () => {});')).toBe(false);
  });
});

describe('resolveSnippetImportPath', () => {
  it('resolves relative paths from nested importers', () => {
    expect(resolveSnippetImportPath('/utils/bar.js', './foo.js')).toBe('utils/foo.js');
    expect(resolveSnippetImportPath('/__entry__.js', './pass-testing.js')).toBe('pass-testing.js');
  });
});

describe('bundleUserScript', () => {
  it('inlines named snippet imports', async () => {
    const bundled = await bundleUserScript(
      "import { passTest } from './pass-testing.js';\npassTest(true);",
      {
        'pass-testing.js': 'export function passTest(value) { return value; }'
      },
      []
    );

    expect(bundled).toContain('passTest');
    expect(bundled).not.toMatch(/^\s*import\s/m);
  });

  it('inlines nested snippet imports', async () => {
    const bundled = await bundleUserScript(
      "import { run } from './entry.js';\nrun();",
      {
        'entry.js':
          "import { helper } from './utils/helper.js';\nexport function run() { return helper(); }",
        'utils/helper.js': 'export function helper() { return 42; }'
      },
      []
    );

    expect(bundled).toContain('42');
  });

  it('inlines sibling inline-script modules', async () => {
    const bundled = await bundleUserScript(
      "import { before } from './before.js';\nbefore();",
      {
        'before.js': "export const before = () => { return 'BEFORE!'; };"
      },
      []
    );

    expect(bundled).toContain('BEFORE!');
    expect(bundled).not.toMatch(/^\s*import\s/m);
  });

  it('returns empty output for export-only entry scripts', async () => {
    const bundled = await bundleUserScript(
      "export const before = () => { console.log('BEFORE!'); };",
      {},
      []
    );

    expect(bundled).toBe('');
  });

  it('errors when a module import is missing', async () => {
    await expect(
      bundleUserScript("import { x } from './missing.js';", {}, [])
    ).rejects.toMatchObject({
      errors: [{ text: 'Cannot find module "missing.js"' }]
    });
  });

  it('errors when a module filename is ambiguous', async () => {
    await expect(
      bundleUserScript("import { x } from './dup.js';", { 'dup.js': 'export const x = 1;' }, [
        'dup.js'
      ])
    ).rejects.toMatchObject({
      errors: [{ text: 'Ambiguous import: multiple modules named "dup.js"' }]
    });
  });

  it('errors on bare package imports', async () => {
    await expect(bundleUserScript("import dayjs from 'dayjs';", {}, [])).rejects.toMatchObject({
      errors: [{ text: 'Package imports are not supported yet: "dayjs"' }]
    });
  });
});
