/**
 * Captures HarborClient screenshots driven by a JSON macro file.
 *
 * Uses Playwright's Electron launcher against the built app (`out/main/index.js`).
 * Menu shortcuts are dispatched via the same `menu:action` IPC channel as the native
 * menu (see src/main/menu.ts and src/shared/shortcuts.ts).
 */
import { spawnSync } from 'node:child_process';
import { mkdir, readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultMacroPath = path.join(projectRoot, 'screenshots.macro.json');
const defaultOutDir = path.join(projectRoot, 'images', 'screenshots');
const mainEntry = path.join(projectRoot, 'out', 'main', 'index.js');
const mainSourceRoot = path.join(projectRoot, 'src', 'main');
const rendererSourceRoot = path.join(projectRoot, 'src', 'renderer');
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
    userDataDir: defaultUserDataDir,
    from: null,
    theme: 'dark'
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
      continue;
    }
    if (arg === '--from' && args[index + 1]) {
      options.from = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--theme' && args[index + 1]) {
      options.theme = args[index + 1];
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
 * Returns the newest modification time under a directory tree.
 *
 * @param {string} directory - Root directory to scan.
 * @returns Latest mtime in milliseconds, or 0 when empty.
 */
async function getDirectoryNewestMtime(directory) {
  let newest = 0;
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      newest = Math.max(newest, await getDirectoryNewestMtime(entryPath));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const entryStat = await stat(entryPath);
    newest = Math.max(newest, entryStat.mtimeMs);
  }

  return newest;
}

/**
 * Returns true when the bundled app output is older than source trees.
 *
 * @returns Whether `pnpm build` should run before launching Electron.
 */
async function isMainBuildStale() {
  try {
    const [builtStat, mainSourceMtime, rendererSourceMtime] = await Promise.all([
      stat(mainEntry),
      getDirectoryNewestMtime(mainSourceRoot),
      getDirectoryNewestMtime(rendererSourceRoot)
    ]);
    const sourceMtime = Math.max(mainSourceMtime, rendererSourceMtime);
    return sourceMtime > builtStat.mtimeMs;
  } catch {
    return true;
  }
}

/**
 * Builds Playwright launch args for HarborClient, including app CLI switches.
 *
 * @param {object} options - Parsed screenshot runner options.
 * @param {string} options.theme - Built-in theme id forwarded as `--theme`.
 * @param {string} options.userDataDir - Electron profile directory.
 * @returns Argument list passed to the packaged main entry.
 */
function buildElectronLaunchArgs(options) {
  return [
    mainEntry,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--quit-without-warning',
    '--theme',
    options.theme,
    `--user-data-dir=${options.userDataDir}`
  ];
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

  let needsBuild = false;
  try {
    await readFile(mainEntry);
    needsBuild = await isMainBuildStale();
  } catch {
    needsBuild = true;
  }

  if (needsBuild) {
    console.log('Main process build is missing or stale; running pnpm build…');
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
 * Dismisses first-run or blocking modals that cover the main workspace.
 *
 * @param {import('playwright').Page} page - Main window page.
 */
async function dismissBlockingModals(page) {
  const notNowButton = page.getByRole('button', { name: 'Not now' });
  if (await notNowButton.isVisible().catch(() => false)) {
    await notNowButton.click();
    await page.waitForTimeout(200);
  }
}

/**
 * Waits until the main HarborClient window is available and the request UI is ready.
 *
 * Plugin agent windows may appear during startup; they are ignored. The theme picker
 * and other blocking modals are dismissed when detected.
 *
 * @param {import('playwright').ElectronApplication} app - Launched Electron app.
 * @returns Main window page.
 */
async function waitForMainWindow(app) {
  const deadline = Date.now() + 180_000;

  while (Date.now() < deadline) {
    for (const window of app.windows()) {
      const title = await window.title().catch(() => '');
      if (title !== 'HarborClient') {
        continue;
      }

      await window.waitForLoadState('domcontentloaded', { timeout: 5_000 }).catch(() => undefined);
      await prepareMainWorkspace(window);

      if (await isMainWorkspaceReady(window)) {
        return window;
      }
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 500);
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

/** Accessible names for configuration page tab close buttons. */
const PAGE_TAB_CLOSE_PATTERN =
  /^Close (General|Globals|Snippets|Storage|Shortcuts|Syntax highlighting|AI|Proxy|Backup & Restore|Plugins|Team Hub|Sharing Keys)/;

/**
 * Closes open configuration page tabs from the tab bar.
 *
 * @param {import('playwright').Page} page - Main window page.
 */
async function closePageTabs(page) {
  const tabList = page.getByRole('tablist', { name: 'Open tabs' });
  const pageTabCloseButtons = tabList.getByRole('button', { name: PAGE_TAB_CLOSE_PATTERN });
  const pageTabCloseCount = await pageTabCloseButtons.count().catch(() => 0);
  for (let index = 0; index < pageTabCloseCount; index += 1) {
    const closeButton = pageTabCloseButtons.first();
    if (!(await closeButton.isVisible().catch(() => false))) {
      break;
    }
    await closeButton.click();
    await page.waitForTimeout(150);
  }
}

/**
 * Returns true when the main workspace shell is ready for macro steps.
 *
 * @param {import('playwright').Page} page - Main window page.
 * @returns Whether the collections sidebar or request editor is visible.
 */
async function isMainWorkspaceReady(page) {
  if (await page.getByLabel('Request URL').isVisible().catch(() => false)) {
    return true;
  }

  if (await page.getByRole('navigation', { name: 'Collections' }).isVisible().catch(() => false)) {
    return true;
  }

  return false;
}

/**
 * Clears persisted page tabs and modals so the workspace is reachable on startup.
 *
 * @param {import('playwright').Page} page - Main window page.
 */
async function prepareMainWorkspace(page) {
  await dismissBlockingModals(page);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
  }

  await closePageTabs(page);
}

/**
 * Resets UI state before each shot by closing page tabs, modals, and side panels.
 *
 * Settings, Plugins, Team Hub, and Sharing Keys open as page tabs rather than
 * overlays. Escape dismisses modals and tabs; nested Team Hub views also need
 * Back. Avoids the frameless Linux title-bar window Close control, which would
 * quit the app.
 *
 * @param {import('playwright').Page} page - Main window page.
 * @param {import('playwright').ElectronApplication} app - Launched Electron app.
 */
async function resetState(page, app) {
  await dismissBlockingModals(page);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
  }

  const backButton = page.getByRole('button', { name: 'Back' });
  while (await backButton.isVisible().catch(() => false)) {
    await backButton.click();
    await page.waitForTimeout(150);
  }

  const cancelButton = page.getByRole('button', { name: 'Cancel' }).first();
  if (await cancelButton.isVisible().catch(() => false)) {
    await cancelButton.click();
    await page.waitForTimeout(150);
  }

  await closePageTabs(page);

  const aiSidebar = page.locator("aside[aria-label='AI']");
  if (await aiSidebar.isVisible().catch(() => false)) {
    await sendMenuAction(app, 'toggle-ai-sidebar');
    await page.waitForTimeout(150);
  }

  await page
    .getByLabel('Request URL')
    .waitFor({ state: 'visible', timeout: 5_000 })
    .catch(() => undefined);

  await page
    .getByRole('navigation', { name: 'Collections' })
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
    const textMatcher = parseNameMatcher(target.text);
    return page.getByText(textMatcher, { exact: false }).first();
  }

  throw new Error(`Invalid click target: ${JSON.stringify(target)}`);
}

/**
 * Resolves the Playwright timeout for a macro step.
 *
 * @param {Record<string, unknown>} step - Macro step definition.
 * @param {number} defaultTimeout - Timeout when the step does not override it.
 * @returns Timeout in milliseconds.
 */
function stepTimeout(step, defaultTimeout) {
  if (typeof step.timeout === 'number' && step.timeout > 0) {
    return step.timeout;
  }
  return defaultTimeout;
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
    const timeout = stepTimeout(step, step.optional ? 2_000 : 10_000);
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
    const timeout = stepTimeout(step, step.optional ? 2_000 : 10_000);
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
  const allEntries = await loadMacro(options.macro);
  const fromIndex =
    options.from == null
      ? 0
      : allEntries.findIndex((entry) => entry.filename === options.from);
  if (options.from != null && fromIndex < 0) {
    throw new Error(`Unknown --from filename: ${options.from}`);
  }
  const entries = fromIndex > 0 ? allEntries.slice(fromIndex) : allEntries;
  await mkdir(options.out, { recursive: true });

  const launchArgs = buildElectronLaunchArgs(options);

  console.log(
    `Launching Electron app (--theme ${options.theme}, --quit-without-warning)…`
  );
  const app = await electron.launch({
    args: launchArgs,
    env: {
      ...process.env,
      ELECTRON_DISABLE_SANDBOX: '1'
    },
    timeout: 180_000
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
