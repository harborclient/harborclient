import type { CodeEditorLanguage } from '@harborclient/sdk/components';
import type { GitRequestDiffFileEntry } from '#/shared/types';

/**
 * Parsed before/after file contents derived from a HarborClient git diff excerpt.
 */
export interface ParsedGitDiffSides {
  /**
   * Text at HEAD (previous revision), without diff prefixes.
   */
  previous: string;

  /**
   * Text in the working tree or index (current revision), without diff prefixes.
   */
  current: string;
}

/**
 * Returns whether a line is a unified-diff file header (`---` / `+++`).
 *
 * @param line - Single line from a diff excerpt.
 */
function isDiffHeaderLine(line: string): boolean {
  return line.startsWith('--- ') || line.startsWith('+++ ');
}

/**
 * Strips the leading minus or plus marker from one modified-file diff line.
 *
 * @param line - Line from a modified-file before/after section.
 * @param marker - `-` for removed lines or `+` for added lines.
 */
function stripDiffLineMarker(line: string, marker: '-' | '+'): string {
  if (!line.startsWith(marker)) {
    return line;
  }
  return line.slice(1);
}

/**
 * Parses modified-file diff body lines into separate previous and current text.
 *
 * @param bodyLines - Lines after the `@@` hunk header in a modified diff.
 */
function parseModifiedDiffBody(bodyLines: string[]): ParsedGitDiffSides {
  const previousLines: string[] = [];
  const currentLines: string[] = [];

  for (const line of bodyLines) {
    if (line.startsWith('+')) {
      currentLines.push(stripDiffLineMarker(line, '+'));
      continue;
    }
    if (line.startsWith('-')) {
      previousLines.push(stripDiffLineMarker(line, '-'));
    }
  }

  return {
    previous: previousLines.join('\n'),
    current: currentLines.join('\n')
  };
}

/**
 * Returns file body lines after unified-diff headers (and optional hunk header).
 *
 * @param diffText - Full unified-style diff excerpt for one file.
 */
function splitDiffBody(diffText: string): string[] {
  const lines = diffText.split('\n');
  let bodyStart = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (line.startsWith('@@')) {
      bodyStart = index + 1;
      break;
    }
    if (!isDiffHeaderLine(line) && index >= 2) {
      bodyStart = index;
      break;
    }
  }

  if (bodyStart === 0 && lines.length >= 2) {
    const firstBodyLine = lines[2];
    if (
      firstBodyLine != null &&
      !isDiffHeaderLine(firstBodyLine) &&
      !firstBodyLine.startsWith('@@')
    ) {
      bodyStart = 2;
    }
  }

  return lines.slice(bodyStart);
}

/**
 * Converts one git diff file entry into explicit previous and current source text
 * for side-by-side display.
 *
 * @param file - Changed file entry from a git diff IPC payload.
 * @returns Parsed sides, or null when no textual diff is available.
 */
export function parseGitDiffFileSides(file: GitRequestDiffFileEntry): ParsedGitDiffSides | null {
  if (file.binary || file.diff == null || file.diff.trim().length === 0) {
    return null;
  }

  const bodyLines = splitDiffBody(file.diff);

  if (file.status === 'added') {
    return {
      previous: '',
      current: bodyLines.join('\n')
    };
  }

  if (file.status === 'deleted') {
    return {
      previous: bodyLines.join('\n'),
      current: ''
    };
  }

  return parseModifiedDiffBody(bodyLines);
}

/**
 * Maps a repository-relative file path to a CodeEditor syntax mode.
 *
 * @param path - Repository-relative path under the HarborClient tree.
 * @returns Supported CodeEditor language for syntax highlighting.
 */
export function inferGitDiffLanguage(path: string): CodeEditorLanguage {
  const normalized = path.toLowerCase();
  const extension = normalized.includes('.') ? normalized.slice(normalized.lastIndexOf('.')) : '';

  if (extension === '.json') {
    return 'json';
  }

  if (
    extension === '.js' ||
    extension === '.mjs' ||
    extension === '.cjs' ||
    extension === '.ts' ||
    extension === '.tsx'
  ) {
    return 'javascript';
  }

  if (extension === '.sh' || extension === '.bash') {
    return 'shell';
  }

  return 'text';
}
