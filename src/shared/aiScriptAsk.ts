import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import type { ChatStepResult, ScriptAskContext } from '#/shared/types';

export type { ScriptAskContext };

/**
 * Parsed answer from the script `/ask` agent.
 */
export interface ScriptAskAnswer {
  /**
   * Short explanatory text inserted as `//` comment lines when no code is returned.
   */
  note?: string;

  /**
   * JavaScript source that replaces the `/ask` command line.
   */
  code?: string;
}

/**
 * OpenAI tool definition for the script `/ask` mini-agent response.
 */
export const SCRIPT_ASK_TOOL: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'answer_script',
    description:
      'Returns a short answer for an inline /ask request in a HarborClient request script editor.',
    parameters: {
      type: 'object',
      properties: {
        note: {
          type: 'string',
          description:
            'Optional short explanation inserted as // comment lines. Keep to a few lines.'
        },
        code: {
          type: 'string',
          description:
            'Optional JavaScript snippet that replaces the /ask command line in the script.'
        }
      },
      additionalProperties: false
    }
  }
};

/**
 * Builds a numbered view of script source for the mini-agent system prompt.
 *
 * @param code - Full script source.
 * @returns Lines prefixed with 1-based line numbers.
 */
function formatNumberedScript(code: string): string {
  const lines = code.split('\n');
  const width = String(Math.max(lines.length, 1)).length;
  return lines
    .map((line, index) => `${String(index + 1).padStart(width, ' ')}| ${line}`)
    .join('\n');
}

/**
 * Builds the system prompt for an inline script `/ask` request.
 *
 * @param context - Script source, slash-command line, and phase.
 * @returns System prompt instructing the model to call answer_script.
 */
export function buildScriptAskSystemPrompt(context: ScriptAskContext): string {
  const phaseLabel = context.phase === 'pre' ? 'pre-request' : 'post-request';
  return `You are an assistant embedded in HarborClient, a desktop HTTP API client.

The user is editing a ${phaseLabel} request script and typed /ask on line ${context.line}. Answer very briefly about that line or the next line of code when relevant.

Rules:
1. Always respond by calling the answer_script tool exactly once.
2. Keep answers short: at most a few comment lines or a small code snippet.
3. Use note for brief explanations (inserted as // comments). Use code when the user needs executable JavaScript; it replaces the /ask line.
4. Prefer code over note when the user asks for a snippet or example.
5. Use Harbor hc API in scripts, never Postman pm syntax.
6. Do not mention tools, prompts, or that you are an AI.
7. The /ask line will be replaced entirely. Do not repeat or include code from other lines in note or code.
8. When using code, output only the new JavaScript that replaces the /ask line — never a // comment in the code field.
9. When using note, keep it to a short explanation only; it becomes // comment lines.

Script with line numbers:
${formatNumberedScript(context.code)}`;
}

/**
 * Parses tool arguments JSON from an answer_script call.
 *
 * @param raw - Raw JSON arguments string from the model.
 * @returns Parsed note and/or code fields.
 */
function parseAnswerScriptArgs(raw: string): ScriptAskAnswer {
  if (!raw.trim()) {
    return {};
  }

  const parsed = JSON.parse(raw) as { note?: unknown; code?: unknown };
  const answer: ScriptAskAnswer = {};

  if (typeof parsed.note === 'string' && parsed.note.trim()) {
    answer.note = parsed.note.trim();
  }
  if (typeof parsed.code === 'string' && parsed.code.trim()) {
    answer.code = parsed.code.trim();
  }

  return answer;
}

/**
 * Reads an answer_script tool call from a chat step result.
 *
 * @param result - One LLM completion step result.
 * @returns Parsed answer, or null when no usable response is present.
 */
export function parseScriptAskResult(result: ChatStepResult): ScriptAskAnswer | null {
  const toolCall = result.toolCalls?.find((call) => call.name === 'answer_script');
  if (toolCall) {
    try {
      const answer = parseAnswerScriptArgs(toolCall.arguments);
      if (answer.note || answer.code) {
        return answer;
      }
    } catch {
      return null;
    }
  }

  const content = result.content?.trim();
  if (content) {
    return { note: content };
  }

  return null;
}

/**
 * Renders a short note as one or more // comment lines.
 *
 * @param note - Plain-text explanation from the model.
 * @returns Comment block suitable for insertion into a script.
 */
export function renderScriptAskNote(note: string): string {
  return note
    .split('\n')
    .map((line) => (line.trim() ? `// ${line.trim()}` : '//'))
    .join('\n');
}

/**
 * Suffix appended to an inline `/ask` line while the model is thinking.
 */
export const SCRIPT_ASK_THINKING_SUFFIX = ' Thinking...';

/** Matches a full script line containing a slash `/ask` command. */
const SCRIPT_ASK_LINE_PATTERN = /^(\s*)\/ask(?:[ \t]+(.*))?$/;

/**
 * Returns whether a script line contains a slash `/ask` command.
 *
 * @param line - Single line of script source (without trailing newline).
 */
export function isScriptAskLine(line: string): boolean {
  return SCRIPT_ASK_LINE_PATTERN.test(line);
}

/**
 * Removes the inline thinking suffix from a script line when present.
 *
 * @param line - Single line of script source.
 * @returns Line without {@link SCRIPT_ASK_THINKING_SUFFIX}.
 */
export function stripScriptAskThinking(line: string): string {
  if (line.endsWith(SCRIPT_ASK_THINKING_SUFFIX)) {
    return line.slice(0, -SCRIPT_ASK_THINKING_SUFFIX.length);
  }
  return line;
}

/**
 * Appends the thinking suffix to the target `/ask` line only.
 *
 * @param code - Current script source.
 * @param lineNumber - 1-based line number of the `/ask` command.
 * @returns Updated script source.
 */
export function appendScriptAskThinking(code: string, lineNumber: number): string {
  const lines = code.split('\n');
  const index = lineNumber - 1;
  if (index < 0 || index >= lines.length) {
    return code;
  }

  lines[index] = `${lines[index]}${SCRIPT_ASK_THINKING_SUFFIX}`;
  return lines.join('\n');
}

/**
 * Options for {@link applyScriptAskAtLine}.
 */
export interface ApplyScriptAskAtLineOptions {
  /**
   * When true, replaces the target line even when `/ask` is no longer present
   * (for example after a premature cleanup or user edit while the modal is open).
   */
  replaceMissingAskLine?: boolean;
}

/**
 * Applies an answer by replacing the entire `/ask` line identified by line number.
 *
 * @param code - Current script source.
 * @param lineNumber - 1-based line number of the `/ask` command.
 * @param answer - Parsed note and/or code from the model.
 * @param options - Optional apply behavior overrides.
 * @returns Updated script source; unchanged when the target line is not `/ask` unless
 *   {@link ApplyScriptAskAtLineOptions.replaceMissingAskLine} is set.
 */
export function applyScriptAskAtLine(
  code: string,
  lineNumber: number,
  answer: ScriptAskAnswer,
  options?: ApplyScriptAskAtLineOptions
): string {
  const lines = code.split('\n');
  const index = lineNumber - 1;
  if (index < 0 || index >= lines.length) {
    return code;
  }

  const line = stripScriptAskThinking(lines[index]);
  if (!isScriptAskLine(line) && !options?.replaceMissingAskLine) {
    return code;
  }

  const replacement =
    answer.code != null && answer.code.length > 0
      ? answer.code
      : answer.note
        ? renderScriptAskNote(answer.note)
        : '';

  lines[index] = replacement;
  return lines.join('\n');
}

/**
 * Removes the entire `/ask` line when the modal closes without an answer.
 *
 * @param code - Current script source.
 * @param lineNumber - 1-based line number of the `/ask` command.
 * @returns Script source with the command line removed.
 */
export function removeScriptAskLine(code: string, lineNumber: number): string {
  const lines = code.split('\n');
  const index = lineNumber - 1;
  if (index < 0 || index >= lines.length) {
    return code;
  }

  const line = stripScriptAskThinking(lines[index]);
  if (!isScriptAskLine(line)) {
    return code;
  }

  lines.splice(index, 1);
  return lines.join('\n');
}

/**
 * Applies an answer_script result by replacing the slash command span in the script.
 *
 * @param code - Current script source.
 * @param from - Start offset of the slash command span (inclusive).
 * @param to - End offset of the slash command span (exclusive).
 * @param answer - Parsed note and/or code from the model.
 * @returns Updated script source.
 */
export function applyScriptAsk(
  code: string,
  from: number,
  to: number,
  answer: ScriptAskAnswer
): string {
  const replacement =
    answer.code != null && answer.code.length > 0
      ? answer.code
      : answer.note
        ? renderScriptAskNote(answer.note)
        : '';

  return code.slice(0, from) + replacement + code.slice(to);
}

/**
 * Removes the slash command span from the script when the modal closes without an answer.
 *
 * @param code - Current script source.
 * @param from - Start offset of the slash command span (inclusive).
 * @param to - End offset of the slash command span (exclusive).
 * @returns Script source with the command removed and adjacent blank lines tidied.
 */
export function removeScriptAskCommand(code: string, from: number, to: number): string {
  let next = code.slice(0, from) + code.slice(to);

  if (from > 0 && next[from - 1] === '\n' && (next[from] === '\n' || next.length === from)) {
    next = next.slice(0, from - 1) + next.slice(from);
  }

  return next;
}
