/**
 * One slash command surfaced in Action menu command mode.
 */
export interface SlashCommandDefinition {
  /** Stable command id used for dispatch. */
  id: string;
  /** Keyword typed after the leading slash (for example `ask` in `/ask`). */
  keyword: string;
  /** Primary label shown in the suggestion row. */
  label: string;
  /** Secondary description shown beneath the label. */
  description: string;
}

/**
 * Slash commands available from the Action menu command palette.
 */
export const SLASH_COMMANDS: SlashCommandDefinition[] = [
  {
    id: 'ask',
    keyword: 'ask',
    label: 'Ask AI',
    description: 'Start a new AI chat with this question'
  }
];

/**
 * A fully resolved slash command with its typed argument text.
 */
export interface ResolvedSlashCommand {
  /** Matched command definition. */
  command: SlashCommandDefinition;
  /** Argument text after the command keyword, trimmed. */
  argument: string;
}

/**
 * Returns whether the query should enter Action menu command mode.
 *
 * @param query - Raw search input value.
 */
export function isSlashCommandQuery(query: string): boolean {
  return query.startsWith('/');
}

/**
 * Returns the command keyword portion of a slash query (text before the first space).
 *
 * @param query - Raw slash-prefixed input.
 */
function slashCommandKeywordPortion(query: string): string {
  const withoutSlash = query.slice(1);
  const spaceIndex = withoutSlash.indexOf(' ');
  return spaceIndex === -1 ? withoutSlash : withoutSlash.slice(0, spaceIndex);
}

/**
 * Filters registered slash commands whose keyword matches the typed prefix.
 *
 * @param query - Raw slash-prefixed input.
 */
export function matchSlashCommandSuggestions(query: string): SlashCommandDefinition[] {
  if (!isSlashCommandQuery(query)) {
    return [];
  }

  const keywordPortion = slashCommandKeywordPortion(query).toLowerCase();
  if (keywordPortion.length === 0) {
    return SLASH_COMMANDS;
  }

  return SLASH_COMMANDS.filter((command) => command.keyword.startsWith(keywordPortion));
}

/**
 * Resolves a slash query to a known command and its argument when the keyword matches exactly.
 *
 * @param query - Raw slash-prefixed input.
 */
export function resolveSlashCommand(query: string): ResolvedSlashCommand | null {
  if (!isSlashCommandQuery(query)) {
    return null;
  }

  const match = /^\/(\S+)(?:\s+([\s\S]*))?$/.exec(query);
  if (match == null) {
    return null;
  }

  const keyword = match[1]?.toLowerCase();
  if (keyword == null || keyword.length === 0) {
    return null;
  }

  const command = SLASH_COMMANDS.find((entry) => entry.keyword === keyword);
  if (command == null) {
    return null;
  }

  return {
    command,
    argument: (match[2] ?? '').trim()
  };
}
