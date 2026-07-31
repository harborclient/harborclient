import type { ScriptRef, Snippet } from '../../types.js';

/**
 * UUID fragment used in `@` chat-pointer token regexes.
 */
export const AI_SCRIPT_REFERENCE_UUID =
  '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';

/**
 * Response-viewer section ids that can be referenced with `@res.<tab-uuid>.<section>`.
 */
export const AI_RESPONSE_SECTIONS = ['body', 'headers', 'timing', 'console', 'tests'] as const;

/**
 * One response-viewer section that can be copied to chat.
 */
export type AiResponseSection = (typeof AI_RESPONSE_SECTIONS)[number];

/**
 * Badge labels for `@res` response-section references.
 */
export const AI_RESPONSE_SECTION_LABELS: Record<AiResponseSection, string> = {
  body: 'Response body',
  headers: 'Response headers',
  timing: 'Response timing',
  console: 'Response console',
  tests: 'Response tests'
};

/**
 * Shared fields for every parsed `@` script reference.
 */
export interface ParsedAiScriptReferenceBase {
  /**
   * Start offset of the full `@` token in the source text.
   */
  start: number;

  /**
   * End offset (exclusive) of the full `@` token in the source text.
   */
  end: number;

  /**
   * Exact matched substring, including the leading `@`.
   */
  text: string;

  /**
   * Character offsets into the referenced script source when the user selected a range.
   */
  selection?: {
    /**
     * Start offset (inclusive) in the script source.
     */
    start: number;

    /**
     * End offset (exclusive) in the script source.
     */
    end: number;
  };
}

/**
 * A parsed `@` reference to a request script row.
 */
export interface ParsedRequestScriptReference extends ParsedAiScriptReferenceBase {
  /**
   * Discriminator for request-script references.
   */
  kind: 'request-script';

  /**
   * Saved request id from the reference, or the literal `active`.
   */
  requestId: number | 'active';

  /**
   * Script phase: pre-request or post-request.
   */
  phase: 'pre' | 'post';

  /**
   * 1-based index of the script in the phase array.
   */
  scriptIndex: number;
}

/**
 * A parsed `@` reference to a standalone library snippet.
 */
export interface ParsedSnippetReference extends ParsedAiScriptReferenceBase {
  /**
   * Discriminator for standalone snippet references.
   */
  kind: 'snippet';

  /**
   * UUID of the snippet in the library.
   */
  snippetUuid: string;
}

/**
 * A parsed `@` reference to a footer terminal selection.
 */
export interface ParsedTerminalReference extends ParsedAiScriptReferenceBase {
  /**
   * Discriminator for footer terminal references.
   */
  kind: 'terminal';

  /**
   * 1-based index of the terminal tab in the footer switcher.
   */
  terminalIndex: number;
}

/**
 * A parsed `@` reference to a collection in the sidebar.
 */
export interface ParsedCollectionReference extends ParsedAiScriptReferenceBase {
  /**
   * Discriminator for collection references.
   */
  kind: 'collection';

  /**
   * UUID of the collection.
   */
  collectionUuid: string;
}

/**
 * A parsed `@` reference to a folder in the sidebar.
 */
export interface ParsedFolderReference extends ParsedAiScriptReferenceBase {
  /**
   * Discriminator for folder references.
   */
  kind: 'folder';

  /**
   * UUID of the folder.
   */
  folderUuid: string;
}

/**
 * A parsed `@` reference to a saved request in the sidebar.
 */
export interface ParsedRequestReference extends ParsedAiScriptReferenceBase {
  /**
   * Discriminator for saved-request references.
   */
  kind: 'request';

  /**
   * UUID of the saved request.
   */
  requestUuid: string;
}

/**
 * A parsed `@` reference to an embedded browser (webpage) tab.
 */
export interface ParsedWebpageReference extends ParsedAiScriptReferenceBase {
  /**
   * Discriminator for browser webpage-tab references.
   */
  kind: 'webpage';

  /**
   * Browser tab id (UUID) passed to webpage_* tools.
   */
  tabId: string;

  /**
   * Viewport CSS pixel click point from `@webpage.<tabId>#x.y` (for `document.elementFromPoint`).
   *
   * Distinct from {@link ParsedAiScriptReferenceBase.selection}, which is a character/line range.
   */
  click?: {
    /**
     * Horizontal viewport coordinate in CSS pixels.
     */
    x: number;

    /**
     * Vertical viewport coordinate in CSS pixels.
     */
    y: number;
  };
}

/**
 * Live browser tab summary used to validate and label `@webpage.<tabId>` references.
 */
export interface WebpageTabReferenceInfo {
  /**
   * Document title shown in the tab bar.
   */
  title: string;

  /**
   * Current page URL.
   */
  url: string;
}

/**
 * A parsed `@` reference to a saved live server.
 */
export interface ParsedLiveServerReference extends ParsedAiScriptReferenceBase {
  /**
   * Discriminator for live-server references.
   */
  kind: 'live-server';

  /**
   * Saved live server uuid from the `@live-server` token.
   */
  liveServerUuid: string;
}

/**
 * A parsed `@` reference to live-server Express access logs.
 */
export interface ParsedLogsReference extends ParsedAiScriptReferenceBase {
  /**
   * Discriminator for live-server access-log references.
   */
  kind: 'logs';

  /**
   * Saved live server uuid from the `@logs` token.
   */
  liveServerUuid: string;
}

/**
 * Saved (and optionally running) live server summary for `@live-server.<uuid>` badges and context.
 */
export interface LiveServerReferenceInfo {
  /**
   * Database primary key.
   */
  id: number;

  /**
   * Display name shown in the sidebar.
   */
  name: string;

  /**
   * Absolute document root path.
   */
  root: string;

  /**
   * Configured listen port, or null when auto-selected at start.
   */
  port: number | null;

  /**
   * Whether file watching is enabled when started.
   */
  watch: boolean;

  /**
   * Runtime instance id when this saved server is currently running.
   */
  runtimeId?: string;

  /**
   * Assigned origin when running (for example `http://127.0.0.1:5500`).
   */
  origin?: string;

  /**
   * Assigned listen port when running.
   */
  runningPort?: number;
}

/**
 * A parsed `@` reference to a collection markdown document or request comment.
 */
export interface ParsedMarkdownReference extends ParsedAiScriptReferenceBase {
  /**
   * Discriminator for markdown document and comment references.
   */
  kind: 'markdown';

  /**
   * UUID of the collection document or saved request.
   */
  markdownUuid: string;
}

/**
 * A parsed `@` reference to the active request's raw body editor.
 */
export interface ParsedRequestBodyReference extends ParsedAiScriptReferenceBase {
  /**
   * Discriminator for raw-body selection references.
   */
  kind: 'body';
}

/**
 * A parsed `@` reference to a console / headers / timing inspector row selection.
 */
export interface ParsedConsoleReference extends ParsedAiScriptReferenceBase {
  /**
   * Discriminator for console-row chat pointers.
   */
  kind: 'console';

  /**
   * Section id (for example `general`, `headers`, or `timing`).
   */
  section: string;

  /**
   * Slugified row id within the section.
   */
  row: string;
}

/**
 * Snapshot of a console/header/timing cell captured when the user copies a selection to chat.
 */
export interface ConsoleRowSnapshot {
  /**
   * Display label for the badge (for example `Console · Error`).
   */
  label: string;

  /**
   * Section id at capture time.
   */
  section: string;

  /**
   * Slugified row id at capture time.
   */
  row: string;

  /**
   * Human-readable row label (for example `Error` or `Request sent`).
   */
  rowLabel: string;

  /**
   * Full text of the selected cell at capture time.
   */
  fieldText: string;

  /**
   * Plain-text content of the user's selection.
   */
  selectedText: string;

  /**
   * Inclusive character offset into {@link fieldText}.
   */
  startOffset: number;

  /**
   * Exclusive character offset into {@link fieldText}.
   */
  endOffset: number;

  /**
   * Request name at capture time when available.
   */
  requestName?: string;

  /**
   * HTTP status code when available.
   */
  status?: number;

  /**
   * HTTP status text when available.
   */
  statusText?: string;

  /**
   * Transport error message when the send failed.
   */
  error?: string;
}

/**
 * A parsed `@` reference to a response-viewer section for a request tab.
 */
export interface ParsedResponseSectionReference extends ParsedAiScriptReferenceBase {
  /**
   * Discriminator for response-section references.
   */
  kind: 'response-section';

  /**
   * UUID of the request tab that owns the response.
   */
  requestTabId: string;

  /**
   * Which response viewer section was referenced.
   */
  section: AiResponseSection;
}

/**
 * Snapshot of a response-viewer section captured when the user copies it to chat.
 *
 * Stored so send-time context expansion does not depend on the response still being
 * present on the request tab.
 */
export interface ResponseSectionSnapshot {
  /**
   * Display label for the badge (for example "Response body").
   */
  label: string;

  /**
   * Request name at capture time.
   */
  requestName: string;

  /**
   * Which response section was captured.
   */
  section: AiResponseSection;

  /**
   * HTTP status code when available.
   */
  status?: number;

  /**
   * HTTP status text when available.
   */
  statusText?: string;

  /**
   * Plain-text (or JSON-ish) content of the section for agent context.
   */
  content: string;

  /**
   * Whether {@link content} was shortened for the LLM payload.
   */
  truncated?: boolean;

  /**
   * Original content length before truncation, when truncated.
   */
  originalLength?: number;

  /**
   * Selected substring when the user copied a body range via `#start.end`.
   */
  selectedText?: string;

  /**
   * Inclusive character offset into the pretty-printed body viewer text.
   */
  startOffset?: number;

  /**
   * Exclusive character offset into the pretty-printed body viewer text.
   */
  endOffset?: number;

  /**
   * 1-based start line of the selection in the pretty-printed body viewer text.
   */
  startLine?: number;

  /**
   * 1-based end line of the selection in the pretty-printed body viewer text.
   */
  endLine?: number;
}

/**
 * Snapshot of terminal output captured when the user copies a selection to chat.
 */
export interface TerminalSelectionSnapshot {
  /**
   * Display label of the terminal tab at capture time.
   */
  terminalLabel: string;

  /**
   * 1-based start line of the selection in the xterm buffer.
   */
  startLine: number;

  /**
   * 1-based end line of the selection in the xterm buffer.
   */
  endLine: number;

  /**
   * Plain-text content of the user's selection.
   */
  selectedText: string;

  /**
   * Surrounding terminal lines included for agent context.
   */
  contextText: string;
}

/**
 * Snapshot of live-server access-log lines captured when the user copies a selection to chat.
 */
export interface LogsSelectionSnapshot {
  /**
   * Display label of the live server at capture time (for example `Logs: Docs`).
   */
  label: string;

  /**
   * 1-based start line of the selection in the log buffer.
   */
  startLine: number;

  /**
   * 1-based end line of the selection in the log buffer.
   */
  endLine: number;

  /**
   * Plain-text content of the user's selection.
   */
  selectedText: string;

  /**
   * Surrounding log lines included for agent context.
   */
  contextText: string;
}

/**
 * Snapshot of markdown text captured when the user copies a selection to chat.
 */
export interface MarkdownSelectionSnapshot {
  /**
   * Display label at capture time (for example "Document: README.md").
   */
  label: string;

  /**
   * Plain-text content of the user's selection.
   */
  selectedText: string;

  /**
   * Best-effort start offset in the markdown source.
   */
  startOffset: number;

  /**
   * Best-effort end offset in the markdown source.
   */
  endOffset: number;

  /**
   * 1-based start line of the selection in the markdown source.
   */
  startLine: number;

  /**
   * 1-based end line of the selection in the markdown source.
   */
  endLine: number;
}

/**
 * Snapshot of raw request body text captured when the user copies a selection to chat.
 */
export interface RequestBodySelectionSnapshot {
  /**
   * Display label at capture time (for example "Raw multipart body").
   */
  label: string;

  /**
   * Plain-text content of the user's selection.
   */
  selectedText: string;

  /**
   * Start offset in the raw body editor text.
   */
  startOffset: number;

  /**
   * End offset in the raw body editor text.
   */
  endOffset: number;

  /**
   * 1-based start line of the selection in the raw body text.
   */
  startLine: number;

  /**
   * 1-based end line of the selection in the raw body text.
   */
  endLine: number;
}

/**
 * Snapshot of request-script source captured when the user copies a selection to chat.
 *
 * Stored so send-time context expansion does not depend on the active request tab still
 * matching the `@` reference (for example after the user switches tabs).
 */
export interface ScriptSelectionSnapshot {
  /**
   * Display name of the script row at capture time.
   */
  scriptLabel: string;

  /**
   * Script phase at capture time.
   */
  phase: 'pre' | 'post';

  /**
   * 1-based script index within the phase array at capture time.
   */
  scriptIndex: number;

  /**
   * Saved request id or `active` at capture time.
   */
  requestId: number | 'active';

  /**
   * Full script source text at capture time.
   */
  source: string;

  /**
   * Plain-text content of the user's selection.
   */
  selectedText: string;

  /**
   * Start offset in the script source.
   */
  startOffset: number;

  /**
   * End offset in the script source.
   */
  endOffset: number;

  /**
   * 1-based start line of the selection in the script source.
   */
  startLine: number;

  /**
   * 1-based end line of the selection in the script source.
   */
  endLine: number;

  /**
   * Last-run failure for this script slot when Copy to chat captured one.
   *
   * Populated from the newest matching console/test diagnostics so the agent
   * can see the actual error without a separate tool round-trip.
   */
  lastRunFailure?: ScriptSelectionLastRunFailure;
}

/**
 * Snapshot of plugin chat-pointer context captured when the plugin copies to chat.
 *
 * Stored so send-time expansion does not require the plugin sandbox to stay mounted.
 */
export interface PluginChatPointerSnapshot {
  /**
   * Owning plugin id.
   */
  pluginId: string;

  /**
   * Pointer id segment registered by the plugin.
   */
  pointerId: string;

  /**
   * Display label for the composer / message badge.
   */
  label: string;

  /**
   * Text inlined into the send-time ephemeral system message.
   */
  context: string;

  /**
   * Optional character offsets when the plugin copied a selection range.
   */
  selection?: {
    /**
     * Inclusive start offset.
     */
    start: number;

    /**
     * Exclusive end offset.
     */
    end: number;
  };
}

/**
 * One persisted `@` reference snapshot entry keyed by its full token string.
 *
 * Stored on chat messages so badge rendering can rehydrate after restart without
 * depending on ephemeral Redux selection slices.
 */
export type PersistedChatReferenceSnapshotEntry =
  | { kind: 'response-section'; snapshot: ResponseSectionSnapshot }
  | { kind: 'script-selection'; snapshot: ScriptSelectionSnapshot }
  | { kind: 'terminal'; snapshot: TerminalSelectionSnapshot }
  | { kind: 'logs'; snapshot: LogsSelectionSnapshot }
  | { kind: 'markdown'; snapshot: MarkdownSelectionSnapshot }
  | { kind: 'body'; snapshot: RequestBodySelectionSnapshot }
  | { kind: 'console'; snapshot: ConsoleRowSnapshot }
  | { kind: 'plugin'; snapshot: PluginChatPointerSnapshot };

/**
 * Snapshot map keyed by full `@` reference token (for example `@res.<uuid>.body`).
 */
export type PersistedChatReferenceSnapshots = Record<string, PersistedChatReferenceSnapshotEntry>;

/**
 * Last-run script failure attached to a Copy-to-chat script selection snapshot.
 */
export interface ScriptSelectionLastRunFailure {
  /**
   * Whether the failure came from a script abort or a failed hc.test row.
   */
  kind: 'script-error' | 'test-failure';

  /**
   * Primary error / assertion message shown to the user.
   */
  message: string;

  /**
   * Failed hc.test name when kind is test-failure.
   */
  testName?: string;

  /**
   * Chai expected value when present.
   */
  expected?: string;

  /**
   * Chai actual value when present.
   */
  actual?: string;

  /**
   * Mapped original file from the compile sourcemap.
   */
  source?: string;

  /**
   * 1-based mapped line of the failure.
   */
  line?: number;

  /**
   * 1-based mapped column of the failure.
   */
  column?: number;
}

/**
 * A parsed `@` reference contributed by a plugin chat pointer.
 */
export interface ParsedPluginReference extends ParsedAiScriptReferenceBase {
  /**
   * Discriminator for plugin chat pointers.
   */
  kind: 'plugin';

  /**
   * Owning plugin id.
   */
  pluginId: string;

  /**
   * Pointer id segment registered by the plugin.
   */
  pointerId: string;

  /**
   * Opaque key segment after the pointer id.
   */
  key: string;
}

/**
 * A parsed `@` script reference with character offsets in the source text.
 */
export type ParsedAiScriptReference =
  | ParsedRequestScriptReference
  | ParsedSnippetReference
  | ParsedTerminalReference
  | ParsedCollectionReference
  | ParsedFolderReference
  | ParsedRequestReference
  | ParsedWebpageReference
  | ParsedLiveServerReference
  | ParsedLogsReference
  | ParsedMarkdownReference
  | ParsedRequestBodyReference
  | ParsedConsoleReference
  | ParsedResponseSectionReference
  | ParsedPluginReference;

/**
 * Active request tab state used to decide whether an `@` reference is highlightable.
 */
export interface AiScriptReferenceValidationContext {
  /**
   * Whether the active tab hosts a request editor draft.
   */
  hasActiveRequestTab: boolean;

  /**
   * Saved request id on the active draft, when the tab is saved.
   */
  activeRequestId?: number;

  /**
   * Number of pre-request scripts on the active draft.
   */
  preScriptCount: number;

  /**
   * Number of post-request scripts on the active draft.
   */
  postScriptCount: number;

  /**
   * Pre-request script rows on the active draft, when available for name resolution.
   */
  preScripts?: ScriptRef[];

  /**
   * Post-request script rows on the active draft, when available for name resolution.
   */
  postScripts?: ScriptRef[];

  /**
   * Snippet library used to resolve snippet-linked script names.
   */
  snippets?: Snippet[];

  /**
   * Terminal selection snapshots keyed by the full `@term` reference token.
   */
  terminalSelections?: Record<string, TerminalSelectionSnapshot>;

  /**
   * Live-server access-log selection snapshots keyed by the full `@logs` reference token.
   */
  logsSelections?: Record<string, LogsSelectionSnapshot>;

  /**
   * Markdown selection snapshots keyed by the full `@markdown` reference token.
   */
  markdownSelections?: Record<string, MarkdownSelectionSnapshot>;

  /**
   * Raw-body selection snapshots keyed by the full `@body` reference token.
   */
  requestBodySelections?: Record<string, RequestBodySelectionSnapshot>;

  /**
   * Console/header/timing row selection snapshots keyed by the full `@console` token.
   */
  consoleSelections?: Record<string, ConsoleRowSnapshot>;

  /**
   * Response-section snapshots keyed by the full `@res` reference token.
   */
  responseSelections?: Record<string, ResponseSectionSnapshot>;

  /**
   * Request-script selection snapshots keyed by the full `@` script reference token.
   */
  scriptSelections?: Record<string, ScriptSelectionSnapshot>;

  /**
   * Collection display names keyed by uuid for `@collection` badge resolution.
   */
  collectionNamesByUuid?: Record<string, string>;

  /**
   * Folder display names keyed by uuid for `@folder` badge resolution.
   */
  folderNamesByUuid?: Record<string, string>;

  /**
   * Saved request display names keyed by uuid for `@request` badge resolution.
   */
  requestNamesByUuid?: Record<string, string>;

  /**
   * Open browser tabs keyed by tab id for `@webpage` badge and context resolution.
   */
  webpageTabsById?: Record<string, WebpageTabReferenceInfo>;

  /**
   * Saved live servers keyed by uuid for `@live-server` badge and context resolution.
   */
  liveServersByUuid?: Record<string, LiveServerReferenceInfo>;

  /**
   * Plugin chat-pointer snapshots keyed by the full `@plugin...` reference token.
   */
  pluginSelections?: Record<string, PluginChatPointerSnapshot>;
}

/**
 * One render segment for the chat composer backdrop.
 */
export interface ChatComposerTextToken {
  /**
   * Substring from the composer draft.
   */
  text: string;

  /**
   * When true, the segment is a valid `@` script reference and should be highlighted.
   */
  highlight: boolean;

  /**
   * Parsed reference metadata when {@link highlight} is true.
   */
  reference?: ParsedAiScriptReference;
}

/**
 * Alias for parsed chat pointers (built-in and plugin).
 */
export type ParsedChatPointer = ParsedAiScriptReference;

/**
 * Optional header/footer hints aggregated into the send-time context message.
 */
export interface ChatPointerContextMessageHints {
  /**
   * Header when the user message includes a selection-backed reference of this kind.
   */
  selectionHeader?: string;

  /**
   * Header when the user message includes a whole (non-selection) reference of this kind.
   */
  wholeHeader?: string;

  /**
   * Footer focused on selection-backed references of this kind.
   */
  selectionFooter?: string;

  /**
   * Footer always appended when any reference of this kind is present.
   */
  alwaysFooter?: string;
}

/**
 * Registry contract for one `@` chat-pointer kind.
 */
export interface ChatPointerDefinition {
  /**
   * Stable id matching {@link ParsedAiScriptReference} `kind` for builtins (`plugin` for plugins).
   */
  id: string;

  /**
   * Matches the token body AFTER the leading `@` (no leading `@`). Non-global RegExp.
   */
  match: RegExp;

  /**
   * Parses a successful {@link match} into a structured reference.
   *
   * @param match - RegExp match against the token body (no leading `@`).
   * @param fullToken - Full matched token including leading `@` and optional `#` suffix.
   * @param atIndex - Document start offset of the `@`.
   */
  parse: (
    match: RegExpMatchArray,
    fullToken: string,
    atIndex: number
  ) => ParsedAiScriptReference | null;

  /**
   * Returns whether the reference resolves against host validation context.
   */
  validate: (ref: ParsedAiScriptReference, ctx: AiScriptReferenceValidationContext) => boolean;

  /**
   * Resolves the base display name for badges when valid.
   */
  resolveName: (
    ref: ParsedAiScriptReference,
    ctx: AiScriptReferenceValidationContext
  ) => string | null;

  /**
   * Resolves the full badge label (name plus optional line range) when valid.
   */
  resolveLabel: (
    ref: ParsedAiScriptReference,
    ctx: AiScriptReferenceValidationContext
  ) => string | null;

  /**
   * Builds one send-time context block for this reference, or null when none.
   */
  expandContext?: (
    ref: ParsedAiScriptReference,
    ctx: AiScriptReferenceValidationContext
  ) => string | null;

  /**
   * Collects a persistable snapshot entry for this reference, or null when none.
   */
  collectSnapshot?: (
    ref: ParsedAiScriptReference,
    ctx: AiScriptReferenceValidationContext
  ) => PersistedChatReferenceSnapshotEntry | null;

  /**
   * Static agent system-prompt fragment describing how to treat this `@` form.
   */
  agentGuidance?: string;

  /**
   * Optional aggregation hints for the ephemeral selection context message.
   */
  contextMessageHints?: ChatPointerContextMessageHints;
}
