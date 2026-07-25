import type { Variable } from '../types.js';
import { getDynamicVariableDescription, resolveDynamicVariable } from './dynamic.js';
import { type FilterCall, applyFilters } from './filters.js';

/**
 * A segment of text, optionally marking a {{variable}} token.
 */
export interface VariableToken {
  text: string;
  key?: string;
  filters?: FilterCall[];
}

/**
 * A parsed `{{ variable | filter }}` placeholder with source offsets.
 */
export interface ParsedVariableToken {
  raw: string;
  key: string;
  filters: FilterCall[];
  start: number;
  end: number;
}

/**
 * Allowed characters inside a `{{variable}}` token name (excluding braces).
 * Includes `$` so Postman-style dynamic names such as `$randomUUID` are recognized.
 */
export const VARIABLE_NAME_CHARS = '\\w$.-';

/**
 * Global regex matching `{{variableName}}` and filter chains for editor highlighting.
 */
export const VARIABLE_TOKEN_PATTERN = new RegExp(
  `\\{\\{\\s*([${VARIABLE_NAME_CHARS}]+)(\\s*\\|\\s*[${VARIABLE_NAME_CHARS}]+)*\\s*\\}\\}`,
  'g'
);

const VALID_NAME_PATTERN = new RegExp(`^[${VARIABLE_NAME_CHARS}]+$`);

/**
 * Returns whether a variable key or filter name uses only allowed characters.
 *
 * @param name - Identifier from inside `{{...}}` braces.
 */
function isValidName(name: string): boolean {
  return name.length > 0 && VALID_NAME_PATTERN.test(name);
}

/**
 * Parses the inner expression of a `{{...}}` token into a key and filter chain.
 *
 * @param inner - Text between opening and closing braces.
 * @returns Parsed key and filters, or null when malformed.
 */
function parseVariableExpression(inner: string): { key: string; filters: FilterCall[] } | null {
  const segments = inner.split('|').map((segment) => segment.trim());
  if (segments.length === 0 || segments[0] === '') {
    return null;
  }

  const key = segments[0];
  if (!isValidName(key)) {
    return null;
  }

  const filters: FilterCall[] = [];
  for (let i = 1; i < segments.length; i++) {
    const name = segments[i];
    if (!isValidName(name)) {
      return null;
    }
    filters.push({ name, args: [] });
  }

  return { key, filters };
}

/**
 * Scans text for `{{ variable | filter }}` placeholders using a hand-written lexer.
 *
 * @param text - Text containing variable placeholders.
 * @returns Parsed tokens with character offsets; malformed `{{` sequences are skipped.
 */
export function parseVariableTokens(text: string): ParsedVariableToken[] {
  const tokens: ParsedVariableToken[] = [];
  let index = 0;

  while (index < text.length) {
    const open = text.indexOf('{{', index);
    if (open === -1) {
      break;
    }

    const close = text.indexOf('}}', open + 2);
    if (close === -1) {
      break;
    }

    const raw = text.slice(open, close + 2);
    const inner = text.slice(open + 2, close);
    const parsed = parseVariableExpression(inner);

    if (parsed) {
      tokens.push({
        raw,
        key: parsed.key,
        filters: parsed.filters,
        start: open,
        end: close + 2
      });
      index = close + 2;
      continue;
    }

    index = open + 2;
  }

  return tokens;
}

/**
 * Builds a lookup map from collection variables.
 *
 * @param variables - Collection-scoped variables.
 * @returns Map of trimmed keys to resolved values.
 */
function variableLookup(variables: Variable[]): Map<string, string> {
  return new Map(
    variables
      .filter((v) => v.key.trim())
      .map((v) => [v.key.trim(), v.value !== '' ? v.value : v.defaultValue])
  );
}

/**
 * Resolves a variable key to a string value using a lookup function and dynamic variables.
 *
 * @param key - Base variable name from a parsed token.
 * @param resolveKey - Resolver for static/runtime variables.
 * @returns Resolved value, or undefined when the key is not defined.
 */
function resolveKeyValue(
  key: string,
  resolveKey: (key: string) => string | undefined
): string | undefined {
  const value = resolveKey(key);
  if (value !== undefined) {
    return value;
  }
  return resolveDynamicVariable(key);
}

/**
 * Substitutes parsed variable tokens in text using a key resolver.
 *
 * Unknown variables and unknown filters leave the original token unchanged.
 *
 * @param text - Text containing variable placeholders.
 * @param resolveKey - Resolver for static/runtime variables.
 * @returns Text with known variables substituted and filters applied.
 */
function substituteWithResolver(
  text: string,
  resolveKey: (key: string) => string | undefined
): string {
  const parsedTokens = parseVariableTokens(text);
  if (parsedTokens.length === 0) {
    return text;
  }

  let result = '';
  let lastIndex = 0;

  for (const token of parsedTokens) {
    result += text.slice(lastIndex, token.start);
    const resolved = resolveKeyValue(token.key, resolveKey);

    if (resolved === undefined) {
      result += token.raw;
    } else {
      const filtered = applyFilters(resolved, token.filters);
      result += filtered ?? token.raw;
    }

    lastIndex = token.end;
  }

  result += text.slice(lastIndex);
  return result;
}

/**
 * Splits text into plain and {{variable}} segments.
 *
 * @param text - Text containing variable placeholders.
 * @returns Ordered tokens for rendering or further processing.
 */
export function tokenizeVariables(text: string): VariableToken[] {
  const parsedTokens = parseVariableTokens(text);
  if (parsedTokens.length === 0) {
    return [{ text }];
  }

  const tokens: VariableToken[] = [];
  let lastIndex = 0;

  for (const token of parsedTokens) {
    if (token.start > lastIndex) {
      tokens.push({ text: text.slice(lastIndex, token.start) });
    }
    tokens.push({
      text: token.raw,
      key: token.key,
      filters: token.filters.length > 0 ? token.filters : undefined
    });
    lastIndex = token.end;
  }

  if (lastIndex < text.length) {
    tokens.push({ text: text.slice(lastIndex) });
  }

  return tokens;
}

/**
 * A {{variable}} token located at a character offset in source text.
 */
export interface VariableTokenMatch {
  key: string;
  start: number;
  end: number;
  filters?: FilterCall[];
}

/**
 * Returns the variable token containing the given character offset, if any.
 *
 * @param text - Text containing variable placeholders.
 * @param offset - Zero-based character offset from the start of `text`.
 * @returns Matching token range and key, or null when offset is outside a token.
 */
export function getVariableTokenAtOffset(text: string, offset: number): VariableTokenMatch | null {
  let position = 0;

  for (const token of tokenizeVariables(text)) {
    const start = position;
    const end = position + token.text.length;
    if (token.key && offset >= start && offset <= end) {
      return {
        key: token.key,
        start,
        end,
        filters: token.filters
      };
    }
    position = end;
  }

  return null;
}

/**
 * Resolved tooltip text for a variable key.
 */
export interface VariableTooltipContent {
  text: string;
  muted: boolean;
}

/**
 * Resolves display text for a variable tooltip.
 *
 * @param key - Variable name from a {{key}} placeholder.
 * @param variables - Collection-scoped variables.
 * @returns Tooltip body text and whether it should use muted styling.
 */
export function getVariableTooltipContent(
  key: string,
  variables: Variable[]
): VariableTooltipContent {
  const value = resolveVariable(key, variables);
  if (value !== undefined) {
    return { text: value, muted: false };
  }

  const dynamicDescription = getDynamicVariableDescription(key);
  if (dynamicDescription) {
    return { text: `Dynamic: ${dynamicDescription}`, muted: true };
  }

  return { text: 'Not defined', muted: true };
}

/**
 * Resolves a single variable key against collection variables.
 *
 * @param key - Variable name from a {{key}} placeholder.
 * @param variables - Collection-scoped variables.
 * @returns Resolved value, or undefined when the key is not defined.
 */
export function resolveVariable(key: string, variables: Variable[]): string | undefined {
  return variableLookup(variables).get(key);
}

/**
 * Replaces {{key}} placeholders in text with collection variable values.
 *
 * Static collection/environment variables take precedence over dynamic variables.
 * Unknown tokens are left unchanged.
 *
 * @param text - Text containing variable placeholders.
 * @param variables - Collection-scoped variables.
 * @returns Text with known variables substituted; unknown tokens are left unchanged.
 */
export function substituteVariables(text: string, variables: Variable[]): string {
  const lookup = variableLookup(variables);
  return substituteWithResolver(text, (key) => lookup.get(key));
}

/**
 * Replaces {{key}} placeholders using a custom key resolver.
 *
 * @param text - Text containing variable placeholders.
 * @param resolveKey - Resolver for static/runtime variables; undefined leaves token unchanged.
 * @returns Text with known variables substituted and filters applied.
 */
export function substituteVariablesWithResolver(
  text: string,
  resolveKey: (key: string) => string | undefined
): string {
  return substituteWithResolver(text, resolveKey);
}

/**
 * Replaces {{key}} placeholders using a runtime variable map.
 *
 * @param text - Text containing variable placeholders.
 * @param runtimeVars - Current runtime variable values.
 * @returns Text with known variables substituted and filters applied.
 */
export function substituteVariablesFromMap(
  text: string,
  runtimeVars: Record<string, string>
): string {
  return substituteWithResolver(text, (key) => runtimeVars[key]);
}
