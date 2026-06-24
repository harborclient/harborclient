/**
 * Captures HarborClient screenshots driven by a JSON macro file.
 *
 * Uses Playwright's Electron launcher against the built app (`out/main/index.js`).
 * Menu shortcuts are dispatched via the same `menu:action` IPC channel as the native
 * menu (see src/main/menu.ts and src/shared/shortcuts.ts).
 */
import { spawnSync } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultMacroPath = path.join(projectRoot, 'screenshots.macro.json');
const defaultOutDir = path.join(projectRoot, 'images', 'screenshots');
const mainEntry = path.join(projectRoot, 'out', 'main', 'index.js');
const defaultUserDataDir = path.join(
  process.env.HOME ?? process.env.USERPROFILE ?? '',
  '.config',
  'harborclient'
);

/**
 * Maps normalized Electron accelerators to menu actions.
 * Keep in sync with action shortcuts in src/shared/shortcuts.ts.
 */
const SHORTCUT_ACTIONS = new Map([
  ['cmdorctrl+n', 'new-request'],
  ['cmdorctrl+shift+n', 'new-collection'],
  ['cmdorctrl+s', 'save'],
  ['cmdorctrl+,', 'settings'],
  ['cmdorctrl+b', 'toggle-sidebar'],
  ['cmdorctrl+shift+b', 'toggle-ai-sidebar']
]);

/**
 * Parses CLI flags for the screenshot runner.
 *
 * @returns Resolved CLI options.
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    macro: defaultMacroPath,
    out: defaultOutDir,
    width: 1024,
    height: 576,
    build: false,
    userDataDir: defaultUserDataDir
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--macro' && args[index + 1]) {
      options.macro = path.resolve(args[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--out' && args[index + 1]) {
      options.out = path.resolve(args[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--width' && args[index + 1]) {
      options.width = Number.parseInt(args[index + 1], 10);
      index += 1;
      continue;
    }
    if (arg === '--height' && args[index + 1]) {
      options.height = Number.parseInt(args[index + 1], 10);
      index += 1;
      continue;
    }
    if (arg === '--build') {
      options.build = true;
      continue;
    }
    if (arg === '--user-data-dir' && args[index + 1]) {
      options.userDataDir = path.resolve(args[index + 1]);
      index += 1;
    }
  }

  return options;
}

/**
 * Runs a shell command in the project root and exits on failure.
 *
 * @param {string} command - Executable name.
 * @param {string[]} commandArgs - Command arguments.
 */
function runOrExit(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: process.env
  });
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

/**
 * Ensures the Electron build exists, optionally running `pnpm build`.
 *
 * @param {boolean} shouldBuild - When true, always rebuild before capture.
 */
async function ensureBuild(shouldBuild) {
  if (shouldBuild) {
    runOrExit('pnpm', ['build']);
    return;
  }

  try {
    await readFile(mainEntry);
  } catch {
    console.log('Built app not found; running pnpm build…');
    runOrExit('pnpm', ['build']);
  }
}

/**
 * Normalizes a human shortcut string to an Electron accelerator token list.
 *
 * @param {string} shortcut - Shortcut such as `ctrl-s` or `ctrl-comma`.
 * @returns Lowercase accelerator string used for lookup.
 */
function normalizeShortcut(shortcut) {
  const keyAliases = {
    comma: ',',
    ',': ',',
    plus: 'Plus',
    '+': 'Plus',
    minus: 'Minus',
    '-': 'Minus'
  };

  return shortcut
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/commandorcontrol|command|control|cmdorctrl|meta|cmd/g, 'cmdorctrl')
    .replace(/ctrl/g, 'cmdorctrl')
    .split(/[-+]+/)
    .filter((part) => part.length > 0)
    .map((part) => keyAliases[part] ?? (part.length === 1 ? part.toUpperCase() : part))
    .join('+');
}

/**
 * Resolves a shortcut string to a menu action id.
 *
 * @param {string} shortcut - Human-readable shortcut.
 * @returns Menu action id or null when unknown.
 */
function resolveShortcutAction(shortcut) {
  return SHORTCUT_ACTIONS.get(normalizeShortcut(shortcut)) ?? null;
}

/**
 * Waits until the main HarborClient window is available and the request UI is ready.
 *
 * @param {import('playwright').ElectronApplication} app - Launched Electron app.
 * @returns Main window page.
 */
async function waitForMainWindow(app) {
  const deadline = Date.now() + 90_000;

  while (Date.now() < deadline) {
    for (const window of app.windows()) {
      const title = await window.title();
      if (title !== 'HarborClient') {
        continue;
      }

      await window.waitForLoadState('domcontentloaded', { timeout: 5_000 }).catch(() => undefined);
      const requestUrl = window.getByLabel('Request URL');
      if (await requestUrl.isVisible().catch(() => false)) {
        return window;
      }
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 250);
    });
  }

  throw new Error('Timed out waiting for the main HarborClient window');
}

/**
 * Resizes the main HarborClient window to stable screenshot dimensions.
 *
 * @param {import('playwright').ElectronApplication} app - Launched Electron app.
 * @param {number} width - Window width in pixels.
 * @param {number} height - Window height in pixels.
 */
async function resizeMainWindow(app, width, height) {
  await app.evaluate(({ BrowserWindow }, size) => {
    const window = BrowserWindow.getAllWindows().find(
      (candidate) => !candidate.isDestroyed() && candidate.getTitle() === 'HarborClient'
    );
    if (window == null) {
      throw new Error('Main window not found for resize');
    }
    window.setBounds({ x: 100, y: 100, width: size.width, height: size.height });
  }, { width, height });
}

/**
 * Dispatches a menu action through the main process IPC channel.
 *
 * @param {import('playwright').ElectronApplication} app - Launched Electron app.
 * @param {string} action - Menu action id.
 */
async function sendMenuAction(app, action) {
  await app.evaluate(({ BrowserWindow }, menuAction) => {
    const window = BrowserWindow.getAllWindows().find(
      (candidate) => !candidate.isDestroyed() && candidate.getTitle() === 'HarborClient'
    );
    if (window == null) {
      throw new Error('Main window not found for menu action dispatch');
    }
    window.webContents.send('menu:action', menuAction);
  }, action);
}

/**
 * Resets UI state before each shot by closing overlays and modals.
 *
 * Avoids the frameless Linux title-bar window Close control, which would quit the app.
 *
 * @param {import('playwright').Page} page - Main window page.
 * @param {import('playwright').ElectronApplication} app - Launched Electron app.
 */
async function resetState(page, app) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
  }

  const cancelButton = page.getByRole('button', { name: 'Cancel' }).first();
  if (await cancelButton.isVisible().catch(() => false)) {
    await cancelButton.click();
    await page.waitForTimeout(150);
  }

  const backButton = page.getByRole('button', { name: 'Back' });
  while (await backButton.isVisible().catch(() => false)) {
    await backButton.click();
    await page.waitForTimeout(150);
  }

  const overlayHeaders = page.locator('h1').filter({
    hasText: /^(Settings|Team Hubs|Sharing Keys|Manage users|Manage tokens)$/
  });
  const overlayClose = overlayHeaders.locator('..').getByRole('button', { name: 'Close' });
  if (await overlayClose.isVisible().catch(() => false)) {
    await overlayClose.click();
    await page.waitForTimeout(150);
  }

  const aiSidebar = page.locator("aside[aria-label='AI']");
  if (await aiSidebar.isVisible().catch(() => false)) {
    await sendMenuAction(app, 'toggle-ai-sidebar');
    await page.waitForTimeout(150);
  }

  await page
    .getByLabel('Request URL')
    .waitFor({ state: 'visible', timeout: 5_000 })
    .catch(() => undefined);
}

/**
 * Converts a macro name token into a Playwright name matcher.
 *
 * @param {string} name - Plain string or `/regex/` pattern.
 * @returns Playwright-compatible name value.
 */
function parseNameMatcher(name) {
  if (typeof name === 'string' && name.startsWith('/') && name.endsWith('/')) {
    return new RegExp(name.slice(1, -1), 'i');
  }
  return name;
}

/**
 * Builds a Playwright locator from a macro target descriptor.
 *
 * @param {import('playwright').Page} page - Main window page.
 * @param {Record<string, string>} target - Locator descriptor.
 * @returns Matching locator.
 */
function buildLocator(page, target) {
  const nameMatcher = target.name ? parseNameMatcher(target.name) : undefined;

  if (target.selector) {
    let container = page.locator(target.selector);
    if (target.nearText) {
      container = container.filter({ hasText: target.nearText });
    }
    if (target.role && nameMatcher) {
      return container.getByRole(target.role, { name: nameMatcher }).first();
    }
    return container.first();
  }

  if (target.role && nameMatcher) {
    if (target.nearText) {
      return page
        .locator('*')
        .filter({ hasText: target.nearText })
        .getByRole(target.role, { name: nameMatcher })
        .first();
    }
    return page.getByRole(target.role, { name: nameMatcher }).first();
  }

  if (target.text) {
    return page.getByText(target.text, { exact: false }).first();
  }

  throw new Error(`Invalid click target: ${JSON.stringify(target)}`);
}

/**
 * Executes a single macro step.
 *
 * @param {import('playwright').Page} page - Main window page.
 * @param {import('playwright').ElectronApplication} app - Launched Electron app.
 * @param {Record<string, unknown>} step - Macro step definition.
 */
async function runStep(page, app, step) {
  if (step.menuAction) {
    await sendMenuAction(app, step.menuAction);
    await page.waitForTimeout(200);
    return;
  }

  if (step.shortcut) {
    const action = resolveShortcutAction(String(step.shortcut));
    if (action == null) {
      throw new Error(`Unknown shortcut: ${step.shortcut}`);
    }
    await sendMenuAction(app, action);
    await page.waitForTimeout(200);
    return;
  }

  if (step.click) {
    const locator = buildLocator(page, step.click);
    const timeout = step.optional ? 2_000 : 10_000;
    try {
      await locator.waitFor({ state: 'visible', timeout });
      await locator.click();
    } catch (error) {
      if (!step.optional) {
        throw error;
      }
    }
    await page.waitForTimeout(150);
    return;
  }

  if (step.type) {
    const text = String(step.type.text ?? '');
    if (step.type.into) {
      const locator = buildLocator(page, step.type.into);
      await locator.fill(text);
    } else {
      await page.keyboard.type(text);
    }
    return;
  }

  if (step.press) {
    await page.keyboard.press(String(step.press));
    await page.waitForTimeout(100);
    return;
  }

  if (step.send === true) {
    await page.getByRole('button', { name: /^Send$/ }).click();
    await page
      .getByRole('button', { name: 'Copy' })
      .waitFor({ state: 'visible', timeout: 45_000 })
      .catch(async () => {
        await page
          .getByText(/^Error$/u)
          .first()
          .waitFor({ state: 'visible', timeout: 5_000 })
          .catch(() => undefined);
      });
    await page.waitForTimeout(300);
    return;
  }

  if (step.waitFor) {
    if (typeof step.waitFor.ms === 'number') {
      await page.waitForTimeout(step.waitFor.ms);
      return;
    }
    const locator = buildLocator(page, step.waitFor);
    const timeout = step.optional ? 2_000 : 10_000;
    try {
      await locator.waitFor({ state: 'visible', timeout });
    } catch (error) {
      if (!step.optional) {
        throw error;
      }
    }
    return;
  }

  throw new Error(`Unknown macro step: ${JSON.stringify(step)}`);
}

/**
 * Executes the trigger and optional steps for a macro entry.
 *
 * @param {import('playwright').Page} page - Main window page.
 * @param {import('playwright').ElectronApplication} app - Launched Electron app.
 * @param {Record<string, unknown>} entry - Macro entry.
 */
async function runEntrySteps(page, app, entry) {
  if (entry.menuAction) {
    await sendMenuAction(app, entry.menuAction);
    await page.waitForTimeout(200);
  } else if (entry.shortcut) {
    const action = resolveShortcutAction(String(entry.shortcut));
    if (action == null) {
      throw new Error(`Unknown shortcut: ${entry.shortcut}`);
    }
    await sendMenuAction(app, action);
    await page.waitForTimeout(200);
  }

  if (Array.isArray(entry.steps)) {
    for (const step of entry.steps) {
      await runStep(page, app, step);
    }
  }
}

/**
 * Captures a screenshot according to the entry's capture options.
 *
 * @param {import('playwright').Page} page - Main window page.
 * @param {Record<string, unknown>} entry - Macro entry.
 * @param {string} outputPath - Destination PNG path.
 */
async function captureEntry(page, entry, outputPath) {
  const capture = entry.capture ?? 'window';

  if (capture === 'window') {
    await page.screenshot({ path: outputPath });
    return;
  }

  if (typeof capture === 'object' && capture.clip) {
    await page.screenshot({ path: outputPath, clip: capture.clip });
    return;
  }

  if (typeof capture === 'object') {
    const locator = buildLocator(page, capture);
    await locator.waitFor({ state: 'visible', timeout: 10_000 });
    await locator.screenshot({ path: outputPath });
    return;
  }

  throw new Error(`Invalid capture option for ${entry.filename}`);
}

/**
 * Loads and validates the macro file.
 *
 * @param {string} macroPath - Path to the macro JSON file.
 * @returns Parsed macro entries.
 */
async function loadMacro(macroPath) {
  const raw = await readFile(macroPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('Macro file must contain a JSON array');
  }
  for (const entry of parsed) {
    if (typeof entry.filename !== 'string' || entry.filename.trim().length === 0) {
      throw new Error('Each macro entry requires a non-empty filename');
    }
    if (!entry.menuAction && !entry.shortcut && !Array.isArray(entry.steps)) {
      throw new Error(`Entry ${entry.filename} requires menuAction, shortcut, or steps`);
    }
  }
  return parsed;
}

/**
 * Runs the screenshot capture workflow.
 */
async function main() {
  const options = parseArgs();
  console.log('Preparing HarborClient screenshot capture…');
  await ensureBuild(options.build);
  const entries = await loadMacro(options.macro);
  await mkdir(options.out, { recursive: true });

  console.log('Launching Electron app…');
  const app = await electron.launch({
    args: [mainEntry, '--no-sandbox', `--user-data-dir=${options.userDataDir}`],
    env: {
      ...process.env,
      ELECTRON_DISABLE_SANDBOX: '1'
    },
    timeout: 120_000
  });

  try {
    const page = await waitForMainWindow(app);
    console.log('Main window ready.');

    await resizeMainWindow(app, options.width, options.height);
    await page.waitForTimeout(500);

    const written = [];

    for (const entry of entries) {
      const outputPath = path.join(options.out, entry.filename);
      console.log(`Capturing ${entry.filename}…`);

      if (entry.reset !== false) {
        await resetState(page, app);
      }

      await runEntrySteps(page, app, entry);
      await page.waitForTimeout(300);
      await captureEntry(page, entry, outputPath);
      written.push(outputPath);
    }

    console.log(`Wrote ${written.length} screenshot(s):`);
    for (const filePath of written) {
      console.log(`  ${filePath}`);
    }
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
