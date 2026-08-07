/**
 * Supported avatar background color keys persisted on hub and user records.
 *
 * Values match HarborClient Tailwind utility suffixes (`bg-{key}`).
 */
export const AVATAR_COLOR_KEYS = [
  'sky-600',
  'violet-600',
  'emerald-600',
  'amber-600',
  'rose-600',
  'cyan-600',
  'indigo-600',
  'teal-600'
] as const;

/**
 * Persisted avatar color key.
 */
export type AvatarColorKey = (typeof AVATAR_COLOR_KEYS)[number];

/**
 * Initials and color used to render a hub or user avatar tile.
 */
export interface AvatarPresentation {
  /**
   * One or two uppercase initials shown in the avatar tile.
   */
  initials: string;

  /**
   * Persisted palette key for the avatar background color.
   */
  color: AvatarColorKey;
}

/**
 * Builds up to two initials from a display name.
 *
 * Uses the first character of the first two whitespace-separated words when
 * present; otherwise falls back to the first two letter characters of the
 * single token.
 *
 * @param name - Hub or user display name.
 * @returns Uppercase initials (1–2 characters), or `?` when empty.
 */
export function avatarInitialsFromName(name: string): string {
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
 * Deterministic avatar color key from a stable seed such as tenant id or user id.
 *
 * @param seed - Stable identifier used for hashing.
 * @returns Palette key from {@link AVATAR_COLOR_KEYS}.
 */
export function avatarColorFromSeed(seed: string): AvatarColorKey {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return AVATAR_COLOR_KEYS[hash % AVATAR_COLOR_KEYS.length] ?? AVATAR_COLOR_KEYS[0];
}

/**
 * Builds default avatar presentation from a display name and stable seed.
 *
 * @param displayName - Hub or user display name used for initials.
 * @param seed - Stable identifier used for deterministic color assignment.
 * @returns Default initials and color suitable for persistence.
 */
export function defaultAvatarPresentation(displayName: string, seed: string): AvatarPresentation {
  return {
    initials: avatarInitialsFromName(displayName),
    color: avatarColorFromSeed(seed)
  };
}

/**
 * Normalizes admin-provided avatar initials for persistence.
 *
 * @param value - Raw initials from an admin update request.
 * @returns Trimmed uppercase initials (1–2 letters).
 * @throws {Error} When the value is empty or contains non-letters.
 */
export function normalizeAvatarInitials(value: string): string {
  const trimmed = value.trim().toUpperCase();
  if (!trimmed || trimmed.length > 2) {
    throw new Error('Avatar initials must be one or two letters.');
  }

  if (!/^\p{L}+$/u.test(trimmed)) {
    throw new Error('Avatar initials must contain letters only.');
  }

  return trimmed;
}

/**
 * Validates a persisted avatar color key from an admin update request.
 *
 * @param value - Raw color key from an admin update request.
 * @returns Normalized palette key.
 * @throws {Error} When the value is not a supported palette key.
 */
export function normalizeAvatarColor(value: string): AvatarColorKey {
  const trimmed = value.trim();
  if (!(AVATAR_COLOR_KEYS as readonly string[]).includes(trimmed)) {
    throw new Error(`Avatar color must be one of: ${AVATAR_COLOR_KEYS.join(', ')}.`);
  }

  return trimmed as AvatarColorKey;
}

/**
 * Returns true when both avatar fields are set on a tenant record.
 *
 * @param avatarInitials - Persisted initials, if any.
 * @param avatarColor - Persisted color key, if any.
 */
export function hasPersistedAvatar(
  avatarInitials: string | null | undefined,
  avatarColor: string | null | undefined
): boolean {
  return Boolean(avatarInitials?.trim() && avatarColor?.trim());
}
