import type { UserRecord } from '#/db/types.js';

/**
 * Escapes special characters in a string for use inside a RegExp.
 *
 * @param value - Raw string to escape.
 * @returns RegExp-safe string.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parses @mention tokens from discussion comment bodies against known Team Hub users.
 *
 * Matches `@username` tokens and full `@Display Name` prefixes when names contain spaces.
 * Comparison is case-insensitive for simple tokens; display-name matches use the stored name.
 *
 * @param body - Comment body text to scan.
 * @param users - Tenant users eligible for mention resolution.
 * @returns Unique user ids mentioned in the body.
 */
export function parseMentionedUserIds(body: string, users: UserRecord[]): string[] {
  const mentioned = new Set<string>();
  const sortedByNameLength = [...users].sort((a, b) => b.name.length - a.name.length);

  for (const user of sortedByNameLength) {
    if (!user.name.trim()) {
      continue;
    }

    const pattern = new RegExp(`@${escapeRegExp(user.name)}(?![\\w.-])`, 'gi');
    if (pattern.test(body)) {
      mentioned.add(user.id);
    }
  }

  const tokenPattern = /@([\w][\w.-]*)/g;
  let match: RegExpExecArray | null;
  while ((match = tokenPattern.exec(body)) !== null) {
    const token = match[1]?.toLowerCase();
    if (!token) {
      continue;
    }

    for (const user of users) {
      if (user.name.toLowerCase() === token) {
        mentioned.add(user.id);
      }
    }
  }

  return [...mentioned];
}
