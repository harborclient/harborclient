/**
 * Marker used to locate assertion call sites on a failure line.
 */
const HC_EXPECT_PREFIX = 'hc.expect(';

/**
 * One `hc.expect(...)` span measured in 0-based offsets within a single line.
 */
interface ExpectSpan {
  /**
   * Start index of `hc.expect(` within the line.
   */
  start: number;

  /**
   * End index (exclusive) after the matching `)` and optional trailing `;`.
   */
  end: number;
}

/**
 * Finds the end of a parenthesized call starting at the opening `(` after `hc.expect`.
 *
 * @param lineText - Full text of the target line.
 * @param openParenIndex - Index of the opening `(` of `hc.expect(`.
 * @returns Exclusive end index of the call (including trailing `;` when present),
 *   or null when parentheses are unbalanced.
 */
function findExpectCallEnd(lineText: string, openParenIndex: number): number | null {
  let depth = 0;
  for (let i = openParenIndex; i < lineText.length; i++) {
    const ch = lineText[i];
    if (ch === '(') {
      depth += 1;
    } else if (ch === ')') {
      depth -= 1;
      if (depth === 0) {
        let end = i + 1;
        if (lineText[end] === ';') {
          end += 1;
        }
        return end;
      }
    }
  }
  return null;
}

/**
 * Collects balanced `hc.expect(...)` spans on a single line.
 *
 * @param lineText - Text of the mapped failure line.
 * @returns Spans in left-to-right order; incomplete calls are skipped.
 */
function findExpectSpansOnLine(lineText: string): ExpectSpan[] {
  const spans: ExpectSpan[] = [];
  let searchFrom = 0;

  while (searchFrom < lineText.length) {
    const start = lineText.indexOf(HC_EXPECT_PREFIX, searchFrom);
    if (start < 0) {
      break;
    }

    const openParenIndex = start + HC_EXPECT_PREFIX.length - 1;
    const end = findExpectCallEnd(lineText, openParenIndex);
    if (end == null) {
      searchFrom = start + HC_EXPECT_PREFIX.length;
      continue;
    }

    spans.push({ start, end });
    searchFrom = end;
  }

  return spans;
}

/**
 * Converts a 1-based failure line/column into a CodeMirror selection range.
 *
 * Prefers selecting the `hc.expect(...)` call on that line so the assertion is
 * visually obvious. When `column` is set and multiple expects exist, picks the
 * span that contains the column. Falls back to selecting the entire line when
 * no expect call is found. Never returns a collapsed (zero-width) caret.
 *
 * @param source - Editor document text (current script source).
 * @param line - 1-based line number to reveal.
 * @param column - Optional 1-based column used to disambiguate multiple expects.
 * @returns Anchor/head character offsets clamped to the document.
 */
export function lineColToSelection(
  source: string,
  line: number,
  column?: number
): { anchor: number; head: number } {
  const lines = source.split('\n');
  if (lines.length === 0) {
    return { anchor: 0, head: 0 };
  }

  const lineIndex = Math.max(0, Math.min(Math.floor(line) - 1, lines.length - 1));
  let offset = 0;
  for (let i = 0; i < lineIndex; i++) {
    offset += (lines[i]?.length ?? 0) + 1;
  }

  const lineText = lines[lineIndex] ?? '';
  if (lineText.length === 0) {
    return { anchor: offset, head: offset };
  }

  const spans = findExpectSpansOnLine(lineText);
  if (spans.length > 0) {
    let chosen = spans[0];
    if (column != null && Number.isFinite(column) && column >= 1) {
      const col0 = Math.floor(column) - 1;
      const containing = spans.find((span) => col0 >= span.start && col0 < span.end);
      if (containing) {
        chosen = containing;
      }
    }

    return {
      anchor: offset + chosen.start,
      head: offset + chosen.end
    };
  }

  return { anchor: offset, head: offset + lineText.length };
}
