import { javascriptLanguage } from '@codemirror/lang-javascript';

/**
 * Location details for the first JavaScript syntax error found in source text.
 */
export interface JavascriptSyntaxError {
  /** Zero-based character offset of the parser error. */
  from: number;
  /** One-based source line containing the parser error. */
  line: number;
  /** Trimmed source line that gives the agent useful recovery context. */
  excerpt: string;
}

/**
 * Finds the first Lezer JavaScript parser error without requiring an editor view.
 *
 * @param code - JavaScript source to parse.
 * @returns The first syntax error and its source context, or null for valid source.
 */
export function findJavascriptSyntaxError(code: string): JavascriptSyntaxError | null {
  let errorOffset: number | null = null;

  javascriptLanguage.parser
    .parse(code)
    .cursor()
    .iterate((node) => {
      if (errorOffset == null && node.type.isError) {
        errorOffset = node.from;
      }
    });

  if (errorOffset == null) {
    return null;
  }

  const lineStart = code.lastIndexOf('\n', Math.max(0, errorOffset - 1)) + 1;
  const nextLineBreak = code.indexOf('\n', errorOffset);
  const lineEnd = nextLineBreak === -1 ? code.length : nextLineBreak;
  const line = code.slice(0, lineStart).split('\n').length;

  return {
    from: errorOffset,
    line,
    excerpt: code.slice(lineStart, lineEnd).trim()
  };
}
