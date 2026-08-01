/**
 * Compiles a live-server script matchPath glob into a RegExp.
 *
 * `*` matches a single path segment (`[^/]*`). `**` matches across segments
 * (`.*`). Other regex metacharacters are escaped.
 *
 * @param pattern - Glob pattern (already trimmed).
 * @returns Case-sensitive RegExp that matches the entire subject string.
 */
function compileGlobToRegExp(pattern: string): RegExp {
  let source = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i]!;
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        source += '.*';
        i += 1;
      } else {
        source += '[^/]*';
      }
      continue;
    }
    if (ch === '?') {
      source += '[^/]';
      continue;
    }
    if (/[.+^${}()|[\]\\]/.test(ch)) {
      source += `\\${ch}`;
      continue;
    }
    source += ch;
  }
  return new RegExp(`^${source}$`);
}

/**
 * Returns the basename of a URL pathname (last segment after `/`).
 *
 * @param pathname - Request pathname (e.g. `/docs/index.html`).
 * @returns Basename, or empty string for `/`.
 */
export function liveServerPathBasename(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  if (trimmed === '' || trimmed === '/') {
    return '';
  }
  const slash = trimmed.lastIndexOf('/');
  return slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
}

/**
 * Tests whether a request pathname matches a live-server script `matchPath`.
 *
 * Rules:
 * - `*` alone matches every path.
 * - Patterns containing `/` are globbed against the full pathname (leading
 *   slash on the pattern is optional; both `/index.html` and `index.html`
 *   with a slash elsewhere match pathnames).
 * - Patterns without `/` are globbed against the basename only, so `*.png`
 *   matches `/img/logo.png` and `index.html` matches `/docs/index.html`.
 *
 * @param pathname - Express `req.path` (pathname only, no query).
 * @param matchPath - Configured match pattern from the script row.
 * @returns True when the script should run for this request.
 */
export function pathMatchesLiveServerScript(pathname: string, matchPath: string): boolean {
  const pattern = matchPath.trim();
  if (pattern === '') {
    return false;
  }
  if (pattern === '*') {
    return true;
  }

  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;

  if (pattern.includes('/')) {
    const normalizedPattern = pattern.startsWith('/') ? pattern : `/${pattern}`;
    try {
      return compileGlobToRegExp(normalizedPattern).test(path);
    } catch {
      return false;
    }
  }

  const basename = liveServerPathBasename(path);
  try {
    return compileGlobToRegExp(pattern).test(basename);
  } catch {
    return false;
  }
}
