import type { ChatPointerDefinition } from '../types.js';
import {
  AI_RESPONSE_SECTIONS,
  AI_SCRIPT_REFERENCE_UUID,
  type AiResponseSection
} from '../types.js';
import { parseSelectionSuffix, parseWebpageClickSuffix } from '../shared.js';
import { CONSOLE_POINTER_SEGMENT_PATTERN } from '../consolePointer.js';
import {
  PLUGIN_CHAT_POINTER_ID_PATTERN,
  PLUGIN_CHAT_POINTER_KEY_PATTERN,
  PLUGIN_CHAT_POINTER_POINTER_ID_PATTERN
} from '../pluginToken.js';
import { registerChatPointer, resetChatPointerRegistryForTests } from '../registry.js';

/**
 * Builtin chat-pointer definitions (match + parse + agent guidance).
 *
 * Validate/label/expand/snapshot remain dispatched from scriptReferences against
 * these registered kinds; match/parse drive token discovery.
 */
export const builtinChatPointerPartials: Array<
  Pick<ChatPointerDefinition, 'id' | 'match' | 'parse' | 'agentGuidance'> &
    Partial<
      Pick<
        ChatPointerDefinition,
        'validate' | 'resolveName' | 'resolveLabel' | 'expandContext' | 'collectSnapshot'
      >
    >
> = [
  /**
   * References a script row on the open request editor.
   *
   * @usage @<request-id>.<pre|post>.<script-index>#<start>.<end>
   * @param request-id `active` or the numeric open-request id
   * @param pre|post Script phase on the request
   * @param script-index 1-based index of the script row
   * @param start Optional character offset into the script source (selection start)
   * @param end Optional character offset into the script source (selection end)
   */
  {
    id: 'request-script',
    match: new RegExp(`^(active|\\d+)\\.(pre|post)\\.(\\d+)(?:#(\\d+)\\.(\\d+))?`),
    agentGuidance: `When a user message contains @<request-id>.<pre|post>.<script-index> (for example @42.pre.3 or @active.post.1), that references a script row on the open request editor — not a saved-request lookup. Never call get_request for these tokens; get_request is only for @request.<uuid>. When a system message already includes the script source, selected text, or last-run error for that @ mention, answer from that context first and do not claim the request or script is missing. To edit, call get_active_request first to read savedRequestId, then update_request_script using that numeric id (or "active" only when savedRequestId is null). Match phase and scriptIndex from the @ reference. When the reference includes #<start>.<end>, those are character offsets into that script's source identifying the region the user selected; focus edits and explanations on that range. replace_range is a literal splice: source.slice(0, startOffset) + code + source.slice(endOffset). Use it only when code is a drop-in, syntactically substitutable replacement for exactly the selected characters. Mentally concatenate the unchanged prefix, replacement, and unchanged suffix and confirm the result is valid JavaScript before calling. Never add an hc.test wrapper via replace_range when the selection is already inside an hc.test callback; do not nest hc.test. If the fix adds or removes a wrapper, changes a chain outside the selection, re-indents surrounding lines, or otherwise changes structure, use mode "replace" with the ENTIRE updated script including all unchanged lines. Never send only a fixed snippet with mode "replace". When the user asks you to apply a fix ("make the change", "fix it for me"), preserve all existing tests, comments, and unrelated statements. When a system message provides selected script text, treat that selection as the focus of the user's question, but choose replace_range only when it is syntactically substitutable. Use hc test API in post scripts, never Postman pm syntax. If update_request_script returns an error, do not claim the change was applied; correct the call and retry.`,
    parse: (match, fullToken, atIndex) => {
      const requestIdRaw = match[1];
      const phase = match[2];
      const scriptIndexRaw = match[3];
      if (requestIdRaw == null || phase == null || scriptIndexRaw == null) {
        return null;
      }
      if (phase !== 'pre' && phase !== 'post') {
        return null;
      }
      const scriptIndex = Number(scriptIndexRaw);
      if (!Number.isInteger(scriptIndex) || scriptIndex < 1) {
        return null;
      }
      const requestId =
        requestIdRaw === 'active'
          ? 'active'
          : Number.isFinite(Number(requestIdRaw))
            ? Number(requestIdRaw)
            : null;
      if (requestId == null) {
        return null;
      }
      return {
        kind: 'request-script',
        requestId,
        phase,
        scriptIndex,
        start: atIndex,
        end: atIndex + fullToken.length,
        text: fullToken,
        selection: parseSelectionSuffix(match[4], match[5])
      };
    }
  },
  /**
   * References a standalone library snippet (optionally a selected span).
   *
   * @usage @snippet.<uuid>#<start>.<end>
   * @param uuid The UUID of the snippet
   * @param start Optional character offset into the snippet source (selection start)
   * @param end Optional character offset into the snippet source (selection end)
   */
  {
    id: 'snippet',
    match: new RegExp(`^snippet\\.(${AI_SCRIPT_REFERENCE_UUID})(?:#(\\d+)\\.(\\d+))?`),
    agentGuidance: `When a user message contains @snippet.<uuid> (for example @snippet.550e8400-e29b-41d4-a716-446655440000), that references a standalone library snippet not linked to any request. Read the full snippet source and selection from the system message context. There is no tool to edit standalone snippets — propose replacement code in your reply for the user to paste back into the snippet editor.`,
    parse: (match, fullToken, atIndex) => {
      const snippetUuid = match[1];
      if (snippetUuid == null) {
        return null;
      }
      return {
        kind: 'snippet',
        snippetUuid,
        start: atIndex,
        end: atIndex + fullToken.length,
        text: fullToken,
        selection: parseSelectionSuffix(match[2], match[3])
      };
    }
  },
  /**
   * References footer terminal output (optionally a line range).
   *
   * @usage @term.<terminal-index>#<startLine>.<endLine>
   * @param terminal-index 1-based footer terminal index
   * @param startLine Optional 1-based start line of the selection
   * @param endLine Optional 1-based end line of the selection
   */
  {
    id: 'terminal',
    match: /^term\.(\d+)(?:#(\d+)\.(\d+))?/,
    agentGuidance: `When a user message contains @term.<terminal-index> (optionally with #startLine.endLine), that references footer terminal output. Prefer selected and surrounding text already included in the system context. For additional ranges, call get_active_terminal then get_active_terminal_lines. Terminal references cannot be edited via tools.`,
    parse: (match, fullToken, atIndex) => {
      const terminalIndex = Number(match[1]);
      if (!Number.isInteger(terminalIndex) || terminalIndex < 1) {
        return null;
      }
      return {
        kind: 'terminal',
        terminalIndex,
        start: atIndex,
        end: atIndex + fullToken.length,
        text: fullToken,
        selection: parseSelectionSuffix(match[2], match[3], true)
      };
    }
  },
  /**
   * References a saved collection.
   *
   * @usage @collection.<uuid>
   * @param uuid The UUID of the collection
   */
  {
    id: 'collection',
    match: new RegExp(`^collection\\.(${AI_SCRIPT_REFERENCE_UUID})`),
    agentGuidance: `When a user message contains @collection.<uuid>, call get_collection with that uuid before answering. In your reply, refer to the collection by its name, not its uuid.`,
    parse: (match, fullToken, atIndex) => {
      const collectionUuid = match[1];
      if (collectionUuid == null) {
        return null;
      }
      return {
        kind: 'collection',
        collectionUuid,
        start: atIndex,
        end: atIndex + fullToken.length,
        text: fullToken
      };
    }
  },
  /**
   * References a folder in a collection.
   *
   * @usage @folder.<uuid>
   * @param uuid The UUID of the folder
   */
  {
    id: 'folder',
    match: new RegExp(`^folder\\.(${AI_SCRIPT_REFERENCE_UUID})`),
    agentGuidance: `When a user message contains @folder.<uuid>, call get_folder with that uuid. In your reply, refer to folders by their name, not their uuid or database id.`,
    parse: (match, fullToken, atIndex) => {
      const folderUuid = match[1];
      if (folderUuid == null) {
        return null;
      }
      return {
        kind: 'folder',
        folderUuid,
        start: atIndex,
        end: atIndex + fullToken.length,
        text: fullToken
      };
    }
  },
  /**
   * References a saved request.
   *
   * @usage @request.<uuid>
   * @param uuid The UUID of the saved request
   */
  {
    id: 'request',
    match: new RegExp(`^request\\.(${AI_SCRIPT_REFERENCE_UUID})`),
    agentGuidance: `When a user message contains @request.<uuid>, call get_request with that uuid. In your reply, refer to saved requests by their name, not their uuid or database id.`,
    parse: (match, fullToken, atIndex) => {
      const requestUuid = match[1];
      if (requestUuid == null) {
        return null;
      }
      return {
        kind: 'request',
        requestUuid,
        start: atIndex,
        end: atIndex + fullToken.length,
        text: fullToken
      };
    }
  },
  /**
   * References an embedded HarborClient browser (webpage) tab.
   *
   * @usage @webpage.<tabId>#<x>.<y>
   * @param tabId The UUID of the webpage tab
   * @param x Optional viewport CSS pixel X of the user's click
   * @param y Optional viewport CSS pixel Y of the user's click
   */
  {
    id: 'webpage',
    match: new RegExp(`^webpage\\.(${AI_SCRIPT_REFERENCE_UUID})(?:#(\\d+)\\.(\\d+))?`),
    agentGuidance: `When a user message contains @webpage.<tabId> (optionally with #x.y viewport CSS pixel coordinates), that references an embedded HarborClient browser (webpage) tab. Prefer title/url already included in the system context. Call webpage_tab with no url (or inspect via the returned dom.tabId) and use webpage_query, webpage_evaluate, webpage_inject_script, webpage_inject_stylesheet, or webpage_screenshot with that exact tabId. When the user asks to screenshot or capture the page, call webpage_screenshot — do not suggest OS screenshot utilities. When the reference includes #x.y, immediately call webpage_evaluate with that tabId and an expression that uses document.elementFromPoint(x, y) to identify the element under the user's click — summarize tag name, id, className, relevant attributes, textContent, and outerHTML (capped if large) before answering. Then use other webpage_* tools as needed. In your reply, refer to the page by its title or URL, not the tab UUID.`,
    parse: (match, fullToken, atIndex) => {
      const tabId = match[1];
      if (tabId == null) {
        return null;
      }
      const click = parseWebpageClickSuffix(match[2], match[3]);
      return {
        kind: 'webpage',
        tabId,
        start: atIndex,
        end: atIndex + fullToken.length,
        text: fullToken,
        ...(click != null ? { click } : {})
      };
    }
  },
  /**
   * References a saved live server.
   *
   * @usage @live-server.<uuid>
   * @param uuid The UUID of the saved live server
   */
  {
    id: 'live-server',
    match: new RegExp(`^live-server\\.(${AI_SCRIPT_REFERENCE_UUID})`),
    agentGuidance: `When a user message contains @live-server.<uuid>, prefer any live-server context already included in the system message, then call get_live_server with that uuid and list_running_live_servers (and get_live_server_logs when diagnosing traffic) as needed. Only call start_live_server, stop_live_server, create_live_server, update_live_server, delete_live_server, or clear_live_server_logs when the user explicitly asks. In your reply, refer to the server by its display name, not its uuid.`,
    parse: (match, fullToken, atIndex) => {
      const liveServerUuid = match[1];
      if (liveServerUuid == null) {
        return null;
      }
      return {
        kind: 'live-server',
        liveServerUuid,
        start: atIndex,
        end: atIndex + fullToken.length,
        text: fullToken
      };
    }
  },
  /**
   * References live-server Express access logs (optionally a line range).
   *
   * @usage @logs.<uuid>#<startLine>.<endLine>
   * @param uuid The UUID of the saved live server
   * @param startLine Optional 1-based start line of the selection
   * @param endLine Optional 1-based end line of the selection
   */
  {
    id: 'logs',
    match: new RegExp(`^logs\\.(${AI_SCRIPT_REFERENCE_UUID})(?:#(\\d+)\\.(\\d+))?`),
    agentGuidance: `When a user message contains @logs.<uuid> (optionally with #startLine.endLine), prefer selected and surrounding access-log text already included in the system context. Call get_live_server with that uuid and get_live_server_logs (savedId from get_live_server) when you need more lines. Only call clear_live_server_logs when the user explicitly asks. In your reply, refer to the server by its display name, not its uuid.`,
    parse: (match, fullToken, atIndex) => {
      const liveServerUuid = match[1];
      if (liveServerUuid == null) {
        return null;
      }
      return {
        kind: 'logs',
        liveServerUuid,
        start: atIndex,
        end: atIndex + fullToken.length,
        text: fullToken,
        selection: parseSelectionSuffix(match[2], match[3], true)
      };
    }
  },
  /**
   * References a markdown document or request comment (optionally a selected span).
   *
   * @usage @markdown.<uuid>#<start>.<end>
   * @param uuid The UUID of the markdown document
   * @param start Optional character offset into the markdown source (selection start)
   * @param end Optional character offset into the markdown source (selection end)
   */
  {
    id: 'markdown',
    match: new RegExp(`^markdown\\.(${AI_SCRIPT_REFERENCE_UUID})(?:#(\\d+)\\.(\\d+))?`),
    agentGuidance: `When a user message contains @markdown.<uuid> (optionally with #start.end character offsets), call get_markdown_document with that uuid to read the full markdown document or request comment source. Markdown references cannot be edited via tools — propose replacement markdown in your reply for the user to paste back into the editor.`,
    parse: (match, fullToken, atIndex) => {
      const markdownUuid = match[1];
      if (markdownUuid == null) {
        return null;
      }
      return {
        kind: 'markdown',
        markdownUuid,
        start: atIndex,
        end: atIndex + fullToken.length,
        text: fullToken,
        selection: parseSelectionSuffix(match[2], match[3])
      };
    }
  },
  /**
   * References a captured HTTP response section (optionally a body selection).
   *
   * @usage @res.<request-tab-uuid>.<section>#<start>.<end>
   * @param request-tab-uuid The UUID of the request tab that owns the response
   * @param section One of `body`, `headers`, `timing`, `console`, or `tests`
   * @param start Optional character offset into the pretty-printed body viewer text
   * @param end Optional character offset into the pretty-printed body viewer text
   */
  {
    id: 'response-section',
    match: new RegExp(
      `^res\\.(${AI_SCRIPT_REFERENCE_UUID})\\.(body|headers|timing|console|tests)(?:#(\\d+)\\.(\\d+))?`
    ),
    agentGuidance: `When a user message contains @res.<request-tab-uuid>.<body|headers|timing|console|tests> (optionally with #start.end character offsets on body selections), that references a captured HTTP response section. Prefer the section content and any selected body text already included in the system context. For @res…body#start.end, offsets are into the pretty-printed body viewer text. Call get_active_request and get_active_request_details for the full request; call get_active_response_summary, get_active_response, or query_response_body when you need more of the live response or non-binary body than the snapshot provides. Response-section references cannot be edited via tools.`,
    parse: (match, fullToken, atIndex) => {
      const responseTabId = match[1];
      const responseSectionRaw = match[2];
      if (responseTabId == null || responseSectionRaw == null) {
        return null;
      }
      if (!(AI_RESPONSE_SECTIONS as readonly string[]).includes(responseSectionRaw)) {
        return null;
      }
      return {
        kind: 'response-section',
        requestTabId: responseTabId,
        section: responseSectionRaw as AiResponseSection,
        start: atIndex,
        end: atIndex + fullToken.length,
        text: fullToken,
        selection: parseSelectionSuffix(match[3], match[4])
      };
    }
  },
  /**
   * References a selection from a response Console, Headers, or Timing inspector row.
   *
   * @usage @console.<section>.<row>#<start>.<end>
   * @param section Inspector section (`general`, `headers`, `timing`, …)
   * @param row Slugified row label (`error`, `report-to`, `request-sent`, …)
   * @param start Character offset into the selected cell text
   * @param end Character offset into the selected cell text
   */
  {
    id: 'console',
    match: new RegExp(
      `^console\\.(${CONSOLE_POINTER_SEGMENT_PATTERN})\\.(${CONSOLE_POINTER_SEGMENT_PATTERN})(?:#(\\d+)\\.(\\d+))?`
    ),
    agentGuidance: `When a user message contains @console.<section>.<row> (optionally with #start.end character offsets into the selected cell text), that references a captured Console, Headers, or Timing inspector value. Prefer the selected text and row snapshot in the system context. Call get_active_response_console for the live inspector (general, headers, timing). Use get_active_response_summary / get_active_response for body/tests, and get_script_run_diagnostics for script logs/output. Console-row references cannot be edited via tools.`,
    parse: (match, fullToken, atIndex) => {
      const section = match[1];
      const row = match[2];
      if (section == null || row == null) {
        return null;
      }
      return {
        kind: 'console',
        section,
        row,
        start: atIndex,
        end: atIndex + fullToken.length,
        text: fullToken,
        selection: parseSelectionSuffix(match[3], match[4])
      };
    }
  },
  /**
   * References a selection from the active request raw body editor.
   *
   * @usage @body#<start>.<end>
   * @param start Optional character offset into the raw body (selection start)
   * @param end Optional character offset into the raw body (selection end)
   */
  {
    id: 'body',
    match: /^body(?:#(\d+)\.(\d+))?/,
    agentGuidance: `When a user message contains @body (optionally with #start.end), that references a selection from the active request raw body editor. Prefer selected text in the system context. Call get_active_request_details for the full body; use update_active_request with body_raw to edit it.`,
    parse: (match, fullToken, atIndex) => ({
      kind: 'body',
      start: atIndex,
      end: atIndex + fullToken.length,
      text: fullToken,
      selection: parseSelectionSuffix(match[1], match[2])
    })
  },
  /**
   * References plugin-provided context (optionally a selected span).
   *
   * @usage @plugin.<pluginId>.<pointerId>.<key>#<start>.<end>
   * @param pluginId The plugin id that owns the pointer
   * @param pointerId The pointer definition id within the plugin
   * @param key The instance key for the captured context
   * @param start Optional character offset into the captured context text
   * @param end Optional character offset into the captured context text
   */
  {
    id: 'plugin',
    match: new RegExp(
      `^plugin\\.(${PLUGIN_CHAT_POINTER_ID_PATTERN})\\.(${PLUGIN_CHAT_POINTER_POINTER_ID_PATTERN})\\.(${PLUGIN_CHAT_POINTER_KEY_PATTERN})(?:#(\\d+)\\.(\\d+))?`
    ),
    agentGuidance: `When a user message contains @plugin.<pluginId>.<pointerId>.<key> (optionally with #start.end), that references plugin-provided context. Prefer the captured context text in the system message. Do not invent plugin data beyond that snapshot unless a matching mcp__ tool or HarborClient tool clearly applies.`,
    parse: (match, fullToken, atIndex) => {
      const pluginId = match[1];
      const pointerId = match[2];
      const key = match[3];
      if (pluginId == null || pointerId == null || key == null) {
        return null;
      }
      return {
        kind: 'plugin',
        pluginId,
        pointerId,
        key,
        start: atIndex,
        end: atIndex + fullToken.length,
        text: fullToken,
        selection: parseSelectionSuffix(match[4], match[5])
      };
    }
  }
];

/**
 * Placeholder validate used until handlers are bound from scriptReferences.
 *
 * @returns Always false — replaced by {@link bindBuiltinChatPointerHandlers}.
 */
function unboundValidate(): boolean {
  return false;
}

/**
 * Placeholder name resolver until handlers are bound.
 *
 * @returns Always null.
 */
function unboundName(): null {
  return null;
}

/**
 * Registers all builtin chat pointers. Safe to call once; subsequent calls no-op when ids exist.
 */
export function registerBuiltinChatPointers(): void {
  for (const partial of builtinChatPointerPartials) {
    try {
      registerChatPointer({
        id: partial.id,
        match: partial.match,
        parse: partial.parse,
        agentGuidance: partial.agentGuidance,
        validate: partial.validate ?? (() => unboundValidate()),
        resolveName: partial.resolveName ?? (() => unboundName()),
        resolveLabel: partial.resolveLabel ?? (() => unboundName())
      });
    } catch {
      // Already registered (hot reload / double import).
    }
  }
}

/**
 * Clears and re-registers builtins (unit tests).
 */
export function reinstallBuiltinChatPointersForTests(): void {
  resetChatPointerRegistryForTests();
  for (const partial of builtinChatPointerPartials) {
    registerChatPointer({
      id: partial.id,
      match: partial.match,
      parse: partial.parse,
      agentGuidance: partial.agentGuidance,
      validate: partial.validate ?? (() => unboundValidate()),
      resolveName: partial.resolveName ?? (() => unboundName()),
      resolveLabel: partial.resolveLabel ?? (() => unboundName())
    });
  }
}

/**
 * Binds validate/name/label/expand/snapshot handlers onto already-registered builtins.
 *
 * @param handlers - Shared implementations from scriptReferences.
 */
export function bindBuiltinChatPointerHandlers(handlers: {
  validate: ChatPointerDefinition['validate'];
  resolveName: ChatPointerDefinition['resolveName'];
  resolveLabel: ChatPointerDefinition['resolveLabel'];
  expandContext: NonNullable<ChatPointerDefinition['expandContext']>;
  collectSnapshot: NonNullable<ChatPointerDefinition['collectSnapshot']>;
}): void {
  resetChatPointerRegistryForTests();
  for (const partial of builtinChatPointerPartials) {
    registerChatPointer({
      id: partial.id,
      match: partial.match,
      parse: partial.parse,
      agentGuidance: partial.agentGuidance,
      validate: handlers.validate,
      resolveName: handlers.resolveName,
      resolveLabel: handlers.resolveLabel,
      expandContext: handlers.expandContext,
      collectSnapshot: handlers.collectSnapshot
    });
  }
}
