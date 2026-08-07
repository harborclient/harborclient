/**
 * Tailwind background classes keyed by persisted server avatar color values.
 */
const AVATAR_COLOR_CLASS_BY_KEY: Record<string, string> = {
  'sky-600': 'bg-sky-600',
  'violet-600': 'bg-violet-600',
  'emerald-600': 'bg-emerald-600',
  'amber-600': 'bg-amber-600',
  'rose-600': 'bg-rose-600',
  'cyan-600': 'bg-cyan-600',
  'indigo-600': 'bg-indigo-600',
  'teal-600': 'bg-teal-600'
};

/**
 * Builds up to two initials from a display name for Team Hub rail avatars.
 *
 * Uses the first character of the first two whitespace-separated words when
 * present; otherwise falls back to the first two characters of the single
 * token. Non-letter characters are skipped when selecting initials.
 *
 * @param name - Authenticated user name or connection display name.
 * @returns Uppercase initials (1–2 characters), or `?` when empty.
 */
export function teamHubInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return '?';
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const first = firstLetter(words[0] ?? '');
    const second = firstLetter(words[1] ?? '');
    const combined = `${first}${second}`;
    return combined || '?';
  }

  const token = words[0] ?? '';
  const letters = [...token].filter((char) => /\p{L}/u.test(char));
  if (letters.length >= 2) {
    return `${letters[0]}${letters[1]}`.toUpperCase();
  }
  if (letters.length === 1) {
    return letters[0]!.toUpperCase();
  }

  return token.slice(0, 2).toUpperCase() || '?';
}

/**
 * Returns the first letter character from a word, uppercased.
 *
 * @param word - Single whitespace-delimited token.
 * @returns Uppercase letter, or empty string when none is found.
 */
function firstLetter(word: string): string {
  const match = word.match(/\p{L}/u);
  return match?.[0]?.toUpperCase() ?? '';
}

/**
 * Maps a persisted server avatar color key to a Tailwind background class.
 *
 * Falls back to a deterministic class from `hubId` when the key is unknown so
 * older hubs without server avatar metadata still render consistently.
 *
 * @param colorKey - Server-provided palette key, when available.
 * @param hubId - Team hub connection id used for local fallback hashing.
 * @returns Tailwind background utility class.
 */
export function teamHubAvatarColorClassFromKey(
  colorKey: string | undefined,
  hubId: string
): string {
  const mapped = colorKey ? AVATAR_COLOR_CLASS_BY_KEY[colorKey] : undefined;
  return mapped ?? teamHubAvatarColorClass(hubId);
}

/**
 * Deterministic avatar background class from a hub id.
 *
 * @param hubId - Team hub connection id.
 * @returns Tailwind background utility class.
 */
export function teamHubAvatarColorClass(hubId: string): string {
  const palette = [
    'bg-sky-600',
    'bg-violet-600',
    'bg-emerald-600',
    'bg-amber-600',
    'bg-rose-600',
    'bg-cyan-600',
    'bg-indigo-600',
    'bg-teal-600'
  ] as const;

  let hash = 0;
  for (let index = 0; index < hubId.length; index += 1) {
    hash = (hash * 31 + hubId.charCodeAt(index)) >>> 0;
  }

  return palette[hash % palette.length] ?? palette[0];
}
