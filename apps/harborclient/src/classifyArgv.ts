/**
 * Product argv classification for the HarborClient Electron entrypoint.
 *
 * Decides whether a launch should open the GUI, run the CLI, or print
 * product-level help/version — before the GUI main graph loads.
 */

/** HTTP methods that select the CLI ad-hoc request path. */
const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

/** HarborClient custom protocol prefix used for deep links. */
const HARBOR_PROTOCOL_PREFIX = 'harborclient://';

/**
 * Route selected by {@link classifyArgv}.
 */
export type ArgvRoute = 'gui' | 'cli' | 'help' | 'version';

/**
 * Returns whether a token is a CLI HTTP method (case-insensitive).
 *
 * @param token - First positional argv token.
 * @returns True when the token names a supported method.
 */
function isHttpMethod(token: string): boolean {
  return HTTP_METHODS.has(token.toUpperCase());
}

/**
 * Strips Electron/runtime prefixes from `process.argv`, leaving user arguments.
 *
 * Packaged builds: `[execPath, ...userArgs]`.
 * Dev / `process.defaultApp`: `[electron, appPath, ...userArgs]`.
 *
 * @param argv - Full process argument list (defaults to `process.argv`).
 * @returns Arguments the user typed after the binary name.
 */
export function getUserArgv(argv: string[] = process.argv): string[] {
  if (process.defaultApp) {
    return argv.slice(2);
  }
  return argv.slice(1);
}

/**
 * Classifies user argv into a product route.
 *
 * Empty argv and GUI-only flags open the desktop app. CLI is selected only when
 * the first positional token is an HTTP method, `run`, or `workflow`.
 *
 * @param userArgv - Arguments from {@link getUserArgv} (no exec/script path).
 * @returns Route for the product bootstrap to follow.
 */
export function classifyArgv(userArgv: string[]): ArgvRoute {
  if (userArgv.length === 0) {
    return 'gui';
  }

  if (userArgv.includes('-h') || userArgv.includes('--help')) {
    return 'help';
  }

  if (userArgv.includes('-V') || userArgv.includes('--version')) {
    return 'version';
  }

  const first = userArgv[0];
  if (first == null) {
    return 'gui';
  }

  if (first.startsWith(HARBOR_PROTOCOL_PREFIX)) {
    return 'gui';
  }

  if (first === 'run' || first === 'workflow' || isHttpMethod(first)) {
    return 'cli';
  }

  return 'gui';
}
