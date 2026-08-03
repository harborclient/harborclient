/**
 * Validation for plugin-supplied custom chat-pointer `match` patterns.
 *
 * Custom patterns match the token body after `@` and must not collide with
 * reserved builtin pointer prefixes.
 */

/**
 * Maximum length of a plugin chat-pointer match source string.
 */
export const PLUGIN_CHAT_POINTER_MATCH_MAX_LENGTH = 256;

/**
 * Sample UUID used in reserved-prefix probe tokens.
 */
const RESERVED_PROBE_UUID = '550e8400-e29b-41d4-a716-446655440000';

/**
 * Builtin-owned token-body probes. A custom plugin `match` is rejected when it
 * successfully matches any of these at index 0.
 */
export const RESERVED_CHAT_POINTER_MATCH_PROBES: readonly string[] = [
  `plugin.com.example.script.key`,
  `plugin.com.example.script.key#0.1`,
  `request.${RESERVED_PROBE_UUID}`,
  `folder.${RESERVED_PROBE_UUID}`,
  `collection.${RESERVED_PROBE_UUID}`,
  `snippet.${RESERVED_PROBE_UUID}`,
  `snippet.${RESERVED_PROBE_UUID}#10.42`,
  `term.2`,
  `term.2#1.33`,
  `webpage.${RESERVED_PROBE_UUID}`,
  `webpage.${RESERVED_PROBE_UUID}#120.80`,
  `live-server.${RESERVED_PROBE_UUID}`,
  `logs.${RESERVED_PROBE_UUID}`,
  `logs.${RESERVED_PROBE_UUID}#1.40`,
  `markdown.${RESERVED_PROBE_UUID}#10.42`,
  `res.${RESERVED_PROBE_UUID}.body`,
  `res.${RESERVED_PROBE_UUID}.headers`,
  `console.headers.0`,
  `body`,
  `body#10.42`,
  `active.pre.1`,
  `active.pre.1#10.42`,
  `1.pre.1`,
  `42.post.2`
];

/**
 * Leading reserved prefixes documented for plugin authors (denylist summary).
 */
export const RESERVED_CHAT_POINTER_PREFIXES: readonly string[] = [
  'plugin',
  'request',
  'folder',
  'collection',
  'snippet',
  'term',
  'webpage',
  'live-server',
  'logs',
  'markdown',
  'res',
  'console',
  'body',
  'active'
];

/**
 * Strips a single leading `^` and trailing `$` from a regex source.
 *
 * @param source - Raw regex source.
 * @returns Source without outer anchors.
 */
export function stripPluginChatPointerMatchAnchors(source: string): string {
  let next = source;
  if (next.startsWith('^')) {
    next = next.slice(1);
  }
  if (next.endsWith('$') && !next.endsWith('\\$')) {
    next = next.slice(0, -1);
  }
  return next;
}

/**
 * Normalizes a plugin `match` RegExp or source string into an unanchored source.
 *
 * @param match - Plugin-supplied pattern (body after `@`).
 * @returns Unanchored regex source suitable for `^${source}` compilation.
 * @throws When the pattern is empty, too long, uses the global flag, or is invalid.
 */
export function normalizePluginChatPointerMatchSource(match: RegExp | string): string {
  let source: string;
  if (match instanceof RegExp) {
    if (match.global) {
      throw new Error('Chat pointer match must not use the global (g) flag.');
    }
    source = match.source;
  } else {
    source = String(match ?? '');
  }

  source = stripPluginChatPointerMatchAnchors(source.trim());
  if (!source) {
    throw new Error('Chat pointer match must not be empty.');
  }
  if (source.length > PLUGIN_CHAT_POINTER_MATCH_MAX_LENGTH) {
    throw new Error(
      `Chat pointer match must be at most ${PLUGIN_CHAT_POINTER_MATCH_MAX_LENGTH} characters.`
    );
  }

  try {
    // Validate compilability before reserved-prefix checks.
    void new RegExp(`^(?:${source})`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid chat pointer match: ${message}`);
  }

  return source;
}

/**
 * Returns whether a compiled plugin match collides with a reserved builtin probe.
 *
 * @param compiled - Anchored match regex (`^…`).
 * @returns The first colliding probe string, or null when safe.
 */
export function findReservedChatPointerMatchCollision(compiled: RegExp): string | null {
  for (const probe of RESERVED_CHAT_POINTER_MATCH_PROBES) {
    const matched = probe.match(compiled);
    if (matched != null && matched.index === 0) {
      return probe;
    }
  }
  return null;
}

/**
 * Compiles and validates a plugin custom chat-pointer match pattern.
 *
 * @param match - Plugin-supplied RegExp or source for the token body after `@`.
 * @returns Non-global RegExp anchored at the start of the body.
 * @throws When invalid or colliding with a reserved builtin probe.
 */
export function compilePluginChatPointerMatch(match: RegExp | string): RegExp {
  const source = normalizePluginChatPointerMatchSource(match);
  const compiled = new RegExp(`^(?:${source})`);
  const collision = findReservedChatPointerMatchCollision(compiled);
  if (collision != null) {
    throw new Error(
      `Chat pointer match collides with a reserved builtin token shape (matched "${collision}"). ` +
        `Avoid prefixes: ${RESERVED_CHAT_POINTER_PREFIXES.join(', ')}.`
    );
  }
  return compiled;
}

/**
 * Builds the registry id for a custom plugin chat-pointer definition.
 *
 * @param pluginId - Owning plugin manifest id.
 * @param pointerId - Pointer id from {@link registerChatPointer}.
 * @returns Stable definition id such as `plugin:com.example:invoice`.
 */
export function buildCustomPluginChatPointerDefinitionId(
  pluginId: string,
  pointerId: string
): string {
  return `plugin:${pluginId}:${pointerId}`;
}
