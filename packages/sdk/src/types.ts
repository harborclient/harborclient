import type * as React from 'react';

// ---------------------------------------------------------------------------
// Shared UI / request types
// ---------------------------------------------------------------------------

/**
 * HTTP method supported in the request editor.
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/**
 * A collection-scoped variable for use in request URLs via {{key}} syntax.
 */
export interface Variable {
  /**
   * Variable name referenced in {{key}} placeholders.
   */
  key: string;

  /**
   * Value substituted when the variable is resolved.
   */
  value: string;

  /**
   * Fallback value used when value is empty.
   */
  defaultValue: string;

  /**
   * When false, the row is ignored at resolve time so a parent/lower scope can pass through.
   */
  enabled: boolean;

  /**
   * When true, value is included in collection exports.
   */
  share: boolean;
}

/**
 * Enabled key/value row for headers, query params, and similar editors.
 */
export interface KeyValue {
  /**
   * Header or query parameter name.
   */
  key: string;

  /**
   * Header or query parameter value.
   */
  value: string;

  /**
   * When false, the pair is ignored when building the request.
   */
  enabled: boolean;
}

/**
 * Field type for a multipart/form-data part.
 */
export type FormDataPartType = 'text' | 'file';

/**
 * A single part in a multipart/form-data body.
 */
export interface FormDataPart {
  /**
   * Form field name.
   */
  key: string;

  /**
   * Text value when type is text; ignored for file parts.
   */
  value: string;

  /**
   * When false, the part is excluded when building the request.
   */
  enabled: boolean;

  /**
   * Whether this part is a text field or file upload.
   */
  type: FormDataPartType;

  /**
   * Absolute file paths for file parts; supports one or more files per field.
   */
  files: string[];
}

/**
 * Request stage relative to the HTTP send: pre-request or post-request.
 */
export type ScriptPhase = 'pre' | 'post';

/**
 * Script stage within a request stage's ordered script list.
 *
 * `before-all` and `after-all` run once before or after the main scripts.
 * `before-each` and `after-each` wrap every `main` script. `main` is the default
 * main script stage.
 */
export type ScriptStage = 'before-all' | 'before-each' | 'main' | 'after-each' | 'after-all';

/**
 * Named CodeMirror syntax themes available in settings.
 */
export type CodeEditorTheme =
  | 'default'
  | 'dracula'
  | 'githubLight'
  | 'githubDark'
  | 'monokai'
  | 'nord'
  | 'solarizedLight'
  | 'tokyoNight';

/**
 * CodeMirror basicSetup options for editable editor instances.
 */
export interface CodeEditorSetup {
  /**
   * When true, shows line numbers in the gutter.
   */
  lineNumbers: boolean;

  /**
   * When true, shows the code-folding gutter.
   */
  foldGutter: boolean;

  /**
   * When true, highlights the line containing the cursor.
   */
  highlightActiveLine: boolean;

  /**
   * When true, highlights the active line number in the gutter.
   */
  highlightActiveLineGutter: boolean;
}

// ---------------------------------------------------------------------------
// Core lifecycle
// ---------------------------------------------------------------------------

/**
 * A resource that can be released when no longer needed.
 *
 * Registration APIs (`hc.ui.register*`, `hc.themes.register`, `hc.commands.register`, etc.)
 * return a `Disposable` that unregisters the contribution when {@link Disposable.dispose}
 * is called. Registration disposables are tracked automatically by the host; keep the
 * return value only if you need to dispose early. Dispose custom resources (timers,
 * listeners, focus sync, etc.) from `deactivate()` or a React effect cleanup.
 */
export interface Disposable {
  /**
   * Releases this registration and any resources it holds.
   */
  dispose(): void;
}

/**
 * Common fields shared by UI contribution types registered via {@link PluginUi}.
 *
 * The {@link UiContributionBase.id} must match an entry in the corresponding
 * `manifest.contributes.*` array declared in your plugin package.
 */
export interface UiContributionBase {
  /**
   * Contribution id — must match an id in the corresponding manifest `contributes.*` array.
   */
  id: string;

  /**
   * Display label shown in the target UI surface (Settings sidebar, tab strip, etc.).
   */
  title: string;
}

// ---------------------------------------------------------------------------
// UI contributions
// ---------------------------------------------------------------------------

/**
 * Registers a React component as a Settings panel alongside built-in sections
 * (General, Storage, and so on).
 *
 * Manifest: `contributes.settingsSections`. Requires the `ui` permission.
 */
export interface SettingsSectionContribution extends UiContributionBase {
  /**
   * Panel content rendered when the user selects this settings section. Use {@link PluginContext.react} — do not bundle React.
   */
  Component: React.ComponentType;
}

/**
 * Registers a switchable left sidebar destination — a full-height panel the user
 * selects instead of the default collections view.
 *
 * Manifest: `contributes.sidebarPanels`. Requires the `ui` permission.
 *
 * To replace the built-in Collections sidebar, set `replaces: "collections"` on
 * the matching manifest entry (not on this runtime object). The host copies that
 * field into the registry when the panel is registered.
 *
 * For activity-rail icons that open a sidebar body while keeping the rail
 * visible, use {@link SidebarRailItemContribution} instead.
 */
export interface SidebarPanelContribution extends UiContributionBase {
  /**
   * Optional icon name shown when switching sidebar mode.
   */
  icon?: string;

  /**
   * Full sidebar content for this panel. Use {@link PluginContext.react} — do not bundle React.
   */
  Component: React.ComponentType;

  /**
   * Sort order among plugin sidebar panels. Lower values appear first.
   * Also used as a tie-breaker when choosing among multiple `replaces: "collections"` panels.
   */
  order?: number;
}

/**
 * Registers an activity-rail button that opens a full sidebar body when selected.
 *
 * Distinct from {@link SidebarPanelContribution} (horizontal switcher; hides the
 * rail). Manifest: `contributes.sidebarRailItems`. Requires the `ui` permission.
 *
 * The host mounts the body with `resizeMode="fill"` and keeps the activity rail
 * visible. Use {@link SidebarPanelViewContext} via the host surface context for
 * the current sidebar selection.
 */
export interface SidebarRailItemContribution extends UiContributionBase {
  /**
   * Curated icon name shown on the activity rail. The host maps this to a
   * built-in Font Awesome icon. Supported names: `server`, `database`, `globe`,
   * `code`, `robot`, `puzzle-piece`, `bolt`, `flask`. Unknown names fall back to
   * `puzzle-piece`.
   */
  icon: string;

  /**
   * Full sidebar content for this rail destination. Use {@link PluginContext.react}
   * — do not bundle React.
   */
  Component: React.ComponentType;

  /**
   * Sort order among plugin rail items (appended after built-in modes). Lower
   * values appear first.
   */
  order?: number;
}

/**
 * Adds a collapsible block inside the scrollable sidebar, using the same pattern
 * as the built-in Collections and Environments sections.
 *
 * Manifest: `contributes.sidebarSections`. Requires the `ui` permission.
 */
export interface SidebarSectionContribution extends UiContributionBase {
  /**
   * Section body rendered below the collapsible heading. Use {@link PluginContext.react} — do not bundle React.
   */
  Component: React.ComponentType;

  /**
   * Optional action controls rendered in the section header row (for example a
   * clear or refresh button). Use {@link PluginContext.react} — do not bundle React.
   */
  headerActions?: React.ComponentType;

  /**
   * Sort order below Collections / Environments. Lower values appear first.
   */
  order?: number;
}

/**
 * Registers a full main-area overlay, replacing the request editor while open
 * (same pattern as Team Hubs or Sharing Keys). Open the view with
 * {@link PluginCommands.execute} from a menu item or other trigger.
 *
 * Manifest: `contributes.mainViews`. Requires the `ui` permission.
 */
export interface MainViewContribution extends UiContributionBase {
  /**
   * Full main-area content. Use {@link PluginContext.react} — do not bundle React.
   */
  Component: React.ComponentType;

  /**
   * Optional tab-bar icon name. The host maps this to a built-in icon.
   * Supported names: `server`, `database`, `globe`, `code`, `robot`,
   * `puzzle-piece`, `bolt`, `flask`. Unknown names fall back to `puzzle-piece`.
   */
  icon?: string;
}

/**
 * Registers modal content rendered in a host overlay webview above the application.
 *
 * Manifest: `contributes.modals`. Requires the `ui` permission.
 */
export interface ModalContribution extends UiContributionBase {
  /**
   * Modal body. Receives a `context` prop from {@link PluginUi.openModal}.
   */
  Component: React.ComponentType<{ context: unknown }>;
}

// ---------------------------------------------------------------------------
// Request / response data
// ---------------------------------------------------------------------------

/**
 * Authorization type for the Auth tab; none inherits collection auth at send time.
 */
export type AuthType = 'none' | 'basic' | 'bearer';

/**
 * Basic and bearer credential fields stored together so switching type preserves values.
 */
export interface AuthConfig {
  /**
   * Selected auth mode; none means no request-level override.
   */
  type: AuthType;

  /**
   * Username and password for Basic Auth.
   */
  basic: {
    username: string;
    password: string;
  };

  /**
   * Token value for Bearer Token auth.
   */
  bearer: {
    token: string;
  };
}

/**
 * Request body encoding selected in the Body tab.
 */
export type BodyType = 'none' | 'json' | 'text' | 'multipart' | 'urlencoded';

/**
 * Snapshot of the active request being edited in the request editor.
 *
 * Passed to request and response tab components via {@link RequestTabContext} and
 * {@link ResponseTabContext}. Updates locally as the user edits — no IPC round-trip
 * per keystroke.
 */
export interface RequestDraft {
  /**
   * HTTP method (for example `GET`, `POST`).
   */
  method: string;

  /**
   * Request URL including scheme, host, path, and query string.
   */
  url: string;

  /**
   * Query parameter rows. Each element has `key`, `value`, and `enabled` — only rows
   * with `enabled: true` and a non-empty `key` are sent.
   */
  params: Array<{ key: string; value: string; enabled: boolean }>;

  /**
   * Header rows. Each element has `key`, `value`, and `enabled` — only rows with
   * `enabled: true` and a non-empty `key` are sent.
   */
  headers: Array<{ key: string; value: string; enabled: boolean }>;

  /**
   * Request body content as a string.
   */
  body: string;

  /**
   * Authorization settings from the Auth tab.
   */
  auth: AuthConfig;

  /**
   * Body encoding selected in the Body tab.
   */
  body_type: BodyType;
}

/**
 * Snapshot of the last HTTP response received for the active request send.
 *
 * `null` on {@link RequestTabContext.response} and {@link ResponseTabContext.response}
 * when no response exists yet.
 */
export interface HttpResponse {
  /**
   * HTTP status code (for example `200`, `404`).
   */
  status: number;

  /**
   * HTTP status text (for example `OK`, `Not Found`).
   */
  statusText: string;

  /**
   * Response header rows. Each element has `key` and `value`.
   */
  headers: Array<{ key: string; value: string }>;

  /**
   * Response body content as a string.
   */
  body: string;

  /**
   * Time from send to response completion, in milliseconds.
   */
  durationMs: number;

  /**
   * Response body size in bytes.
   */
  sizeBytes: number;
}

// ---------------------------------------------------------------------------
// Tab contexts
// ---------------------------------------------------------------------------

/**
 * Context passed to {@link RequestTabContribution} components.
 *
 * The tab re-renders locally when the user edits the request. Use
 * {@link RequestTabContext.response} when you need the last response for the active send.
 */
export interface RequestTabContext {
  /**
   * Active request draft for the open editor tab.
   */
  draft: RequestDraft;

  /**
   * Last response for the active send, or `null` if none yet.
   */
  response: HttpResponse | null;

  /**
   * Always `true` — request tab content must not mutate the draft.
   */
  readOnly: true;

  /**
   * Collection-level auth used when {@link RequestDraft.auth} type is `none`.
   */
  collectionAuth: AuthConfig;

  /**
   * Collection-level headers merged before request headers at send time.
   */
  collectionHeaders: Array<{ key: string; value: string; enabled: boolean }>;

  /**
   * Merged global, collection, and environment values for {{key}} substitution.
   *
   * Precedence: environment overrides collection overrides global on duplicate keys.
   * Empty variable values fall back to each variable's defaultValue (same as Send).
   */
  variables: Record<string, string>;

  /**
   * Stable per-request identifier for namespacing persistent plugin state.
   *
   * Saved requests use `req:<id>` and remain stable across edits and restarts.
   * Unsaved tabs fall back to a best-effort `METHOD url` fingerprint.
   */
  requestKey: string;
}

/**
 * Adds a segmented tab to the request editor (alongside Params, Headers, Body, and so on).
 *
 * Manifest: `contributes.requestTabs`. Requires the `ui` permission.
 */
export interface RequestTabContribution extends UiContributionBase {
  /**
   * Tab content. Receives `{ context: RequestTabContext }`. Use {@link PluginContext.react} — do not bundle React.
   */
  Component: React.ComponentType<{ context: RequestTabContext }>;

  /**
   * Sort order among editor tabs. Lower values appear first.
   */
  order?: number;
}

/**
 * Context passed to {@link ResponseTabContribution} components.
 */
export interface ResponseTabContext {
  /**
   * Active request draft associated with the response viewer.
   */
  draft: RequestDraft;

  /**
   * Last response, or `null` when no response exists yet.
   */
  response: HttpResponse | null;

  /**
   * Stable per-request identifier for namespacing persistent plugin state.
   *
   * Saved requests use `req:<id>` and remain stable across edits and restarts.
   * Unsaved tabs fall back to a best-effort `METHOD url` fingerprint.
   */
  requestKey: string;
}

/**
 * Adds a tab to the response viewer (alongside Body, Headers, Tests).
 *
 * Manifest: `contributes.responseTabs`. Requires the `ui` permission.
 */
export interface ResponseTabContribution extends UiContributionBase {
  /**
   * Tab content. Receives `{ context: ResponseTabContext }`. Use {@link PluginContext.react} — do not bundle React.
   */
  Component: React.ComponentType<{ context: ResponseTabContext }>;

  /**
   * Sort order among response tabs. Lower values appear first.
   */
  order?: number;

  /**
   * When the tab is visible. Default `'hasResponse'`.
   */
  when?: 'always' | 'hasResponse';
}

/**
 * Context passed to {@link CollectionSettingsTabContribution} components.
 */
export interface CollectionSettingsTabContext {
  /**
   * Database id of the collection whose settings are open.
   */
  collectionId: number;

  /**
   * When `true`, the collection settings UI is read-only.
   */
  readOnly: boolean;
}

/**
 * Adds a segmented tab to Collection Settings (alongside General, Variables, Headers, and so on).
 *
 * Manifest: `contributes.collectionSettingsTabs`. Requires the `ui` permission.
 */
export interface CollectionSettingsTabContribution extends UiContributionBase {
  /**
   * Tab content. Receives `{ context: CollectionSettingsTabContext }`. Use {@link PluginContext.react} — do not bundle React.
   */
  Component: React.ComponentType<{ context: CollectionSettingsTabContext }>;

  /**
   * Sort order among collection settings tabs. Lower values appear first.
   */
  order?: number;
}

/**
 * Registers a slide-up footer panel using the same pattern as Console and Variables.
 *
 * Manifest: `contributes.footerPanels`. Requires the `ui` permission.
 */
export interface FooterPanelContribution extends UiContributionBase {
  /**
   * Slide-up panel content. Use {@link PluginContext.react} — do not bundle React.
   */
  Component: React.ComponentType;
}

/**
 * Visual tone for a host-rendered footer panel status dot.
 *
 * Matches {@link StatusDotVariant} from `@harborclient/sdk/components`.
 */
export type FooterPanelIndicatorStatus =
  | 'success'
  | 'danger'
  | 'muted'
  | 'accent'
  | 'warning'
  | 'info';

/**
 * Declarative state for the native status dot beside a footer panel toggle.
 *
 * Pass `null` to {@link PluginUi.setFooterPanelIndicator} to hide the dot.
 */
export interface FooterPanelIndicatorState {
  /**
   * Color preset for the host-rendered status dot.
   */
  status: FooterPanelIndicatorStatus;

  /**
   * Optional accessible name for the status (for example "Mock server active").
   * When omitted the host uses a generic label.
   */
  label?: string;
}

// ---------------------------------------------------------------------------
// Menus, toolbar, and status bar
// ---------------------------------------------------------------------------

/**
 * Target application menu for {@link MenuItemContribution} entries.
 *
 * Menu contributions use the application menu only — not native window chrome.
 */
export type AppMenu = 'file' | 'edit' | 'view' | 'help';

/**
 * Adds an item to an application menu (File, Edit, View, or Help).
 *
 * Register the command handler with {@link PluginCommands.register} separately.
 * Manifest: `contributes.menus` plus a matching `contributes.commands` entry.
 * Requires the `ui` permission.
 */
export interface MenuItemContribution {
  /**
   * Target application menu.
   */
  menu: AppMenu;

  /**
   * Command id to run on click — must match a registered command and manifest entry.
   */
  command: string;

  /**
   * Menu label override. Falls back to the command title when omitted.
   */
  label?: string;

  /**
   * Menu group for separator placement.
   */
  group?: string;

  /**
   * Sort order within the group. Lower values appear first.
   */
  order?: number;
}

/**
 * Adds a button to the request URL bar toolbar near the Send button.
 *
 * Register the command handler with {@link PluginCommands.register} separately.
 * Manifest: `contributes.requestToolbarActions` plus a matching `contributes.commands` entry.
 * Requires the `ui` permission.
 */
export interface RequestToolbarActionContribution {
  /**
   * Action id — must match an entry in `contributes.requestToolbarActions`.
   */
  id: string;

  /**
   * Button label or tooltip text.
   */
  title: string;

  /**
   * Command id to run on click — must match a registered command and manifest entry.
   */
  command: string;

  /**
   * Optional icon name.
   */
  icon?: string;

  /**
   * Sort order near the Send button. Lower values appear first.
   */
  order?: number;
}

/**
 * Context passed to a script editor action command when the user clicks a row button.
 */
export interface ScriptEditorActionContext {
  /**
   * Script phase for the row that triggered the action.
   */
  phase: ScriptPhase;

  /**
   * Stable script row id from the active request draft.
   */
  scriptId: string;

  /**
   * Current script source shown in the editor (inline code or resolved snippet body).
   */
  code: string;
}

/**
 * Adds an icon button to each script row in the pre/post request script editor.
 *
 * Register the command handler with {@link PluginCommands.register} separately.
 * The handler receives a single {@link ScriptEditorActionContext} argument.
 * Manifest: `contributes.scriptEditorActions` plus a matching `contributes.commands` entry.
 * Requires the `ui` permission.
 */
export interface ScriptEditorActionContribution {
  /**
   * Action id — must match an entry in `contributes.scriptEditorActions`.
   */
  id: string;

  /**
   * Button label or tooltip text.
   */
  title: string;

  /**
   * Command id to run on click — must match a registered command and manifest entry.
   */
  command: string;

  /**
   * Optional icon name.
   */
  icon?: string;

  /**
   * Sort order within the row action group. Lower values appear first.
   */
  order?: number;

  /**
   * When set, limits the action to specific script phases. Omit to show in both pre and post.
   */
  phases?: ScriptPhase[];
}

/**
 * One recorded workflow step exposed to plugin toolbar commands and action-block surfaces.
 */
export interface WorkflowActionRef {
  /**
   * Stable identifier for this action; used when other actions refer to it.
   */
  uuid: string;

  /**
   * Stable logical event name (for example `request.load`).
   */
  type: string;

  /**
   * Wall-clock time when the action was recorded; optional in portable files.
   */
  at?: number;

  /**
   * Normalized action payload.
   */
  payload: unknown;
}

/**
 * Mode of the workflow footer panel when a plugin surface or toolbar action runs.
 *
 * - `record` — live recording session (no persisted workflow yet; `workflowId` is `-1`)
 * - `play` — playback without host edit controls
 * - `edit` — timeline editor with unsaved buffer edits
 */
export type WorkflowPanelPluginMode = 'record' | 'play' | 'edit';

/**
 * Context passed to a workflow toolbar action command when the user clicks the button.
 */
export interface WorkflowToolbarActionContext {
  /**
   * Database id of the workflow open in play/edit mode, or `-1` while recording.
   */
  workflowId: number;

  /**
   * Active workflow footer panel mode.
   */
  mode: WorkflowPanelPluginMode;

  /**
   * 0-based index of the selected timeline action, or `-1` when none is selected.
   */
  actionIndex: number;

  /**
   * Selected timeline action, or `null` when none is selected.
   */
  action: WorkflowActionRef | null;

  /**
   * True when the playback buffer has unsaved edits.
   */
  dirty: boolean;
}

/**
 * Adds a button to the right of Save in the workflow footer panel toolbar.
 *
 * Surfaces mount in record, play, and edit modes; use {@link WorkflowToolbarActionContext.mode}
 * to tell them apart. Host delete/move/save buttons are edit-only.
 *
 * Register the command handler with {@link PluginCommands.register} separately.
 * The handler receives a single {@link WorkflowToolbarActionContext} argument.
 * Manifest: `contributes.workflowToolbarActions` plus a matching `contributes.commands` entry.
 * Requires the `ui` permission.
 */
export interface WorkflowToolbarActionContribution {
  /**
   * Action id — must match an entry in `contributes.workflowToolbarActions`.
   */
  id: string;

  /**
   * Button label or tooltip text.
   */
  title: string;

  /**
   * Command id to run on click — must match a registered command and manifest entry.
   */
  command: string;

  /**
   * Optional icon name.
   */
  icon?: string;

  /**
   * Sort order to the right of Save. Lower values appear first.
   */
  order?: number;
}

/**
 * Context passed to {@link WorkflowActionBlockContribution} HostedSurface components.
 */
export interface WorkflowActionBlockContext {
  /**
   * Database id of the workflow open in play/edit mode, or `-1` while recording.
   */
  workflowId: number;

  /**
   * Active workflow footer panel mode.
   */
  mode: WorkflowPanelPluginMode;

  /**
   * 0-based index of this timeline action.
   */
  actionIndex: number;

  /**
   * Timeline action rendered inside this block.
   */
  action: WorkflowActionRef;

  /**
   * True when this block is the playback cursor.
   */
  selected: boolean;

  /**
   * True when the block is too narrow for rich content (host may hide the surface).
   */
  compact: boolean;
}

/**
 * Renders a HostedSurface inside matching workflow timeline action blocks.
 *
 * Surfaces mount in record, play, and edit modes; use {@link WorkflowActionBlockContext.mode}
 * to tell them apart. Manifest: `contributes.workflowActionBlocks`. Requires the `ui` permission.
 */
export interface WorkflowActionBlockContribution extends UiContributionBase {
  /**
   * Block content. Receives `{ context: WorkflowActionBlockContext }`.
   * Use {@link PluginContext.react} — do not bundle React.
   */
  Component: React.ComponentType<{ context: WorkflowActionBlockContext }>;

  /**
   * When set, limits the surface to these action types. Omit to show on every block.
   */
  actionTypes?: string[];

  /**
   * Sort order among stacked surfaces in a block. Lower values appear first.
   */
  order?: number;
}

/**
 * Sidebar row type that a context menu item applies to.
 *
 * Used by {@link ContextMenuItemContribution.when} to filter which rows show the action.
 */
export type ContextMenuTarget = 'collection' | 'folder' | 'request';

/**
 * Adds an action to row context menus in the sidebar.
 *
 * The command handler receives target context as arguments (for example `requestId`).
 * Register the handler with {@link PluginCommands.register} separately.
 * Manifest: `contributes.contextMenus` plus a matching `contributes.commands` entry.
 * Requires the `ui` permission.
 */
export interface ContextMenuItemContribution {
  /**
   * Menu item id — must match an entry in `contributes.contextMenus`.
   */
  id: string;

  /**
   * Menu label shown in the context menu.
   */
  title: string;

  /**
   * Command id to run on click — must match a registered command and manifest entry.
   */
  command: string;

  /**
   * Sidebar row type(s) that show this menu item.
   */
  when: ContextMenuTarget | ContextMenuTarget[];

  /**
   * Menu group for separator placement.
   */
  group?: string;

  /**
   * Sort order within the group. Lower values appear first.
   */
  order?: number;
}

/**
 * Adds a custom status indicator to the footer bar (beside sidebar / AI toggles).
 *
 * Manifest: `contributes.statusBarItems`. Requires the `ui` permission.
 */
export interface StatusBarItemContribution {
  /**
   * Item id — must match an entry in `contributes.statusBarItems`.
   */
  id: string;

  /**
   * Status content rendered in the footer. Use {@link PluginContext.react} — do not bundle React.
   */
  Component: React.ComponentType;

  /**
   * Footer side. Default `'right'`.
   */
  alignment?: 'left' | 'right';

  /**
   * Sort order on that side. Lower values appear first.
   */
  order?: number;
}

// ---------------------------------------------------------------------------
// Themes
// ---------------------------------------------------------------------------

/**
 * HarborClient UI color token ids.
 *
 * Override via {@link ThemeContribution.colors} or a bundled stylesheet.
 * Each token maps to a `--mac-<token>` CSS custom property on `:root`.
 *
 * Token usage:
 * - `surface` — main content background
 * - `sidebar` — left sidebar background
 * - `sidebar-toolbar` — sidebar/footer toolbar strip background
 * - `sidebar-rail` — activity rail background
 * - `sidebar-rail-active` — active/hover activity rail section fill
 * - `sidebar-rail-text` — activity rail icons and labels
 * - `sidebar-rail-separator` — activity rail hairline between item groups
 * - `sidebar-section` — sidebar section headers
 * - `sidebar-section-text` — sidebar section header labels and chevrons
 * - `footer` — footer status bar background
 * - `footer-text` — footer primary text (active segment buttons, selection-style icons)
 * - `footer-muted` — footer de-emphasized text (inactive segment buttons)
 * - `footer-icon-active` — active footer icon toggle color
 * - `toolbar-action-active` — pressed sidebar toolbar action icon color
 * - `breadcrumb-background` — request editor breadcrumb bar track
 * - `breadcrumb-segment` — breadcrumb chevron segment fill (collection/folder crumbs)
 * - `breadcrumb-current` — trailing request-name breadcrumb segment fill
 * - `git-staged` — git-backed request names staged for commit
 * - `git-uncommitted` — git-backed request names with both staged and unstaged changes
 * - `git-unstaged` — git-backed request names with tracked unstaged changes
 * - `git-untracked` — git-backed request names for new files not yet added to the repository
 * - `control` — panels, inputs, footer bar
 * - `field` — input field fill
 * - `separator` — borders and dividers
 * - `text` — primary text
 * - `text-secondary` — secondary labels
 * - `muted` — de-emphasized text
 * - `accent` — links, focus rings, primary actions
 * - `selection` — selected row / highlight fill
 * - `doc-markdown` — collection sidebar markdown document icon
 * - `tab-unsaved` — request/markdown tab title when the tab has unsaved changes
 * - `tab-underline` — active request tab underline
 * - `resize-handle` — borders, resize grips, and high-contrast chrome accents
 * - `variable-token` — `{{variable}}` syntax highlight in editors
 * - `danger`, `danger-light`, `warning`, `success`, `info` — status colors
 * - `method-get`, `method-post`, `method-put`, `method-patch`, `method-delete`, `method-head`, `method-options` — HTTP method badge colors
 * - `scrollbar-track`, `scrollbar-thumb`, `scrollbar-thumb-hover`, `scrollbar-thumb-active` — scrollbar track and thumb colors
 * - `script-stage-before-all`, `script-stage-before-each`, `script-stage-main`, `script-stage-after-each`, `script-stage-after-all` — script row stage accent colors
 * - `terminal` — footer terminal background
 */
export type ThemeColorToken =
  | 'surface'
  | 'sidebar'
  | 'sidebar-toolbar'
  | 'sidebar-rail'
  | 'sidebar-rail-active'
  | 'sidebar-rail-text'
  | 'sidebar-rail-separator'
  | 'sidebar-section'
  | 'sidebar-section-text'
  | 'footer'
  | 'footer-text'
  | 'footer-muted'
  | 'footer-icon-active'
  | 'toolbar-action-active'
  | 'breadcrumb-background'
  | 'breadcrumb-segment'
  | 'breadcrumb-current'
  | 'git-staged'
  | 'git-uncommitted'
  | 'git-unstaged'
  | 'git-untracked'
  | 'control'
  | 'field'
  | 'separator'
  | 'text'
  | 'text-secondary'
  | 'muted'
  | 'accent'
  | 'selection'
  | 'doc-markdown'
  | 'tab-unsaved'
  | 'tab-underline'
  | 'resize-handle'
  | 'variable-token'
  | 'danger'
  | 'danger-light'
  | 'warning'
  | 'success'
  | 'info'
  | 'method-get'
  | 'method-post'
  | 'method-put'
  | 'method-patch'
  | 'method-delete'
  | 'method-head'
  | 'method-options'
  | 'scrollbar-track'
  | 'scrollbar-thumb'
  | 'scrollbar-thumb-hover'
  | 'scrollbar-thumb-active'
  | 'script-stage-before-all'
  | 'script-stage-before-each'
  | 'script-stage-main'
  | 'script-stage-after-each'
  | 'script-stage-after-all'
  | 'terminal';

/**
 * HarborClient UI metric token ids (typography and geometry).
 *
 * Override via {@link ThemeContribution.metrics} or a bundled stylesheet.
 * Each token maps to a `--mac-<token>` CSS custom property on `:root`.
 * Values are CSS strings (for example `14px`, `0.375rem`, `system-ui, sans-serif`).
 *
 * Token usage by UI section:
 * - Layout — `layout-font-family`, `layout-font-size`, `layout-border-width`, `layout-radius`
 * - Breadcrumb — `breadcrumb-font-family`, `breadcrumb-font-size`, `breadcrumb-border-width`, `breadcrumb-radius`
 * - Text — `text-font-family`, `text-font-family-mono`, `text-font-size`, `text-font-size-sm`, `text-font-size-lg`
 * - Interactive — `interactive-font-family`, `interactive-font-size`, `interactive-border-width`, `interactive-radius`, `interactive-focus-ring-width`
 * - Chrome — `chrome-font-family`, `chrome-font-size`, `chrome-border-width`, `chrome-radius`
 * - Tabs — `tab-font-family`, `tab-font-size`, `tab-border-width`, `tab-radius`
 * - Status — `status-font-family`, `status-font-size`, `status-border-width`, `status-radius`
 * - HTTP methods — `method-font-family`, `method-font-size`, `method-border-width`, `method-radius`
 * - Script stages — `script-stage-font-family`, `script-stage-font-size`, `script-stage-border-width`, `script-stage-radius`
 * - Git — `git-font-family`, `git-font-size`, `git-border-width`, `git-radius`
 * - Scrollbar — `scrollbar-width`
 */
export type ThemeMetricToken =
  | 'layout-font-family'
  | 'layout-font-size'
  | 'layout-border-width'
  | 'layout-radius'
  | 'breadcrumb-font-family'
  | 'breadcrumb-font-size'
  | 'breadcrumb-border-width'
  | 'breadcrumb-radius'
  | 'text-font-family'
  | 'text-font-family-mono'
  | 'text-font-size'
  | 'text-font-size-sm'
  | 'text-font-size-lg'
  | 'interactive-font-family'
  | 'interactive-font-size'
  | 'interactive-border-width'
  | 'interactive-radius'
  | 'interactive-focus-ring-width'
  | 'chrome-font-family'
  | 'chrome-font-size'
  | 'chrome-border-width'
  | 'chrome-radius'
  | 'tab-font-family'
  | 'tab-font-size'
  | 'tab-border-width'
  | 'tab-radius'
  | 'status-font-family'
  | 'status-font-size'
  | 'status-border-width'
  | 'status-radius'
  | 'method-font-family'
  | 'method-font-size'
  | 'method-border-width'
  | 'method-radius'
  | 'script-stage-font-family'
  | 'script-stage-font-size'
  | 'script-stage-border-width'
  | 'script-stage-radius'
  | 'git-font-family'
  | 'git-font-size'
  | 'git-border-width'
  | 'git-radius'
  | 'scrollbar-width';

/**
 * Custom appearance theme registered via {@link PluginThemes.register}.
 *
 * Plugin themes appear in **Settings → General → Appearance** alongside built-in options.
 * When active, the host sets `data-theme="plugin-<pluginId>-<themeId>"` on `<html>` and
 * applies token overrides or an injected stylesheet.
 *
 * Manifest: `contributes.themes`. Requires the `ui` permission.
 */
export interface ThemeContribution {
  /**
   * Theme id unique within your plugin — must match an entry in `contributes.themes`.
   */
  id: string;

  /**
   * Label shown in the appearance dropdown.
   */
  title: string;

  /**
   * Base appearance for `color-scheme` and Electron native window chrome.
   */
  type: 'light' | 'dark';

  /**
   * Color token overrides without the `--mac-` prefix. Use for simple palette swaps.
   */
  colors?: Partial<Record<ThemeColorToken, string>>;

  /**
   * Typography and geometry token overrides without the `--mac-` prefix.
   * Values are CSS strings (for example `14px`, `0.375rem`).
   */
  metrics?: Partial<Record<ThemeMetricToken, string>>;

  /**
   * Plugin-relative CSS path (for example `dist/theme.css`) for complex themes.
   */
  stylesheet?: string;
}

/**
 * Built-in appearance theme ids selectable in **Settings → General**.
 *
 * When a built-in theme is active, plugin theme overrides are not applied.
 */
export type BuiltinThemeId = 'light' | 'dark' | 'system' | 'high-contrast';

/**
 * Currently active appearance theme — either a built-in HarborClient theme or a plugin theme.
 *
 * When the user selects a plugin theme, the persisted value is
 * `plugin:<pluginId>:<themeId>`. If the plugin is disabled or uninstalled while its
 * theme is active, HarborClient falls back to **System**.
 */
export type ActiveTheme =
  | {
      /**
       * Theme provided by HarborClient.
       */
      source: 'builtin';

      /**
       * Built-in theme id.
       */
      id: BuiltinThemeId;
    }
  | {
      /**
       * Theme registered by a plugin via {@link PluginThemes.register}.
       */
      source: 'plugin';

      /**
       * Plugin package id from `manifest.json`.
       */
      pluginId: string;

      /**
       * Theme id from {@link ThemeContribution.id}.
       */
      themeId: string;
    };

/**
 * Custom appearance theme registration and change notifications.
 *
 * Requires the `ui` permission. Returned disposables are tracked automatically by the host.
 */
export interface PluginThemes {
  /**
   * Registers a custom appearance theme.
   *
   * Provide {@link ThemeContribution.colors}, a {@link ThemeContribution.stylesheet}, or both.
   * The host injects stylesheets while the theme is registered and removes them on deactivation.
   *
   * @param theme - Theme definition. `theme.id` must match `contributes.themes`.
   * @returns A {@link Disposable} that unregisters the theme when disposed.
   */
  register(theme: ThemeContribution): Disposable;

  /**
   * Returns the currently active theme.
   *
   * @returns The active built-in or plugin theme reference.
   */
  getActive(): Promise<ActiveTheme>;

  /**
   * Fires when the user changes the appearance theme in Settings or when the host
   * resets the theme after plugin deactivation.
   *
   * @param listener - Called with the new {@link ActiveTheme}.
   * @returns A {@link Disposable} that removes the listener when disposed.
   */
  onDidChange(listener: (theme: ActiveTheme) => void): Disposable;
}

// ---------------------------------------------------------------------------
// Storage and commands
// ---------------------------------------------------------------------------

/**
 * Plugin-scoped persistent key-value storage backed by the main process.
 *
 * Keys are namespaced by plugin `id`. Requires the `storage` permission.
 * Use for settings and preferences — debounce text-field writes; load once on panel mount.
 */
export interface PluginStorage {
  /**
   * Returns the stored value for a key.
   *
   * @param key - Storage key within this plugin's namespace.
   * @returns The stored value, or `undefined` if the key has never been set.
   */
  get<T>(key: string): Promise<T | undefined>;

  /**
   * Persists a JSON-serializable value.
   *
   * @param key - Storage key within this plugin's namespace.
   * @param value - Value to persist.
   */
  set<T>(key: string, value: T): Promise<void>;
}

/**
 * Result of a mutating SQL statement (`INSERT`, `UPDATE`, `DELETE`).
 */
export interface PluginRunResult {
  /** Number of rows changed by the statement. */
  changes: number;

  /** Row id of the last insert, as a number or string when larger than `Number.MAX_SAFE_INTEGER`. */
  lastInsertRowid: number | string;
}

/**
 * Transaction-scoped database operations passed to {@link PluginDatabase.transaction}.
 */
export interface PluginDatabaseTx {
  /**
   * Returns the first row matching a parameterized query.
   *
   * @param sql - Single-statement SQL with `?` placeholders.
   * @param params - Bound parameter values.
   */
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | undefined>;

  /**
   * Returns all rows matching a parameterized query.
   *
   * @param sql - Single-statement SQL with `?` placeholders.
   * @param params - Bound parameter values.
   */
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;

  /**
   * Runs a mutating parameterized statement.
   *
   * @param sql - Single-statement SQL with `?` placeholders.
   * @param params - Bound parameter values.
   */
  run(sql: string, params?: unknown[]): Promise<PluginRunResult>;
}

/**
 * Plugin-scoped SQLite database backed by an isolated file in the main process.
 *
 * Requires the `database` permission. Each plugin id gets its own database file under
 * HarborClient userData — not shared with collections or other plugins.
 */
export interface PluginDatabase extends PluginDatabaseTx {
  /**
   * Executes one or more DDL statements (migrations).
   *
   * @param sql - Multi-statement SQL script.
   */
  exec(sql: string): Promise<void>;

  /**
   * Runs a callback inside an exclusive transaction (`BEGIN` … `COMMIT` / `ROLLBACK`).
   *
   * @param fn - Callback receiving transaction-scoped query helpers.
   */
  transaction<T>(fn: (tx: PluginDatabaseTx) => Promise<T>): Promise<T>;
}

/**
 * Command handlers that tie together menus, toolbar actions, and context menu items.
 *
 * Requires the `ui` permission for {@link PluginCommands.register}. Returned
 * disposables are tracked automatically by the host.
 */
export interface PluginCommands {
  /**
   * Registers a command handler.
   *
   * The `id` must match a command declared in `manifest.contributes.commands` and
   * referenced by menu, toolbar, or context menu contributions.
   *
   * @param id - Command id.
   * @param handler - Called when the command runs. Context menu handlers receive target context as args.
   * @returns A {@link Disposable} that unregisters the handler when disposed.
   */
  register(id: string, handler: (...args: unknown[]) => void | Promise<void>): Disposable;

  /**
   * Runs a registered command programmatically.
   *
   * For example, open a {@link MainViewContribution} from another part of your plugin.
   *
   * @param id - Command id to execute.
   * @param args - Arguments forwarded to the command handler.
   */
  execute(id: string, ...args: unknown[]): Promise<void>;
}

/**
 * Map of action labels to handlers registered for the Action menu quick-open palette.
 */
export type ActionHandlerMap = Record<string, (...args: unknown[]) => void | Promise<void>>;

/**
 * Registers namespaced quick-open actions surfaced when users type `#` in the Action menu.
 *
 * Requires the `ui` permission. Returned disposables are tracked automatically by the host.
 */
export interface PluginActions {
  /**
   * Registers one or more actions under a namespace (for example `cURL: View`).
   *
   * Handlers run in the plugin agent webview when the user selects a matching row.
   *
   * @param namespace - Group prefix shown before each action label.
   * @param handlers - Label-to-handler map keyed by the action label.
   * @returns A {@link Disposable} that unregisters every action when disposed.
   */
  register(namespace: string, handlers: ActionHandlerMap): Disposable;
}

/**
 * File selected through **File → Import** and forwarded to plugin import handlers.
 */
export interface ImportFile {
  /**
   * Base file name including extension.
   */
  name: string;

  /**
   * Absolute path to the selected file.
   */
  path: string;

  /**
   * Normalized extension with a leading dot (for example `.json`).
   */
  extension: string;

  /**
   * Raw UTF-8 file contents.
   */
  contents: string;
}

/**
 * Callbacks registered for one import format through {@link PluginImports.registerHandler}.
 */
export interface ImportHandler {
  /**
   * Returns whether this handler should process the file.
   *
   * Called only after built-in HarborClient import formats are ruled out.
   *
   * @param file - Selected import file from the host.
   */
  canImport(file: ImportFile): boolean | Promise<boolean>;

  /**
   * Performs the import workflow (for example opening a preview UI or creating a collection).
   *
   * @param file - Selected import file from the host.
   */
  import(file: ImportFile): void | Promise<void>;
}

/**
 * HTTP header row sent with MCP client requests registered by a plugin.
 */
export interface PluginMcpHeader {
  /**
   * Header name.
   */
  key: string;

  /**
   * Header value.
   */
  value: string;
}

/**
 * Serializable MCP client server configuration registered by a plugin.
 */
export interface PluginMcpServerConfig {
  /**
   * Display name shown in Settings → AI & MCP.
   */
  name: string;

  /**
   * Remote MCP server URL (Streamable HTTP or legacy SSE endpoint).
   */
  serverURL: string;

  /**
   * When false, Harbor skips connecting to this server. Defaults to true.
   */
  enabled?: boolean;

  /**
   * Optional HTTP headers sent with MCP client requests.
   */
  headers?: PluginMcpHeader[];

  /**
   * Optional square icon as a `data:image/...;base64,...` data URI for settings display.
   */
  icon?: string;
}

/**
 * MCP client server registration available on {@link PluginContext.mcp}.
 *
 * Requires the `mcp` permission. Registrations are activation-scoped: Harbor connects
 * while the plugin is enabled and removes them on dispose or plugin unload. Plugin-owned
 * servers appear as read-only rows in Settings → AI & MCP.
 */
export interface PluginMcp {
  /**
   * Registers a remote MCP client server for Harbor's chat agent.
   *
   * Re-registering with the same registration id from one plugin replaces the prior
   * entry. The returned {@link Disposable} is tracked automatically by the host.
   *
   * @param config - Remote MCP server metadata and connection options.
   * @returns A {@link Disposable} that unregisters the server when disposed.
   */
  registerServer(config: PluginMcpServerConfig): Disposable;
}

/**
 * URL-path-to-filesystem alias for a Harbor Live Server.
 */
export interface LiveServerAlias {
  /**
   * URL path prefix, e.g. `/assets`.
   */
  path: string;

  /**
   * Filesystem target, absolute or relative to the server root.
   */
  target: string;
}

/**
 * CORS middleware settings for a Harbor Live Server.
 */
export interface LiveServerCorsSettings {
  /**
   * When true, CORS middleware is mounted.
   */
  enabled: boolean;

  /**
   * Allowed origin(s): `*` or a comma-separated list of origins.
   */
  origin: string;

  /**
   * Allowed methods: `*` or a comma-separated list (e.g. `GET,POST`).
   */
  methods: string;

  /**
   * Allowed request headers: `*`, empty (reflect request), or comma-separated names.
   */
  allowedHeaders: string;

  /**
   * Headers browsers may read from the response: `*`, empty (omit), or
   * comma-separated names.
   */
  exposedHeaders: string;

  /**
   * Preflight cache duration in seconds as a string (e.g. `600`). Empty omits
   * `Access-Control-Max-Age`.
   */
  maxAge: string;

  /**
   * When true, responses include `Access-Control-Allow-Credentials`.
   */
  credentials: boolean;
}

/**
 * One custom response header applied by a Harbor Live Server.
 */
export interface LiveServerResponseHeader {
  /**
   * Header name, e.g. `Cache-Control`.
   */
  name: string;

  /**
   * Header value, e.g. `no-store`.
   */
  value: string;

  /**
   * When false, the header is not applied. Defaults to true when omitted.
   */
  enabled?: boolean;
}

/**
 * One path-routing rule for a Harbor Live Server (SPA fallback / soft rewrite).
 *
 * Rules run after alias and document-root static miss. First matching enabled
 * rule wins. Use `match: '*'` to catch every remaining path.
 */
export interface LiveServerRoute {
  /**
   * `*` for all paths, or a regex source matched against the URL pathname.
   */
  match: string;

  /**
   * File or directory path, absolute or relative to the server root.
   */
  target: string;

  /**
   * When false, the rule is ignored. Defaults to true when omitted.
   */
  enabled?: boolean;
}

/**
 * TLS certificate settings for serving a Harbor Live Server over HTTPS.
 */
export interface LiveServerSslSettings {
  /**
   * When true, the live server listens with HTTPS using the configured cert/key.
   */
  enabled: boolean;

  /**
   * Absolute path to a PEM (or compatible) certificate file.
   */
  certPath: string;

  /**
   * Absolute path to a PEM (or compatible) private key file.
   */
  keyPath: string;
}

/**
 * Configuration shared by saved and running Harbor Live Servers.
 */
export interface LiveServerConfig {
  /**
   * Display name shown in the sidebar and plugin APIs.
   */
  name: string;

  /**
   * Absolute path to the directory served as the document root.
   */
  root: string;

  /**
   * Explicit listen port, or null to auto-select from 5500 upward.
   */
  port: number | null;

  /**
   * Path aliases mounted before the document root static middleware.
   */
  aliases: LiveServerAlias[];

  /**
   * When true, the host watches the root (and alias targets) for changes.
   */
  watch: boolean;

  /**
   * CORS middleware settings applied when the server starts.
   */
  cors: LiveServerCorsSettings;

  /**
   * Path or file opened when the Live Page starts (always leading `/`).
   */
  openPath: string;

  /**
   * When true, navigations within the origin update {@link lastOpenedPath}.
   */
  rememberLastUrl: boolean;

  /**
   * Last opened path+search+hash within the origin; null when never recorded.
   */
  lastOpenedPath: string | null;

  /**
   * Ordered directory index filenames for Express static.
   */
  indexFiles: string[];

  /**
   * Listen bind host (e.g. `127.0.0.1` or `0.0.0.0`).
   */
  host: string;

  /**
   * Custom response headers applied after CORS and before static.
   */
  headers: LiveServerResponseHeader[];

  /**
   * Ordered path routing rules applied after static miss (first match wins).
   */
  routes: LiveServerRoute[];

  /**
   * TLS settings for HTTPS listen.
   */
  ssl: LiveServerSslSettings;
}

/**
 * A saved Harbor Live Server config in the local registry.
 */
export interface LiveServer {
  /**
   * Database primary key.
   */
  id: number;

  /**
   * Stable portable identifier.
   */
  uuid: string;

  /**
   * Display name.
   */
  name: string;

  /**
   * Absolute path to the directory served as the document root.
   */
  root: string;

  /**
   * Explicit listen port, or null to auto-select.
   */
  port: number | null;

  /**
   * Path aliases mounted before the document root.
   */
  aliases: LiveServerAlias[];

  /**
   * Whether file watching is enabled when this server is started.
   */
  watch: boolean;

  /**
   * CORS middleware settings applied when the server starts.
   */
  cors: LiveServerCorsSettings;

  /**
   * Path or file opened when the Live Page starts (always leading `/`).
   */
  openPath: string;

  /**
   * When true, navigations within the origin update {@link lastOpenedPath}.
   */
  rememberLastUrl: boolean;

  /**
   * Last opened path+search+hash within the origin; null when never recorded.
   */
  lastOpenedPath: string | null;

  /**
   * Ordered directory index filenames for Express static.
   */
  indexFiles: string[];

  /**
   * Listen bind host (e.g. `127.0.0.1` or `0.0.0.0`).
   */
  host: string;

  /**
   * Custom response headers applied after CORS and before static.
   */
  headers: LiveServerResponseHeader[];

  /**
   * Ordered path routing rules applied after static miss (first match wins).
   */
  routes: LiveServerRoute[];

  /**
   * TLS settings for HTTPS listen.
   */
  ssl: LiveServerSslSettings;

  /**
   * Sort order within the Live Servers sidebar section.
   */
  sortOrder: number;

  /**
   * Unix timestamp (ms) when the row was created.
   */
  createdAt: number;

  /**
   * Unix timestamp (ms) when the row was last updated.
   */
  updatedAt: number;
}

/**
 * Input for creating a saved Harbor Live Server.
 */
export interface CreateLiveServerInput {
  /**
   * Display name for the saved server.
   */
  name: string;

  /**
   * Absolute path to the directory served as the document root.
   */
  root: string;

  /**
   * Explicit listen port, or null to auto-select.
   */
  port?: number | null;

  /**
   * Path aliases to persist.
   */
  aliases?: LiveServerAlias[];

  /**
   * Whether file watching is enabled when started. Defaults to true.
   */
  watch?: boolean;

  /**
   * CORS settings to persist.
   */
  cors?: LiveServerCorsSettings;

  /**
   * Entry / open path. Defaults to `/`.
   */
  openPath?: string;

  /**
   * Whether to remember the last opened URL. Defaults to false.
   */
  rememberLastUrl?: boolean;

  /**
   * Last opened path+search+hash, or null. Defaults to null.
   */
  lastOpenedPath?: string | null;

  /**
   * Directory index filenames. Defaults to `['index.html']`.
   */
  indexFiles?: string[];

  /**
   * Listen bind host. Defaults to `127.0.0.1`.
   */
  host?: string;

  /**
   * Custom response headers. Defaults to `[]`.
   */
  headers?: LiveServerResponseHeader[];

  /**
   * Path routing rules. Defaults to `[]`.
   */
  routes?: LiveServerRoute[];

  /**
   * TLS settings.
   */
  ssl?: LiveServerSslSettings;
}

/**
 * Input for updating a saved Harbor Live Server.
 *
 * Does not restart a running instance; stop and start again to apply changes.
 */
export interface UpdateLiveServerInput {
  /**
   * Database primary key of the server to update.
   */
  id: number;

  /**
   * Display name for the saved server.
   */
  name: string;

  /**
   * Absolute path to the directory served as the document root.
   */
  root: string;

  /**
   * Explicit listen port, or null to auto-select.
   */
  port: number | null;

  /**
   * Path aliases to persist.
   */
  aliases: LiveServerAlias[];

  /**
   * Whether file watching is enabled when started.
   */
  watch: boolean;

  /**
   * CORS settings to persist.
   */
  cors: LiveServerCorsSettings;

  /**
   * Entry / open path relative to the server origin.
   */
  openPath: string;

  /**
   * Whether to remember the last opened URL.
   */
  rememberLastUrl: boolean;

  /**
   * Last opened path+search+hash within the origin, or null.
   */
  lastOpenedPath: string | null;

  /**
   * Directory index filenames.
   */
  indexFiles: string[];

  /**
   * Listen bind host.
   */
  host: string;

  /**
   * Custom response headers.
   */
  headers: LiveServerResponseHeader[];

  /**
   * Path routing rules.
   */
  routes: LiveServerRoute[];

  /**
   * TLS settings.
   */
  ssl: LiveServerSslSettings;
}

/**
 * Input for starting a Harbor Live Server instance.
 *
 * Provide `savedId` to start from a persisted config (config optional override),
 * or provide `config` alone for an ad-hoc run. Does not open a browser tab;
 * use {@link PluginContext.webpage} when the `browser` permission is granted.
 */
export interface StartLiveServerInput {
  /**
   * Optional runtime instance id; generated when omitted.
   */
  id?: string;

  /**
   * Saved `live_servers.id` when starting from a persisted config.
   */
  savedId?: number | null;

  /**
   * Server configuration for this run. Required when `savedId` is omitted.
   */
  config?: LiveServerConfig;
}

/**
 * A currently running Harbor Live Server instance.
 */
export interface RunningLiveServer {
  /**
   * Runtime instance id (uuid), distinct from a saved server id.
   */
  id: string;

  /**
   * Saved `live_servers.id` when started from a saved config.
   */
  savedId: number | null;

  /**
   * Configuration used for this run.
   */
  config: LiveServerConfig;

  /**
   * Assigned listen port after the server is accepting connections.
   */
  port: number;

  /**
   * Origin string such as `http://127.0.0.1:5500`.
   */
  origin: string;

  /**
   * Unix timestamp (ms) when the instance started.
   */
  startedAt: number;

  /**
   * When true, file watching was requested but could not be started.
   */
  watchUnavailable?: boolean;
}

/**
 * One Express access-log line from a running Harbor Live Server.
 */
export interface LiveServerRequestLogEntry {
  /**
   * Runtime instance id of the server that handled the request.
   */
  id: string;

  /**
   * Saved `live_servers.id` when the instance was started from a saved config.
   */
  savedId: number | null;

  /**
   * Unix timestamp (ms) when the request was received.
   */
  timestamp: number;

  /**
   * HTTP method (e.g. `GET`).
   */
  method: string;

  /**
   * Request URL path including query string.
   */
  url: string;

  /**
   * HTTP response status code.
   */
  statusCode: number;

  /**
   * Time from request start to response finish/close, in milliseconds.
   */
  durationMs: number;

  /**
   * Response `Content-Length` when present and numeric; otherwise null.
   */
  contentLength: number | null;
}

/**
 * Query used to read or clear buffered request logs for one running instance.
 */
export type LiveServerLogsQuery = { savedId: number } | { id: string };

/**
 * Query used to stop a running Harbor Live Server or read its status.
 */
export type LiveServerInstanceQuery = { savedId: number } | { id: string };

/**
 * Options for {@link PluginLiveServers.getLogs}.
 */
export type LiveServerGetLogsQuery = LiveServerLogsQuery & {
  /**
   * Maximum number of trailing log lines to return (default 100, max 1000).
   */
  limit?: number;
};

/**
 * Harbor Live Server APIs available on {@link PluginContext.liveServers}.
 *
 * Requires the `live-server` permission. Saved-config mutations do not start,
 * stop, or restart running instances.
 */
export interface PluginLiveServers {
  /**
   * Lists all saved live servers from the local registry.
   *
   * @returns Saved live server rows.
   */
  list(): Promise<LiveServer[]>;

  /**
   * Returns one saved live server by database id or uuid.
   *
   * @param idOrUuid - Numeric id or uuid string.
   * @returns The saved server, or null when not found.
   */
  get(idOrUuid: number | string): Promise<LiveServer | null>;

  /**
   * Creates a saved live server and returns the new row.
   *
   * @param input - Name, root, and optional port/aliases/watch/cors.
   * @returns The created saved server.
   */
  create(input: CreateLiveServerInput): Promise<LiveServer>;

  /**
   * Updates a saved live server and returns the refreshed row.
   *
   * Does not restart a running instance.
   *
   * @param input - Full update payload including id.
   * @returns The updated saved server.
   */
  update(input: UpdateLiveServerInput): Promise<LiveServer>;

  /**
   * Deletes a saved live server.
   *
   * Does not stop a running instance that was started from this saved id.
   *
   * @param id - Database primary key.
   */
  delete(id: number): Promise<void>;

  /**
   * Starts a live server from a saved id and/or an ad-hoc config.
   *
   * Does not open a browser tab. Returns the running instance (loopback only).
   *
   * @param input - `savedId` and/or `config` (config required without savedId).
   * @returns The running instance with assigned port and origin.
   */
  start(input: StartLiveServerInput): Promise<RunningLiveServer>;

  /**
   * Stops one running live server by runtime id or saved id.
   *
   * @param query - Runtime `id` or `savedId`.
   */
  stop(query: LiveServerInstanceQuery): Promise<void>;

  /**
   * Lists currently running live server instances.
   *
   * @returns Running instances in start order.
   */
  listRunning(): Promise<RunningLiveServer[]>;

  /**
   * Returns the running status for one instance, or null when not running.
   *
   * @param query - Runtime `id` or `savedId`.
   * @returns The running instance, or null.
   */
  getStatus(query: LiveServerInstanceQuery): Promise<RunningLiveServer | null>;

  /**
   * Returns buffered Express request logs for a running live server.
   *
   * @param query - Runtime `id` or `savedId`, plus optional `limit`.
   * @returns Trailing access-log entries (empty when not running).
   */
  getLogs(query: LiveServerGetLogsQuery): Promise<LiveServerRequestLogEntry[]>;

  /**
   * Clears the in-memory request log buffer for a running live server.
   *
   * @param query - Runtime `id` or `savedId`.
   */
  clearLogs(query: LiveServerLogsQuery): Promise<void>;

  /**
   * Subscribes to running-server list changes (start/stop).
   *
   * @param listener - Called with the refreshed running list.
   * @returns A {@link Disposable} that removes the listener.
   */
  onRunningChanged(listener: (running: RunningLiveServer[]) => void): Disposable;

  /**
   * Subscribes to Express request log lines from running live servers.
   *
   * @param listener - Called for each completed request.
   * @returns A {@link Disposable} that removes the listener.
   */
  onRequestLog(listener: (entry: LiveServerRequestLogEntry) => void): Disposable;
}

/**
 * Config for {@link PluginAi.registerChatPointer}.
 */
export interface PluginChatPointerConfig {
  /**
   * Pointer id segment in `@plugin.<pluginId>.<id>.<key>`.
   *
   * Must match `[a-z][a-z0-9-]*`.
   */
  id: string;

  /**
   * Static rules merged into the agent system prompt while the plugin is loaded.
   */
  agentGuidance?: string;
}

/**
 * Input for {@link PluginAi.copyToChat}.
 */
export interface PluginCopyToChatInput {
  /**
   * Pointer id previously registered with {@link PluginAi.registerChatPointer}.
   */
  pointerId: string;

  /**
   * Opaque key segment after the pointer id (no spaces). Host builds the full token.
   */
  key: string;

  /**
   * Badge label shown in the AI composer and message bubbles.
   */
  label: string;

  /**
   * Text inlined into the send-time ephemeral system message for the agent.
   */
  context: string;

  /**
   * Optional character-range selection appended as `#start.end` on the token.
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
 * Live DOM helpers on a webpage handle from {@link PluginContext.webpage}.
 *
 * Requires the `browser` permission.
 */
export interface PluginWebpageDom {
  /**
   * Queries the live page DOM with a CSS selector.
   *
   * @param selector - CSS selector.
   * @param options - Optional `{ all, maxElements }`.
   * @returns Match count and element summaries.
   */
  query(
    selector: string,
    options?: { all?: boolean; maxElements?: number }
  ): Promise<{ selector: string; matchCount: number; elements: unknown[] }>;

  /**
   * Evaluates JavaScript in the page main world and returns the result.
   *
   * @param expression - JavaScript source that returns a JSON-serializable value.
   * @returns Evaluation result.
   */
  evaluate(expression: string): Promise<unknown>;

  /**
   * Injects and runs JavaScript source in the page main world.
   *
   * @param source - JavaScript source to inject.
   * @returns Evaluation result from the injected script.
   */
  injectScript(source: string): Promise<unknown>;

  /**
   * Injects a CSS stylesheet into the page.
   *
   * @param css - Stylesheet source.
   * @returns Electron insertion key.
   */
  injectStylesheet(css: string): Promise<string>;
}

/**
 * Handle returned by {@link PluginContext.webpage} for an embedded browser tab.
 *
 * Requires the `browser` permission. Same semantics as request-script `hc.webpage`.
 */
export interface PluginWebpageHandle {
  readonly tabId: string;
  readonly url: string;
  readonly title: string;
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
  readonly dom: PluginWebpageDom;

  /**
   * Focuses this browser tab in the tab bar.
   */
  focus(): Promise<void>;

  /**
   * Closes this browser tab. Returns false when the user cancels a leave prompt.
   */
  close(): Promise<boolean>;

  /**
   * Captures the visible viewport as PNG and writes it under an allowlisted path.
   *
   * Relative paths resolve against the plugin package directory. Requires the
   * `filesystem:write` permission in addition to `browser`. Pass
   * `{ fullPage: true }` to scroll-and-stitch the full document.
   *
   * @param path - Relative (plugin root) or absolute allowlisted path.
   * @param options - Optional `{ fullPage }` (default false).
   * @returns Absolute path of the written PNG.
   */
  screenshot(path: string, options?: { fullPage?: boolean }): Promise<{ path: string }>;
}

/**
 * AI chat pointer APIs available on {@link PluginContext.ai}.
 *
 * Requires the `ai` permission. Registrations are activation-scoped.
 */
export interface PluginAi {
  /**
   * Registers a namespaced `@plugin.<pluginId>.<id>.…` chat pointer kind.
   *
   * @param config - Pointer id and optional static agent guidance.
   * @returns A {@link Disposable} that unregisters the pointer when disposed.
   */
  registerChatPointer(config: PluginChatPointerConfig): Disposable;

  /**
   * Opens the AI sidebar and queues a plugin `@` badge token with a context snapshot.
   *
   * @param input - Pointer id, key, label, and context text captured by the plugin.
   */
  copyToChat(input: PluginCopyToChatInput): Promise<void>;
}

/**
 * **File → Import** handler registration available on {@link PluginContext.imports}.
 *
 * Requires the `ui` permission. Returned disposables are tracked automatically by the host.
 */
export interface PluginImports {
  /**
   * Registers a handler for one or more file extensions.
   *
   * Extensions may include or omit a leading dot; they are normalized to lowercase
   * with a dot prefix. Handlers run in registration order. The first handler whose
   * `canImport` returns true receives the file.
   *
   * @param extensions - File extensions such as `.json`, `yaml`, or `['.yaml', '.yml']`.
   * @param handler - Import detection and execution callbacks.
   * @returns A {@link Disposable} that unregisters the handler when disposed.
   */
  registerHandler(extensions: string | string[], handler: ImportHandler): Disposable;
}

/**
 * Options for picking a file through {@link PluginFs.pickFile}.
 */
export interface PluginFsPickFileOptions {
  /**
   * Dialog title.
   */
  title?: string;

  /**
   * File extension filters.
   */
  filters?: Array<{ name: string; extensions: string[] }>;

  /**
   * Allow multiple file selection.
   */
  multiple?: boolean;
}

/**
 * Options for saving a file through {@link PluginFs.saveFile}.
 */
export interface PluginFsSaveFileOptions {
  /**
   * Suggested file name or path.
   */
  defaultPath?: string;

  /**
   * File extension filters.
   */
  filters?: Array<{ name: string; extensions: string[] }>;
}

/**
 * Plugin-scoped filesystem access backed by main-process permission checks and a
 * per-plugin path allowlist.
 *
 * Requires `filesystem:pick` for open/save dialogs, `filesystem:read` for
 * {@link PluginFs.readFile}, and `filesystem:write` for {@link PluginFs.writeFile}.
 * User-selected paths from pick/save dialogs are added to the allowlist automatically;
 * the plugin package directory is allowlisted on load.
 */
export interface PluginFs {
  /**
   * Opens a native file picker. Returns absolute paths for selected files, or an
   * empty array when the dialog is canceled. Requires the `filesystem:pick` permission.
   *
   * @param options - Optional dialog configuration.
   */
  pickFile: (options?: PluginFsPickFileOptions) => Promise<string[]>;

  /**
   * Opens a native directory picker. Returns the selected directory path, or `null`
   * when canceled. Requires the `filesystem:pick` permission.
   *
   * @param defaultPath - Optional starting directory.
   */
  pickDirectory: (defaultPath?: string) => Promise<string | null>;

  /**
   * Opens a native save dialog and writes content to the chosen path. Returns the
   * saved path, or `null` when canceled. Requires `filesystem:pick` and
   * `filesystem:write` permissions.
   *
   * @param content - UTF-8 text to write.
   * @param options - Optional dialog configuration.
   */
  saveFile: (content: string, options?: PluginFsSaveFileOptions) => Promise<string | null>;

  /**
   * Reads a UTF-8 text file from an allowlisted path. Requires the `filesystem:read`
   * permission.
   *
   * @param path - Absolute path on the allowlist.
   */
  readFile: (path: string) => Promise<string>;

  /**
   * Writes UTF-8 text to an allowlisted path. Requires the `filesystem:write`
   * permission.
   *
   * @param path - Absolute path on the allowlist.
   * @param content - UTF-8 text to write.
   */
  writeFile: (path: string, content: string) => Promise<void>;

  /**
   * Writes binary bytes to an allowlisted path. Relative paths resolve under the
   * plugin package directory. Requires the `filesystem:write` permission.
   *
   * @param path - Relative (plugin root) or absolute allowlisted path.
   * @param bytes - Binary payload to write.
   * @returns Absolute path written.
   */
  writeBytes: (path: string, bytes: Uint8Array) => Promise<string>;

  /**
   * Watches an allowlisted file for changes and invokes the listener when the file
   * is modified. Requires the `filesystem:read` permission. Returns a {@link Disposable}
   * that stops watching when disposed.
   *
   * @param path - Absolute path on the allowlist.
   * @param listener - Called with the normalized path after a debounced change event.
   */
  watchFile: (path: string, listener: (path: string) => void) => Disposable;
}

// ---------------------------------------------------------------------------
// UI registration API
// ---------------------------------------------------------------------------

/**
 * UI contribution registration and feedback APIs available on {@link PluginContext.ui}.
 *
 * All `register*` methods require the `ui` permission, return a {@link Disposable},
 * and require contribution ids that match `manifest.contributes.*` entries.
 * Returned disposables are tracked automatically by the host.
 */
export interface PluginUi {
  /**
   * Registers a Settings panel alongside built-in sections (General, Storage, etc.).
   *
   * Manifest: `contributes.settingsSections` — `section.id` must match an entry there.
   *
   * @param section - Settings section contribution.
   * @returns A {@link Disposable} that unregisters the section when disposed.
   */
  registerSettingsSection(section: SettingsSectionContribution): Disposable;

  /**
   * Registers a switchable left sidebar destination.
   *
   * Manifest: `contributes.sidebarPanels` — `panel.id` must match an entry there.
   *
   * @param panel - Sidebar panel contribution.
   * @returns A {@link Disposable} that unregisters the panel when disposed.
   */
  registerSidebarPanel(panel: SidebarPanelContribution): Disposable;

  /**
   * Registers an activity-rail icon that opens a sidebar body when selected.
   *
   * Manifest: `contributes.sidebarRailItems` — `item.id` must match an entry there.
   * Distinct from {@link PluginUi.registerSidebarPanel} (horizontal switcher).
   *
   * @param item - Sidebar rail item contribution.
   * @returns A {@link Disposable} that unregisters the rail item when disposed.
   */
  registerSidebarRailItem(item: SidebarRailItemContribution): Disposable;

  /**
   * Adds a collapsible block inside the scrollable sidebar.
   *
   * Manifest: `contributes.sidebarSections` — `section.id` must match an entry there.
   *
   * @param section - Sidebar section contribution.
   * @returns A {@link Disposable} that unregisters the section when disposed.
   */
  registerSidebarSection(section: SidebarSectionContribution): Disposable;

  /**
   * Registers a full main-area overlay replacing the request editor while open.
   *
   * Manifest: `contributes.mainViews` — `view.id` must match an entry there.
   *
   * @param view - Main view contribution.
   * @returns A {@link Disposable} that unregisters the view when disposed.
   */
  registerMainView(view: MainViewContribution): Disposable;

  /**
   * Registers modal content shown in a host overlay webview above the application.
   *
   * Manifest: `contributes.modals` — `modal.id` must match an entry there.
   *
   * @param modal - Modal contribution.
   * @returns A {@link Disposable} that unregisters the modal when disposed.
   */
  registerModal(modal: ModalContribution): Disposable;

  /**
   * Opens a registered modal in the host overlay webview.
   *
   * @param modalId - Manifest modal contribution id.
   * @param context - Optional serializable context passed to the modal component.
   */
  openModal(modalId: string, context?: unknown): void;

  /**
   * Closes an open host overlay modal.
   *
   * @param modalId - Manifest modal contribution id.
   */
  closeModal(modalId: string): void;

  /**
   * Adds a segmented tab to the request editor.
   *
   * Manifest: `contributes.requestTabs` — `tab.id` must match an entry there.
   *
   * @param tab - Request tab contribution.
   * @returns A {@link Disposable} that unregisters the tab when disposed.
   */
  registerRequestTab(tab: RequestTabContribution): Disposable;

  /**
   * Adds a tab to the response viewer.
   *
   * Manifest: `contributes.responseTabs` — `tab.id` must match an entry there.
   *
   * @param tab - Response tab contribution.
   * @returns A {@link Disposable} that unregisters the tab when disposed.
   */
  registerResponseTab(tab: ResponseTabContribution): Disposable;

  /**
   * Adds a segmented tab to Collection Settings.
   *
   * Manifest: `contributes.collectionSettingsTabs` — `tab.id` must match an entry there.
   *
   * @param tab - Collection settings tab contribution.
   * @returns A {@link Disposable} that unregisters the tab when disposed.
   */
  registerCollectionSettingsTab(tab: CollectionSettingsTabContribution): Disposable;

  /**
   * Registers a slide-up footer panel.
   *
   * Manifest: `contributes.footerPanels` — `panel.id` must match an entry there.
   *
   * @param panel - Footer panel contribution.
   * @returns A {@link Disposable} that unregisters the panel when disposed.
   */
  registerFooterPanel(panel: FooterPanelContribution): Disposable;

  /**
   * Sets or clears the native status dot beside a registered footer panel toggle.
   *
   * The host renders a {@link StatusDot}-style indicator; plugins do not mount
   * their own indicator webview. Call from the agent (always-on) renderer after
   * registering the panel, and again whenever status changes.
   *
   * Manifest: `contributes.footerPanels` — `panelId` must match an entry there.
   *
   * @param panelId - Manifest footerPanels id.
   * @param state - Indicator status, or `null` to hide the dot.
   */
  setFooterPanelIndicator(panelId: string, state: FooterPanelIndicatorState | null): void;

  /**
   * Adds an item to an application menu.
   *
   * Manifest: `contributes.menus` plus a matching `contributes.commands` entry.
   *
   * @param item - Menu item contribution.
   * @returns A {@link Disposable} that unregisters the menu item when disposed.
   */
  registerMenuItem(item: MenuItemContribution): Disposable;

  /**
   * Adds a button to the request URL bar toolbar.
   *
   * Manifest: `contributes.requestToolbarActions` plus a matching `contributes.commands` entry.
   *
   * @param action - Toolbar action contribution.
   * @returns A {@link Disposable} that unregisters the action when disposed.
   */
  registerRequestToolbarAction(action: RequestToolbarActionContribution): Disposable;

  /**
   * Adds an icon button to each script row in the pre/post request script editor.
   *
   * Manifest: `contributes.scriptEditorActions` plus a matching `contributes.commands` entry.
   *
   * @param action - Script editor action contribution.
   * @returns A {@link Disposable} that unregisters the action when disposed.
   */
  registerScriptEditorAction(action: ScriptEditorActionContribution): Disposable;

  /**
   * Adds a button to the right of Save in the workflow play/edit toolbar.
   *
   * Manifest: `contributes.workflowToolbarActions` plus a matching `contributes.commands` entry.
   *
   * @param action - Toolbar action contribution.
   * @returns A {@link Disposable} that unregisters the action when disposed.
   */
  registerWorkflowToolbarAction(action: WorkflowToolbarActionContribution): Disposable;

  /**
   * Renders a HostedSurface inside matching workflow timeline action blocks.
   *
   * Manifest: `contributes.workflowActionBlocks` — `block.id` must match an entry there.
   *
   * @param block - Action block contribution.
   * @returns A {@link Disposable} that unregisters the block when disposed.
   */
  registerWorkflowActionBlock(block: WorkflowActionBlockContribution): Disposable;

  /**
   * Adds an action to sidebar row context menus.
   *
   * Manifest: `contributes.contextMenus` plus a matching `contributes.commands` entry.
   *
   * @param item - Context menu item contribution.
   * @returns A {@link Disposable} that unregisters the menu item when disposed.
   */
  registerContextMenuItem(item: ContextMenuItemContribution): Disposable;

  /**
   * Adds a custom status indicator to the footer bar.
   *
   * Manifest: `contributes.statusBarItems` — `item.id` must match an entry there.
   *
   * @param item - Status bar item contribution.
   * @returns A {@link Disposable} that unregisters the item when disposed.
   */
  registerStatusBarItem(item: StatusBarItemContribution): Disposable;

  /**
   * Shows a non-blocking toast for success or info feedback.
   *
   * Do not use toasts for errors that require acknowledgment — show those inline
   * in your plugin UI instead.
   *
   * @param message - Text shown in the toast.
   * @param options - Optional display options.
   * @param options.duration - Display duration in milliseconds.
   */
  showToast(message: string, options?: { duration?: number }): void;
}

// ---------------------------------------------------------------------------
// Host request commands
// ---------------------------------------------------------------------------

/**
 * Serializable query parameter captured from a sent request.
 */
export interface OpenRequestDraftParam {
  /**
   * Query parameter name.
   */
  key: string;

  /**
   * Query parameter value after variable substitution.
   */
  value: string;
}

/**
 * Serializable request draft payload passed to {@link PluginHost.openRequestDraft}.
 *
 * Opens a new request editor tab seeded with captured send metadata.
 */
export interface OpenRequestDraftPayload {
  /**
   * Tab title for the new draft. Defaults to "Recent Request" when omitted.
   */
  name?: string;

  /**
   * HTTP method (for example `GET`, `POST`).
   */
  method?: string;

  /**
   * Request URL including scheme, host, path, and query string.
   */
  url?: string;

  /**
   * Outgoing request headers as a flat key/value map.
   */
  headers?: Record<string, string>;

  /**
   * Enabled query parameters from the sent request.
   */
  params?: OpenRequestDraftParam[];

  /**
   * Request body content as a string.
   */
  body?: string;

  /**
   * Request body encoding. Defaults to `text` when body is non-empty, otherwise `none`.
   */
  bodyType?: BodyType;
}

/**
 * Payload for {@link PluginHost.openImageView}.
 *
 * Exactly one source form must be provided: a local filesystem `path`, an
 * `http(s)` `url`, an inline `dataUrl`, or `base64` with `contentType`.
 */
export type OpenImageViewPayload =
  | {
      /**
       * Absolute path to a local image file.
       */
      path: string;
      /**
       * Optional display filename; defaults to the path basename.
       */
      fileName?: string;
    }
  | {
      /**
       * Remote image URL loaded directly by the viewer.
       */
      url: string;
      /**
       * Optional display filename; defaults to the last URL path segment.
       */
      fileName?: string;
    }
  | {
      /**
       * Full `data:` URL for an inline image.
       */
      dataUrl: string;
      /**
       * Display filename shown in the tab header.
       */
      fileName: string;
    }
  | {
      /**
       * Base64-encoded image bytes (with or without a `data:` prefix).
       */
      base64: string;
      /**
       * MIME type used when building a data URL from {@link base64}.
       */
      contentType: string;
      /**
       * Display filename shown in the tab header.
       */
      fileName: string;
    };

/**
 * Serializable payload passed to {@link PluginHost.applyRequestDraft}.
 *
 * Updates the active request editor tab in place. Provided fields replace the
 * corresponding draft values (headers and params are replaced entirely when set).
 */
export interface ApplyRequestDraftPayload {
  /**
   * HTTP method (for example `GET`, `POST`).
   */
  method?: string;

  /**
   * Request URL including scheme, host, path, and query string.
   */
  url?: string;

  /**
   * Outgoing request headers as a flat key/value map. Replaces the current headers table.
   */
  headers?: Record<string, string>;

  /**
   * Enabled query parameters. Replaces the current params table.
   */
  params?: OpenRequestDraftParam[];

  /**
   * Request body content as a string.
   */
  body?: string;

  /**
   * Request body encoding. Defaults to `text` when body is non-empty, otherwise `none`.
   */
  bodyType?: BodyType;
}

/**
 * A single saved request to create when bulk-importing a collection from a plugin.
 */
export interface CreateCollectionRequest {
  /**
   * Display name for the saved request.
   */
  name: string;

  /**
   * HTTP method (for example `GET`, `POST`). Defaults to `GET` when omitted or invalid.
   */
  method?: string;

  /**
   * Request URL including scheme, host, path, and query string.
   */
  url?: string;

  /**
   * Outgoing request headers as a flat key/value map.
   */
  headers?: Record<string, string>;

  /**
   * Enabled query parameters for the request.
   */
  params?: OpenRequestDraftParam[];

  /**
   * Request body content as a string.
   */
  body?: string;

  /**
   * Request body encoding. Defaults to `text` when body is non-empty, otherwise `none`.
   */
  bodyType?: BodyType;

  /**
   * Folder name within the new collection. When omitted, the request is created at the collection root.
   */
  folder?: string;

  /**
   * Free-form notes stored on the saved request.
   */
  comment?: string;
}

/**
 * Payload for {@link PluginHost.createCollection} — bulk-creates a collection with folders and requests.
 */
export interface CreateCollectionPayload {
  /**
   * Display name for the new collection.
   */
  name: string;

  /**
   * Saved requests to create inside the collection.
   */
  requests: CreateCollectionRequest[];
}

/**
 * Result returned after bulk-creating a collection from plugin-provided requests.
 */
export interface CreateCollectionResult {
  /**
   * Database id of the new collection.
   */
  collectionId: number;
}

/**
 * Renderer-side HTTP lifecycle events for reacting to completed sends in the UI.
 *
 * Requires the `http` permission. Returned disposables are tracked automatically by the host.
 */
export interface PluginRendererHttp {
  /**
   * Registers a callback that runs after a request completes in the renderer.
   *
   * Fires for every successful send in the active renderer window — no main entry,
   * custom IPC channel, or polling required.
   *
   * @param handler - Called with the sent request snapshot and response payload.
   * @returns A {@link Disposable} that unregisters the handler when disposed.
   */
  onAfterSend(
    handler: (request: PluginHttpRequest, response: PluginHttpResponse) => void | Promise<void>
  ): Disposable;
}

/**
 * Renderer-side RPC into the plugin's main entry.
 *
 * Mirrors {@link PluginIpc.handle} on the main side. Requires the `ipc` permission.
 * The host auto-reactivates the main runtime when it has been torn down.
 */
export interface PluginIpcInvoker {
  /**
   * Invokes a handler registered with {@link PluginIpc.handle} in the main entry.
   *
   * @param channel - Channel name unique within this plugin.
   * @param args - Arguments forwarded to the main handler.
   * @returns The handler return value.
   */
  invoke<T>(channel: string, ...args: unknown[]): Promise<T>;
}

/**
 * Variable row supplied by a plugin when creating or updating an environment.
 */
export interface PluginVariableInput {
  /**
   * Variable name referenced in {{key}} placeholders.
   */
  key: string;

  /**
   * Value substituted when the variable is resolved.
   */
  value: string;

  /**
   * Fallback value used when value is empty.
   */
  defaultValue?: string;

  /**
   * When false, the row is ignored at resolve time. Defaults to true when omitted.
   */
  enabled?: boolean;

  /**
   * When true, value is included in collection exports.
   */
  share?: boolean;
}

/**
 * Result returned after creating an environment from plugin-provided variables.
 */
export interface CreatedEnvironmentResult {
  /**
   * Database id of the new environment.
   */
  id: number;

  /**
   * Trimmed display name persisted for the environment.
   */
  name: string;
}

/**
 * Options for library list APIs that can include archived collections.
 */
export interface LibraryListOptions {
  /**
   * When true, include archived collections. Defaults to false (active only).
   */
  includeArchived?: boolean;
}

/**
 * Lightweight collection row for sidebar trees and discovery.
 */
export interface CollectionSummary {
  /** Database id. */
  id: number;
  /** Stable portable identifier. */
  uuid: string;
  /** Display name. */
  name: string;
  /** Optional sidebar marker color. */
  marker?: string | null;
  /** ISO 8601 creation timestamp. */
  created_at: string;
  /** Storage connection id when the collection is remote-backed. */
  connectionId?: string;
  /** When true, the collection is archived. */
  archived?: boolean;
  /** When true on a team hub collection, non-admins cannot delete it. */
  deletion_locked?: boolean;
}

/**
 * Lightweight folder row for sidebar trees.
 */
export interface FolderSummary {
  /** Database id. */
  id: number;
  /** Stable portable identifier. */
  uuid: string;
  /** Parent collection id. */
  collection_id: number;
  /** Parent folder id, or null at collection root. */
  parent_folder_id: number | null;
  /** Display name. */
  name: string;
  /** Sibling sort order. */
  sort_order: number;
  /** Optional sidebar marker color. */
  marker?: string | null;
  /** ISO 8601 creation timestamp. */
  created_at: string;
}

/**
 * Lightweight saved-request row for sidebar trees (no body/auth).
 */
export interface SavedRequestSummary {
  /** Database id. */
  id: number;
  /** Stable portable identifier. */
  uuid: string;
  /** Parent collection id. */
  collection_id: number;
  /** Parent folder id, or null at collection root. */
  folder_id: number | null;
  /** Display name. */
  name: string;
  /** HTTP method. */
  method: HttpMethod;
  /** Sibling sort order. */
  sort_order: number;
  /** Optional sidebar marker color. */
  marker?: string | null;
  /** ISO 8601 creation timestamp. */
  created_at: string;
}

/**
 * Lightweight markdown document row for sidebar trees (no content body).
 */
export interface DocumentSummary {
  /** Database id. */
  id: number;
  /** Stable portable identifier. */
  uuid: string;
  /** Parent collection id. */
  collection_id: number;
  /** Parent folder id, or null at collection root. */
  folder_id: number | null;
  /** Display file name. */
  name: string;
  /** Sibling sort order. */
  sort_order: number;
  /** Optional sidebar marker color. */
  marker?: string | null;
  /** ISO 8601 creation timestamp. */
  created_at: string;
  /** ISO 8601 last-updated timestamp. */
  updated_at: string;
}

/**
 * One collection node in a {@link LibraryTreeSnapshot}, including nested contents.
 */
export interface LibraryTreeCollectionNode extends CollectionSummary {
  /** Folders in this collection (flat list; nest via parent_folder_id). */
  folders: FolderSummary[];
  /** Saved requests in this collection (flat list; nest via folder_id). */
  requests: SavedRequestSummary[];
  /** Markdown documents in this collection (flat list; nest via folder_id). */
  documents: DocumentSummary[];
}

/**
 * Full library snapshot suitable for building a custom collections sidebar tree.
 */
export interface LibraryTreeSnapshot {
  /** Collections with nested folder/request/document summaries. */
  collections: LibraryTreeCollectionNode[];
  /**
   * Warnings when one or more storage backends failed while listing collections.
   * The snapshot may be incomplete when non-empty.
   */
  warnings: string[];
}

/**
 * Coarse reason for a {@link LibraryChangedEvent}.
 */
export type LibraryChangedReason = 'collections' | 'folders' | 'requests' | 'documents';

/**
 * Coarse invalidation signal so plugins can refetch library data without polling.
 */
export interface LibraryChangedEvent {
  /** Which library slice changed. */
  reason: LibraryChangedReason;
  /** Collection id for per-collection reasons; omitted for `collections`. */
  collectionId?: number;
}

/**
 * Coarse reason for a {@link WorkflowsChangedEvent}.
 */
export type WorkflowsChangedReason = 'created' | 'updated' | 'renamed' | 'deleted' | 'refreshed';

/**
 * Coarse invalidation signal so plugins can refetch workflows without polling.
 */
export interface WorkflowsChangedEvent {
  /** Which workflow mutation occurred. */
  reason: WorkflowsChangedReason;
  /** Workflow database id when the change targets one row. */
  workflowId?: number;
}

/**
 * Full workflow row returned by {@link PluginHost} workflow CRUD methods.
 */
export interface HostWorkflow {
  /** Database primary key. */
  id: number;
  /** Stable portable identifier for export/import. */
  uuid: string;
  /** Display name shown in the sidebar. */
  name: string;
  /** Accumulated recording duration in milliseconds. */
  durationMs: number;
  /** Pause between consecutive actions during playback, in milliseconds. */
  delayMs: number;
  /** Workflow-scoped variables for parameterization. */
  variables: Record<string, string>;
  /** Ordered recorded actions. */
  actions: WorkflowActionRef[];
  /** Creation timestamp in milliseconds since epoch. */
  createdAt: number;
  /** Last update timestamp in milliseconds since epoch. */
  updatedAt: number;
}

/**
 * Payload for {@link PluginHost.createWorkflow}.
 */
export interface CreateWorkflowPayload {
  /** Display name for the workflow. */
  name: string;
  /** Optional portable uuid; generated when omitted. */
  uuid?: string;
  /** Accumulated recording duration in milliseconds. */
  durationMs: number;
  /** Optional pause between consecutive actions during playback, in milliseconds. */
  delayMs?: number;
  /** Optional workflow variables; defaults to an empty object. */
  variables?: Record<string, string>;
  /** Ordered recorded actions to persist. */
  actions: WorkflowActionRef[];
}

/**
 * Payload for {@link PluginHost.updateWorkflow} — replaces actions and duration.
 *
 * Name and variables are preserved. Use {@link PluginHost.renameWorkflow} to rename.
 */
export interface UpdateWorkflowPayload {
  /** Database primary key of the workflow to update. */
  id: number;
  /** Ordered recorded actions to persist. */
  actions: WorkflowActionRef[];
  /** Accumulated recording duration in milliseconds. */
  durationMs: number;
  /** Pause between consecutive actions during playback, in milliseconds. */
  delayMs: number;
}

/**
 * Serializable sidebar focus/selection for replacement panels and host sync.
 *
 * Matches the host's "reveal in sidebar" navigation state: collection/folder
 * highlight plus the active request or document tab when one is open.
 */
export type SidebarSelection =
  | { kind: 'collection'; collectionId: number }
  | { kind: 'folder'; collectionId: number; folderId: number }
  | {
      kind: 'request';
      collectionId: number;
      folderId: number | null;
      requestId: number;
    }
  | {
      kind: 'document';
      collectionId: number;
      folderId: number | null;
      documentId: number;
    };

/**
 * View context pushed to `sidebarPanels` HostedSurface mounts.
 *
 * Read via `hc.view.getContext()` on panel mount; updates arrive through
 * {@link PluginHost.onSidebarSelectionChanged}.
 */
export interface SidebarPanelViewContext {
  /** Current host sidebar selection, or null when nothing is focused. */
  sidebarSelection: SidebarSelection | null;
}

/**
 * Payload for {@link PluginHost.updateCollection} — renames a collection.
 *
 * Other collection settings are preserved. Destructive host methods are silent;
 * plugins must confirm before calling delete/archive APIs.
 */
export interface UpdateCollectionInput {
  /** Collection database id. */
  id: number;
  /** New display name. */
  name: string;
}

/**
 * Payload for {@link PluginHost.setCollectionArchived}.
 */
export interface SetCollectionArchivedInput {
  /** Collection database id. */
  collectionId: number;
  /** When true, archive; when false, restore from archive. */
  archived: boolean;
}

/**
 * Payload for {@link PluginHost.createFolder}.
 */
export interface CreateFolderInput {
  /** Parent collection database id. */
  collectionId: number;
  /** Display name for the new folder. */
  name: string;
  /** Parent folder id, or null/omitted for collection root. */
  parentFolderId?: number | null;
}

/**
 * Payload for {@link PluginHost.renameFolder}.
 */
export interface RenameFolderInput {
  /** Folder database id. */
  folderId: number;
  /** Parent collection database id. */
  collectionId: number;
  /** New display name. */
  name: string;
}

/**
 * Payload for {@link PluginHost.deleteFolder}.
 *
 * Deletes the folder subtree (descendant folders, requests, and documents).
 * Silent — plugins must confirm before calling.
 */
export interface DeleteFolderInput {
  /** Folder database id. */
  folderId: number;
  /** Parent collection database id. */
  collectionId: number;
}

/**
 * Payload for {@link PluginHost.moveFolder}.
 */
export interface MoveFolderInput {
  /** Parent collection database id. */
  collectionId: number;
  /** Folder database id to move. */
  folderId: number;
  /** New parent folder id, or null for collection root. */
  parentFolderId: number | null;
  /** Optional zero-based index among new siblings. */
  sortOrder?: number;
}

/**
 * Payload for {@link PluginHost.reorderFolders}.
 */
export interface ReorderFoldersInput {
  /** Parent collection database id. */
  collectionId: number;
  /** Parent folder id, or null for collection-root siblings. */
  parentFolderId: number | null;
  /** Sibling folder ids in desired order. */
  orderedFolderIds: number[];
}

/**
 * Payload for {@link PluginHost.createRequest}.
 *
 * Opens the new request in an editor tab (same as the built-in sidebar).
 */
export interface CreateRequestInput {
  /** Parent collection database id. */
  collectionId: number;
  /** Parent folder id, or null/omitted for collection root. */
  folderId?: number | null;
  /** Display name; defaults to `Untitled Request`. */
  name?: string;
  /** HTTP method; defaults to `GET`. */
  method?: HttpMethod;
  /** Request URL; defaults to empty. */
  url?: string;
}

/**
 * Payload for {@link PluginHost.moveRequest}.
 */
export interface MoveRequestInput {
  /** Parent collection database id. */
  collectionId: number;
  /** Saved request database id. */
  requestId: number;
  /** Target folder id, or null for collection root. */
  folderId: number | null;
  /**
   * Zero-based index among siblings in the target container.
   * When omitted, appends to the end.
   */
  index?: number;
}

/**
 * Payload for {@link PluginHost.reorderRequests}.
 */
export interface ReorderRequestsInput {
  /** Parent collection database id. */
  collectionId: number;
  /** Folder id, or null for collection-root requests. */
  folderId: number | null;
  /** Request ids in desired order. */
  orderedRequestIds: number[];
}

/**
 * Payload for {@link PluginHost.createDocument}.
 *
 * Does not open the document in a tab — use a later host open API for that.
 */
export interface CreateDocumentInput {
  /** Parent collection database id. */
  collectionId: number;
  /** Parent folder id, or null/omitted for collection root. */
  folderId?: number | null;
  /** Display file name. */
  name: string;
  /** Optional markdown body; defaults to empty. */
  content?: string;
}

/**
 * Payload for {@link PluginHost.renameDocument}.
 */
export interface RenameDocumentInput {
  /** Document database id. */
  id: number;
  /** Parent collection database id. */
  collectionId: number;
  /** New display file name. */
  name: string;
}

/**
 * Payload for {@link PluginHost.deleteDocument}.
 *
 * Silent — plugins must confirm before calling.
 */
export interface DeleteDocumentInput {
  /** Document database id. */
  id: number;
  /** Parent collection database id. */
  collectionId: number;
}

/**
 * Payload for {@link PluginHost.moveDocument}.
 */
export interface MoveDocumentInput {
  /** Parent collection database id. */
  collectionId: number;
  /** Document database id. */
  documentId: number;
  /** Target folder id, or null for collection root. */
  folderId: number | null;
  /**
   * Zero-based index among siblings in the target container.
   * When omitted, appends to the end.
   */
  index?: number;
}

/**
 * Payload for {@link PluginHost.reorderDocuments}.
 */
export interface ReorderDocumentsInput {
  /** Parent collection database id. */
  collectionId: number;
  /** Folder id, or null for collection-root documents. */
  folderId: number | null;
  /** Document ids in desired order. */
  orderedDocumentIds: number[];
}

/**
 * Kind of sidebar row that shares a collection root or folder container order.
 */
export type ContainerItemKind = 'request' | 'document';

/**
 * Stable reference to a request or markdown document in a shared container.
 */
export interface ContainerItemRef {
  /** Whether this entry is a saved request or a markdown document. */
  kind: ContainerItemKind;
  /** Database id of the request or document. */
  id: number;
}

/**
 * Payload for {@link PluginHost.reorderContainerItems}.
 *
 * Use this when a folder or collection root interleaves requests and documents
 * in one list. Prefer {@link ReorderRequestsInput} / {@link ReorderDocumentsInput}
 * when reordering a single entity kind.
 */
export interface ReorderContainerItemsInput {
  /** Parent collection database id. */
  collectionId: number;
  /** Folder id, or null for collection-root items. */
  folderId: number | null;
  /** Request and document refs in desired interleaved order. */
  items: ContainerItemRef[];
}

/**
 * Target for {@link PluginHost.showEntityContextMenu}.
 *
 * Matches built-in sidebar context menu targets (`collection` | `folder` | `request`).
 * Documents are not supported in v1.
 */
export type EntityContextMenuTarget =
  | { type: 'collection'; collectionId: number }
  | { type: 'folder'; collectionId: number; folderId: number }
  | { type: 'request'; requestId: number };

/**
 * Payload for {@link PluginHost.showEntityContextMenu}.
 *
 * Coordinates are local to the plugin webview viewport; the host offsets them
 * using the HostedSurface bounds. When the surface cannot be found, `x`/`y`
 * are treated as host viewport coordinates.
 */
export interface ShowEntityContextMenuInput {
  /** Entity the menu should act on. */
  target: EntityContextMenuTarget;
  /** X coordinate in the plugin webview viewport. */
  x: number;
  /** Y coordinate in the plugin webview viewport. */
  y: number;
  /** Plugin manifest id that owns the requesting surface. */
  pluginId: string;
  /** Sidebar panel contribution id mounted in the surface. */
  contributionId: string;
}

/**
 * Collection metadata returned by {@link PluginHost.getCollectionMetadata}.
 *
 * Includes settings fields plugins may read; prefer {@link CollectionSummary} for trees.
 */
export interface HostCollection extends CollectionSummary {
  /** Collection-scoped variables. */
  variables: Variable[];
  /** Collection-level headers. */
  headers: KeyValue[];
  /** User-Agent override; empty inherits the global default. */
  userAgent: string;
  /** Default Authorization settings. */
  auth: AuthConfig;
  /** Legacy single pre-request script string. */
  pre_request_script: string;
  /** Legacy single post-request script string. */
  post_request_script: string;
}

/**
 * Full saved request returned by {@link PluginHost.listCollectionRequests}.
 *
 * Prefer {@link SavedRequestSummary} when only sidebar fields are needed.
 */
export interface HostSavedRequest extends SavedRequestSummary {
  /** Request URL without query parameters. */
  url: string;
  /** Request headers. */
  headers: KeyValue[];
  /** Query parameters. */
  params: KeyValue[];
  /** Raw request body content. */
  body: string;
  /** Content type of the request body. */
  body_type: BodyType;
  /** Free-form notes. */
  comment: string;
  /** Comma-separated labels. */
  tags: string;
  /** ISO 8601 last-saved timestamp. */
  updated_at: string;
}

/**
 * Input for {@link PluginHost.sendHttpRequest}.
 */
export interface PluginSendRequestInput {
  /** HTTP method to use. */
  method: HttpMethod;
  /** Request URL without query parameters. */
  url: string;
  /** Request headers. */
  headers: KeyValue[];
  /** Query parameters. */
  params: KeyValue[];
  /** Raw request body content. */
  body: string;
  /** Content type of the request body. */
  bodyType: BodyType;
  /** Optional verbatim Raw body override. */
  bodyRaw?: string;
  /** Saved request id when the send originated from a saved tab. */
  sourceRequestId?: number;
  /** Display name when {@link sourceRequestId} is set. */
  sourceRequestName?: string;
}

/**
 * Result of {@link PluginHost.sendHttpRequest}.
 */
export interface PluginSendResult {
  /** HTTP status code, or 0 when the request failed before a response. */
  status: number;
  /** HTTP status text. */
  statusText: string;
  /** Response headers. */
  headers: Record<string, string>;
  /** Response body as text. */
  body: string;
  /**
   * Base64-encoded body for binary / non-textual responses (images, PDF, zip, etc.);
   * omitted for JSON, text-ish, and HTML-ish bodies.
   */
  bodyBase64?: string;
  /** Round-trip time in milliseconds. */
  timeMs: number;
  /** Response body size in bytes. */
  sizeBytes: number;
  /** Error message when the request failed. */
  error?: string;
}

/**
 * Typed wrappers for built-in HarborClient request editor commands.
 *
 * Requires the `ui` permission (except {@link PluginHost.sendHttpRequest}, which
 * requires `network`). Prefer these over stringly-typed
 * {@link PluginCommands.execute} for opening request tabs.
 */
export interface PluginHost {
  /**
   * Opens a new request tab seeded with captured send metadata.
   *
   * @param payload - Partial draft fields from a recent request entry.
   */
  openRequestDraft(payload: OpenRequestDraftPayload): Promise<void>;

  /**
   * Updates the active request editor tab in place with the given draft fields.
   *
   * Provided fields replace the corresponding values on the active draft.
   * When `headers` or `params` are supplied, those tables are replaced entirely
   * (not merged). Throws when there is no active request tab.
   *
   * Requires the `ui` permission.
   *
   * @param payload - Partial draft fields to apply to the active tab.
   */
  applyRequestDraft(payload: ApplyRequestDraftPayload): Promise<void>;

  /**
   * Opens a saved collection request or focuses an existing tab for it.
   *
   * Also updates host sidebar selection (collection/folder highlight) to match
   * the built-in tree click path.
   *
   * @param requestId - Saved request database id.
   */
  loadRequest(requestId: number): Promise<void>;

  /**
   * Opens a saved markdown document or focuses an existing tab for it.
   *
   * Requires the `ui` permission. Also updates host sidebar selection.
   *
   * @param documentId - Collection document database id.
   */
  loadDocument(documentId: number): Promise<void>;

  /**
   * Opens collection settings in a page tab.
   *
   * Requires the `ui` permission.
   *
   * @param collectionId - Collection database id.
   */
  openCollectionSettings(collectionId: number): Promise<void>;

  /**
   * Opens the collection runner for an entire collection.
   *
   * Requires the `ui` permission.
   *
   * @param collectionId - Collection database id.
   */
  openCollectionRunner(collectionId: number): Promise<void>;

  /**
   * Opens the share-collection modal for a collection.
   *
   * Requires the `ui` permission.
   *
   * @param collectionId - Collection database id.
   */
  openShareModal(collectionId: number): Promise<void>;

  /**
   * Opens the host's built-in entity context menu for a collection, folder, or request.
   *
   * Builds the same menu groups the built-in Collections tree would show
   * (including {@link PluginUi.registerContextMenuItem} contributions) and
   * positions the panel in the host window. Coordinates are webview-local;
   * the host maps them using the HostedSurface bounds.
   *
   * Requires the `ui` permission. Fire-and-forget — does not wait for the
   * user to dismiss the menu.
   *
   * Limitations: submenu positioning and focus return to the webview may be
   * imperfect; document targets are not supported.
   *
   * @param input - Target, coordinates, and requesting surface identity.
   */
  showEntityContextMenu(input: ShowEntityContextMenuInput): Promise<void>;

  /**
   * Returns the current host sidebar selection (collection/folder/request/document).
   *
   * Requires the `ui` permission.
   */
  getSidebarSelection(): Promise<SidebarSelection | null>;

  /**
   * Updates host sidebar selection the same way the built-in tree does.
   *
   * Selecting a request or document also opens/focuses its editor tab.
   * Passing `null` clears the collection/folder highlight.
   *
   * Requires the `ui` permission.
   *
   * @param selection - Target selection, or null to clear.
   */
  setSidebarSelection(selection: SidebarSelection | null): Promise<void>;

  /**
   * Subscribes to host sidebar selection changes (reveal-in-sidebar, tab focus, plugin sets).
   *
   * Requires the `ui` permission.
   *
   * @param listener - Called when selection changes.
   * @returns A {@link Disposable} that removes the listener when disposed.
   */
  onSidebarSelectionChanged(listener: (selection: SidebarSelection | null) => void): Disposable;

  /**
   * Sends the active request editor tab using the same pipeline as the Send button
   * (pre/post scripts, variable substitution, auth merge, and history).
   *
   * No-op when a send is already in flight for the active tab.
   */
  sendRequest(): Promise<void>;

  /**
   * Creates a new environment, populates it with variables, and selects it as active.
   *
   * @param name - Display name for the new environment.
   * @param variables - Initial variable rows.
   */
  createEnvironmentWithVariables(
    name: string,
    variables: PluginVariableInput[]
  ): Promise<CreatedEnvironmentResult>;

  /**
   * Replaces all variables on an existing environment while preserving its name.
   *
   * @param environmentId - Target environment database id.
   * @param variables - Variable rows that fully replace the current list.
   */
  updateEnvironmentVariables(
    environmentId: number,
    variables: PluginVariableInput[]
  ): Promise<void>;

  /**
   * Creates a new collection populated with folders and saved requests supplied by a plugin.
   *
   * Requests with the same {@link CreateCollectionRequest.folder} value are grouped into one folder.
   * Requests without a folder are created at the collection root.
   *
   * @param payload - Collection name and request rows to persist.
   * @returns The database id of the created collection.
   */
  createCollection(payload: CreateCollectionPayload): Promise<CreateCollectionResult>;

  /**
   * Renames a collection while preserving its other settings.
   *
   * Requires the `ui` permission. Silent — no host confirmation dialog.
   *
   * @param input - Collection id and new name.
   */
  updateCollection(input: UpdateCollectionInput): Promise<CollectionSummary>;

  /**
   * Deletes a collection (moves it to trash when supported).
   *
   * Requires the `ui` permission. Silent — plugins must confirm first.
   *
   * @param collectionId - Collection database id.
   */
  deleteCollection(collectionId: number): Promise<void>;

  /**
   * Persists a new top-level collection order in the sidebar.
   *
   * Requires the `ui` permission.
   *
   * @param orderedIds - Collection ids in desired order.
   */
  reorderCollections(orderedIds: number[]): Promise<void>;

  /**
   * Archives or un-archives a collection.
   *
   * Requires the `ui` permission. Silent — plugins must confirm before archiving.
   *
   * @param input - Collection id and archived flag.
   */
  setCollectionArchived(input: SetCollectionArchivedInput): Promise<void>;

  /**
   * Deep-copies a collection and places the duplicate below the original.
   *
   * Requires the `ui` permission.
   *
   * @param collectionId - Collection database id to duplicate.
   */
  duplicateCollection(collectionId: number): Promise<CollectionSummary>;

  /**
   * Creates a folder inside a collection (optionally nested under a parent folder).
   *
   * Requires the `ui` permission.
   *
   * @param input - Collection id, name, and optional parent folder.
   */
  createFolder(input: CreateFolderInput): Promise<FolderSummary>;

  /**
   * Renames a folder.
   *
   * Requires the `ui` permission.
   *
   * @param input - Folder id, collection id, and new name.
   */
  renameFolder(input: RenameFolderInput): Promise<FolderSummary>;

  /**
   * Deletes a folder and its subtree (descendant folders, requests, documents).
   *
   * Requires the `ui` permission. Silent — plugins must confirm first.
   *
   * @param input - Folder id and parent collection id.
   */
  deleteFolder(input: DeleteFolderInput): Promise<void>;

  /**
   * Reparents a folder and optionally inserts it at a sibling position.
   *
   * Requires the `ui` permission.
   *
   * @param input - Move target and optional sort order.
   */
  moveFolder(input: MoveFolderInput): Promise<FolderSummary>;

  /**
   * Persists a new folder order within a collection container.
   *
   * Requires the `ui` permission.
   *
   * @param input - Collection id, parent folder, and ordered sibling ids.
   */
  reorderFolders(input: ReorderFoldersInput): Promise<void>;

  /**
   * Creates a saved request and opens it in an editor tab.
   *
   * Requires the `ui` permission.
   *
   * @param input - Collection id, optional folder, and optional draft fields.
   */
  createRequest(input: CreateRequestInput): Promise<SavedRequestSummary>;

  /**
   * Deletes a saved request.
   *
   * Requires the `ui` permission. Silent — plugins must confirm first.
   *
   * @param requestId - Saved request database id.
   */
  deleteRequest(requestId: number): Promise<void>;

  /**
   * Duplicates a saved request in the same collection/folder and opens the copy.
   *
   * Requires the `ui` permission.
   *
   * @param requestId - Saved request database id to duplicate.
   */
  duplicateRequest(requestId: number): Promise<SavedRequestSummary>;

  /**
   * Moves a saved request to another folder or the collection root.
   *
   * Requires the `ui` permission.
   *
   * @param input - Request id, target folder, and optional index.
   */
  moveRequest(input: MoveRequestInput): Promise<void>;

  /**
   * Persists a new request order within a folder or collection root.
   *
   * Requires the `ui` permission.
   *
   * @param input - Collection id, folder id, and ordered request ids.
   */
  reorderRequests(input: ReorderRequestsInput): Promise<void>;

  /**
   * Creates a markdown document in a collection (optionally inside a folder).
   *
   * Does not open the document in a tab.
   *
   * Requires the `ui` permission.
   *
   * @param input - Collection id, name, and optional folder/content.
   */
  createDocument(input: CreateDocumentInput): Promise<DocumentSummary>;

  /**
   * Renames a markdown document without changing its body.
   *
   * Requires the `ui` permission.
   *
   * @param input - Document id, collection id, and new name.
   */
  renameDocument(input: RenameDocumentInput): Promise<DocumentSummary>;

  /**
   * Deletes a markdown document.
   *
   * Requires the `ui` permission. Silent — plugins must confirm first.
   *
   * @param input - Document id and parent collection id.
   */
  deleteDocument(input: DeleteDocumentInput): Promise<void>;

  /**
   * Moves a markdown document to another folder or the collection root.
   *
   * Requires the `ui` permission.
   *
   * @param input - Document id, target folder, and optional index.
   */
  moveDocument(input: MoveDocumentInput): Promise<void>;

  /**
   * Persists a new document order within a folder or collection root.
   *
   * Requires the `ui` permission.
   *
   * @param input - Collection id, folder id, and ordered document ids.
   */
  reorderDocuments(input: ReorderDocumentsInput): Promise<void>;

  /**
   * Persists interleaved request + document order in one folder or collection root.
   *
   * Requires the `ui` permission. Prefer this over separate request/document
   * reorder APIs when the UI shows a mixed container list.
   *
   * @param input - Collection id, folder id, and ordered item refs.
   */
  reorderContainerItems(input: ReorderContainerItemsInput): Promise<void>;

  /**
   * Lists collection summaries for building a sidebar tree.
   *
   * Archived collections are omitted unless {@link LibraryListOptions.includeArchived} is true.
   *
   * Requires the `ui` permission.
   *
   * @param options - Optional archive filter.
   */
  listCollections(options?: LibraryListOptions): Promise<CollectionSummary[]>;

  /**
   * Lists folder summaries for one collection.
   *
   * Requires the `ui` permission.
   *
   * @param collectionId - Collection database id.
   */
  listFolders(collectionId: number): Promise<FolderSummary[]>;

  /**
   * Lists lightweight saved-request summaries for one collection (no body/auth).
   *
   * Distinct from {@link listCollectionRequests}, which returns full rows in run order.
   *
   * Requires the `ui` permission.
   *
   * @param collectionId - Collection database id.
   */
  listRequests(collectionId: number): Promise<SavedRequestSummary[]>;

  /**
   * Lists markdown document summaries for one collection (no content body).
   *
   * Requires the `ui` permission.
   *
   * @param collectionId - Collection database id.
   */
  listDocuments(collectionId: number): Promise<DocumentSummary[]>;

  /**
   * Returns a full library snapshot (collections + nested folders/requests/documents).
   *
   * Requires the `ui` permission.
   *
   * @param options - Optional archive filter.
   */
  listLibraryTree(options?: LibraryListOptions): Promise<LibraryTreeSnapshot>;

  /**
   * Subscribes to coarse library invalidation events so plugins can refetch without polling.
   *
   * Requires the `ui` permission.
   *
   * @param listener - Called when collections, folders, requests, or documents refresh.
   * @returns A {@link Disposable} that removes the listener when disposed.
   */
  onLibraryChanged(listener: (event: LibraryChangedEvent) => void): Disposable;

  /**
   * Lists all workflows from the local registry.
   *
   * Requires the `ui` permission.
   */
  listWorkflows(): Promise<HostWorkflow[]>;

  /**
   * Returns one workflow by database id, or `null` when missing.
   *
   * Requires the `ui` permission.
   *
   * @param workflowId - Workflow database id.
   */
  getWorkflow(workflowId: number): Promise<HostWorkflow | null>;

  /**
   * Creates a workflow in the local registry.
   *
   * Requires the `ui` permission.
   *
   * @param input - Name, actions, duration, and optional uuid/variables.
   */
  createWorkflow(input: CreateWorkflowPayload): Promise<HostWorkflow>;

  /**
   * Replaces a workflow's actions and duration while preserving name and variables.
   *
   * Requires the `ui` permission.
   *
   * @param input - Workflow id, actions, and duration.
   */
  updateWorkflow(input: UpdateWorkflowPayload): Promise<HostWorkflow>;

  /**
   * Renames a workflow while preserving actions and variables.
   *
   * Requires the `ui` permission.
   *
   * @param workflowId - Workflow database id.
   * @param name - New display name.
   */
  renameWorkflow(workflowId: number, name: string): Promise<HostWorkflow>;

  /**
   * Deletes a workflow (moves it to trash when supported).
   *
   * Requires the `ui` permission. Silent — plugins must confirm first.
   *
   * @param workflowId - Workflow database id.
   */
  deleteWorkflow(workflowId: number): Promise<void>;

  /**
   * Subscribes to coarse workflow invalidation events so plugins can refetch without polling.
   *
   * Requires the `ui` permission.
   *
   * @param listener - Called when workflows are created, updated, renamed, or deleted.
   * @returns A {@link Disposable} that removes the listener when disposed.
   */
  onWorkflowsChanged(listener: (event: WorkflowsChangedEvent) => void): Disposable;

  /**
   * Returns saved requests for a collection or folder in sidebar run order.
   *
   * Requires the `ui` permission.
   *
   * @param collectionId - Collection database id.
   * @param folderId - Optional folder id; omit or null for collection-root run order.
   */
  listCollectionRequests(
    collectionId: number,
    folderId?: number | null
  ): Promise<HostSavedRequest[]>;

  /**
   * Returns collection metadata needed to resolve saved requests in plugins.
   *
   * Requires the `ui` permission.
   *
   * @param collectionId - Collection database id.
   */
  getCollectionMetadata(collectionId: number): Promise<HostCollection>;

  /**
   * Appends one HTTP result to the footer session console from a renderer plugin.
   *
   * Requires the `ui` permission.
   *
   * @param payload - Request label and send result metadata.
   */
  logRequestToConsole(payload: {
    requestName: string;
    collectionName?: string;
    result: PluginSendResult;
  }): Promise<void>;

  /**
   * Sends one HTTP request through the main-process pipeline, bypassing the
   * renderer's CORS restrictions. Failures resolve to an error result.
   *
   * Requires the `network` permission.
   *
   * @param input - Request configuration to execute.
   */
  sendHttpRequest(input: PluginSendRequestInput): Promise<PluginSendResult>;

  /**
   * Clears the active request tab's last HTTP response so plugin-only response
   * views can take over the panel.
   *
   * Requires the `ui` permission.
   */
  clearResponse(): Promise<void>;

  /**
   * Opens (or focuses) an image viewer page tab for a local path, URL, or inline image.
   *
   * Requires the `ui` permission. Session-only — image tabs are not restored on restart.
   *
   * @param payload - Image source and optional display filename.
   */
  openImageView(payload: OpenImageViewPayload): Promise<void>;
}

// ---------------------------------------------------------------------------
// Plugin context (hc)
// ---------------------------------------------------------------------------

/**
 * The plugin API surface passed as `hc` to your renderer entry's `activate(hc)` function.
 *
 * Export `activate(hc: PluginContext)` and optionally `deactivate()` from your renderer
 * bundle. Use {@link PluginContext.react} for hooks and JSX — do not import or bundle
 * `react` / `react-dom` in your plugin bundle.
 */
export interface PluginContext {
  /**
   * Plugin manifest id from `manifest.json`.
   *
   * Use for IPC routing and logging instead of hardcoding the manifest id in plugin code.
   */
  pluginId: string;

  /**
   * The same React instance HarborClient uses in the renderer.
   *
   * Use for `useState`, `useEffect`, and JSX. Do not bundle React in your plugin.
   */
  react: typeof React;

  /**
   * UI contribution registration and toast APIs. Requires the `ui` permission.
   */
  ui: PluginUi;

  /**
   * Custom appearance theme registration and change notifications. Requires the `ui` permission.
   */
  themes: PluginThemes;

  /**
   * Command registration and execution. Requires the `ui` permission.
   */
  commands: PluginCommands;

  /**
   * Action menu quick-open registration. Requires the `ui` permission.
   */
  actions: PluginActions;

  /**
   * Plugin-scoped persistent storage. Requires the `storage` permission.
   */
  storage: PluginStorage;

  /**
   * Plugin-scoped SQLite database. Requires the `database` permission.
   */
  database: PluginDatabase;

  /**
   * Plugin-scoped filesystem access. Requires `filesystem:*` permissions as documented
   * on each method.
   */
  fs: PluginFs;

  /**
   * Renderer-side HTTP lifecycle events. Requires the `http` permission.
   */
  http: PluginRendererHttp;

  /**
   * Renderer-side RPC into the plugin main entry. Requires the `ipc` permission.
   */
  ipc: PluginIpcInvoker;

  /**
   * Typed wrappers for built-in request editor commands. Requires the `ui` permission.
   */
  host: PluginHost;

  /**
   * **File → Import** handler registration. Requires the `ui` permission.
   */
  imports: PluginImports;

  /**
   * Remote MCP client server registration for Harbor's chat agent. Requires the `mcp`
   * permission.
   */
  mcp: PluginMcp;

  /**
   * Harbor Live Server CRUD, start/stop, status, and logs. Requires the `live-server`
   * permission.
   */
  liveServers: PluginLiveServers;

  /**
   * AI chat pointer registration and copy-to-chat. Requires the `ai` permission.
   */
  ai: PluginAi;

  /**
   * Opens or reuses an embedded browser tab and returns a control handle.
   *
   * Requires the `browser` permission (granted at install/enable). Same call shape
   * as request-script `hc.webpage`: omit `url` to bind the active browser tab;
   * `{ reuse }` defaults to true; new tabs wait for load.
   *
   * @param url - Optional URL to open or reuse.
   * @param options - Optional `{ reuse }` (default true).
   * @returns Handle with `focus` / `close` and `dom` helpers.
   */
  webpage(url?: string, options?: { reuse?: boolean }): Promise<PluginWebpageHandle>;

  /**
   * Host-managed disposable list used for registration cleanup on deactivation.
   *
   * Registration APIs append here automatically. Prefer disposing custom resources
   * (timers, listeners, etc.) from `deactivate()` or a React effect cleanup rather
   * than pushing onto this array.
   */
  subscriptions: Disposable[];
}

// ---------------------------------------------------------------------------
// Main-process HTTP hooks and IPC
// ---------------------------------------------------------------------------

/**
 * Serialized HTTP request passed to main-process before-send hooks.
 *
 * Handlers may mutate this object to change method, URL, headers, or body before
 * the request is sent.
 */
export interface PluginHttpRequest {
  /**
   * HTTP method (for example `GET`, `POST`).
   */
  method: string;

  /**
   * Request URL including scheme, host, path, and query string.
   */
  url: string;

  /**
   * Outgoing request headers as a flat key/value map.
   */
  headers: Record<string, string>;

  /**
   * Request body content as a string.
   */
  body: string;

  /**
   * Request body content type when captured from the send pipeline.
   */
  bodyType?: string;

  /**
   * Enabled query parameters from the outgoing request.
   */
  params?: Array<{ key: string; value: string }>;

  /**
   * Saved collection request id when the send originated from a saved request tab.
   */
  sourceRequestId?: number;

  /**
   * Display name from the request tab when {@link sourceRequestId} is set.
   */
  sourceRequestName?: string;
}

/**
 * Serialized HTTP response passed to main-process after-send hooks.
 */
export interface PluginHttpResponse {
  /**
   * HTTP status code (for example `200`, `404`).
   */
  status: number;

  /**
   * HTTP status text (for example `OK`, `Not Found`).
   */
  statusText: string;

  /**
   * Response headers as a flat key/value map.
   */
  headers: Record<string, string>;

  /**
   * Response body content as a string.
   */
  body: string;
}

/**
 * HTTP hook registration API available on {@link MainPluginContext.http}.
 *
 * Requires the `http` permission. Returned disposables are tracked automatically by the host.
 */
export interface PluginHttp {
  /**
   * Registers a callback that runs before each outgoing HTTP request.
   *
   * Mutate the request object to change method, URL, headers, or body.
   *
   * @param handler - Called with the mutable request snapshot.
   * @returns A {@link Disposable} that unregisters the handler when disposed.
   */
  onBeforeSend(handler: (request: PluginHttpRequest) => void | Promise<void>): Disposable;

  /**
   * Registers a callback that runs after the response is received.
   *
   * @param handler - Called with the request that was sent and the response payload.
   * @returns A {@link Disposable} that unregisters the handler when disposed.
   */
  onAfterSend(
    handler: (request: PluginHttpRequest, response: PluginHttpResponse) => void | Promise<void>
  ): Disposable;
}

/**
 * Custom IPC registration API available on {@link MainPluginContext.ipc}.
 *
 * Exposes RPC channels callable from the renderer half of the same plugin.
 * Requires the `ipc` permission. Returned disposables are tracked automatically by the host.
 */
export interface PluginIpc {
  /**
   * Registers a handler for a plugin-scoped IPC channel.
   *
   * @param channel - Channel name unique within this plugin.
   * @param handler - Called when the renderer invokes this channel.
   * @returns A {@link Disposable} that unregisters the handler when disposed.
   */
  handle(channel: string, handler: (...args: unknown[]) => unknown): Disposable;
}

/**
 * httpbin-style default echo payload returned when no custom handler overrides the response.
 */
export interface EchoResponsePayload {
  /**
   * Query string arguments.
   */
  args: Record<string, string>;

  /**
   * Raw request body as a UTF-8 string.
   */
  data: string;

  /**
   * Uploaded file field names mapped to original filenames.
   */
  files: Record<string, string>;

  /**
   * Parsed form fields excluding file uploads.
   */
  form: Record<string, string>;

  /**
   * Request headers as a flat key/value map.
   */
  headers: Record<string, string>;

  /**
   * Parsed JSON body when Content-Type is application/json.
   */
  json: Record<string, unknown> | null;

  /**
   * Client IP or socket remote address.
   */
  origin: string;

  /**
   * Full request URL including scheme, host, path, and query.
   */
  url: string;
}

/**
 * Serializable incoming HTTP request snapshot passed to echo server handlers.
 */
export interface EchoServerIncomingRequest {
  /**
   * HTTP method (for example `GET`, `POST`).
   */
  method: string;

  /**
   * Full request URL.
   */
  url: string;

  /**
   * Request path without the query string.
   */
  path: string;

  /**
   * Parsed query arguments.
   */
  query: Record<string, string>;

  /**
   * Request headers as a flat key/value map.
   */
  headers: Record<string, string>;

  /**
   * Raw request body as a UTF-8 string.
   */
  body: string;

  /**
   * Inferred body encoding for hc.request seeding.
   */
  bodyType: BodyType;

  /**
   * Query parameter rows for hc.request seeding.
   */
  params: PluginScriptKeyValue[];

  /**
   * Default httpbin-style echo payload for this request.
   */
  echo: EchoResponsePayload;
}

/**
 * Result returned when starting a plugin echo server.
 */
export interface EchoServerStartResult {
  /**
   * Assigned listen port after the server accepts connections.
   */
  port: number;
}

/**
 * Running state for a plugin echo server.
 */
export interface EchoServerStatus {
  /**
   * Whether the server is currently listening.
   */
  running: boolean;

  /**
   * Assigned listen port when running.
   */
  port?: number;
}

/**
 * Structured HTTP response returned from {@link PluginServer.onRequest}.
 *
 * Use {@link createHttpResponse} from `@harborclient/sdk/runtime-utils` (or set
 * `kind: 'http-response'`) so the host can apply status, headers, body, and delay.
 * Bare JSON values remain legacy body-only responses (always HTTP 200 +
 * `application/json`).
 */
export interface PluginServerHttpResponse {
  /**
   * Discriminant required for structured responses.
   */
  kind: 'http-response';

  /**
   * HTTP status code. Defaults to `200` when omitted or invalid.
   */
  status?: number;

  /**
   * Response headers as a flat key/value map.
   */
  headers?: Record<string, string>;

  /**
   * Response body. Strings are sent as raw text (default `text/plain` unless a
   * Content-Type header is set). Other JSON-serializable values use `res.json()`.
   */
  body?: unknown;

  /**
   * Milliseconds for the host to wait before writing the response.
   */
  delayMs?: number;
}

/**
 * Local HTTP echo server API available on {@link MainPluginContext.server}.
 *
 * Requires the `server` permission. The host runs an express listener in the Electron
 * main process and routes each incoming request through your onRequest handler.
 */
export interface PluginServer {
  /**
   * Starts listening for HTTP requests on the given port.
   *
   * Port `0` selects the first available non-privileged port from the OS.
   *
   * @param options - Optional listen port. Defaults to `0`.
   * @returns Assigned listen port after the server is accepting connections.
   */
  start(options?: { port?: number }): Promise<EchoServerStartResult>;

  /**
   * Stops the echo server owned by this plugin.
   */
  stop(): Promise<void>;

  /**
   * Registers a handler invoked for each incoming HTTP request.
   *
   * Multiple handlers may be registered; each call returns a {@link Disposable}
   * that removes only that handler. Handlers run sequentially in registration
   * order.
   *
   * Return either:
   * - a JSON-serializable value for a legacy body-only response (HTTP 200), or
   * - a {@link PluginServerHttpResponse} (`kind: 'http-response'`) for custom
   *   status, headers, body, and delay.
   *
   * When a handler returns `undefined` or `null`, the host keeps the result from
   * the previous handler (starting from the default httpbin-style echo payload).
   *
   * @param handler - Processes incoming requests and returns the response.
   * @returns A {@link Disposable} that unregisters the handler when disposed.
   */
  onRequest(
    handler: (
      request: EchoServerIncomingRequest
    ) => unknown | PluginServerHttpResponse | Promise<unknown | PluginServerHttpResponse>
  ): Disposable;
}

// ---------------------------------------------------------------------------
// Main-process script sandbox (hc.scripts)
// ---------------------------------------------------------------------------

/**
 * Enabled key/value row used in plugin script request and collection header context.
 */
export interface PluginScriptKeyValue {
  /**
   * Header or param name.
   */
  key: string;

  /**
   * Header or param value.
   */
  value: string;

  /**
   * When false, the row is ignored at send time.
   */
  enabled: boolean;
}

/**
 * Request snapshot seeding {@link PluginScriptContextInit} for hc.request APIs.
 */
export interface PluginScriptRequestInit {
  /**
   * HTTP method (for example `GET`, `POST`).
   */
  method: string;

  /**
   * Request URL including scheme, host, path, and query string.
   */
  url: string;

  /**
   * Outgoing header rows.
   */
  headers: PluginScriptKeyValue[];

  /**
   * Query parameter rows.
   */
  params: PluginScriptKeyValue[];

  /**
   * Request body content as a string.
   */
  body: string;

  /**
   * Body encoding selected in the request editor.
   */
  bodyType: BodyType;
}

/**
 * Response snapshot seeding {@link PluginScriptContextInit} for hc.response APIs.
 */
export interface PluginScriptResponseInit {
  /**
   * HTTP status code (for example `200`, `404`).
   */
  status: number;

  /**
   * HTTP status text (for example `OK`, `Not Found`).
   */
  statusText: string;

  /**
   * Response headers as a flat key/value map.
   */
  headers: Record<string, string>;

  /**
   * Response body content as a string.
   */
  body: string;

  /**
   * Time from send to response completion, in milliseconds.
   */
  timeMs: number;

  /**
   * Response body size in bytes.
   */
  sizeBytes: number;
}

/**
 * Collection metadata seeding hc.collection.* inside a plugin script context.
 */
export interface PluginScriptCollectionInit {
  /**
   * Collection database id, or null when no collection is associated.
   */
  id: number | null;

  /**
   * Collection display name.
   */
  name: string;

  /**
   * Collection-level headers merged at send time.
   */
  headers: PluginScriptKeyValue[];
}

/**
 * Environment metadata seeding hc.environment.* inside a plugin script context.
 */
export interface PluginScriptEnvironmentInit {
  /**
   * Active environment display name.
   */
  name: string;
}

/**
 * Initial context for {@link PluginScripts.createContext}.
 *
 * Mirrors the pre/post request script sandbox input. All fields are optional;
 * omitted fields use safe defaults (empty GET request, no variables, pre phase).
 */
export interface PluginScriptContextInit {
  /**
   * Script phase relative to the HTTP request. Default `'pre'`.
   */
  phase?: 'pre' | 'post';

  /**
   * Request snapshot exposed as hc.request.
   */
  request?: PluginScriptRequestInit;

  /**
   * Response snapshot exposed as hc.response when provided.
   */
  response?: PluginScriptResponseInit;

  /**
   * Merged runtime variables for hc.request.variables, hc.collection.variables,
   * hc.environment.variables, and hc.globals lookups.
   */
  variables?: Record<string, string>;

  /**
   * Collection metadata and headers for hc.collection.* APIs.
   */
  collection?: PluginScriptCollectionInit;

  /**
   * Environment metadata for hc.environment.* APIs.
   */
  environment?: PluginScriptEnvironmentInit;

  /**
   * Initial value for hc.data when creating the context.
   */
  data?: Record<string, unknown>;
}

/**
 * Result of a single hc.test assertion recorded by a plugin script run.
 */
export interface PluginScriptTestResult {
  /**
   * Test name passed to hc.test.
   */
  name: string;

  /**
   * Whether the test callback completed without throwing.
   */
  passed: boolean;

  /**
   * Assertion error message when passed is false.
   */
  error?: string;
}

/**
 * Result returned from {@link PluginScriptContext.run}.
 *
 * Includes the same structured hc mutations as pre/post request scripts plus the
 * script's last-expression value.
 */
export interface PluginScriptRunResult {
  /**
   * Last-expression value from the evaluated script when execution succeeded.
   */
  value: unknown;

  /**
   * Request snapshot after hc.request mutations during this context lifetime.
   */
  request: PluginScriptRequestInit;

  /**
   * Ephemeral variable sets from hc.request.variables.set.
   */
  variableSets: Record<string, string>;

  /**
   * Collection variable sets from hc.collection.variables.set.
   */
  collectionVariableSets: Record<string, string>;

  /**
   * Environment variable sets from hc.environment.variables.set.
   */
  environmentVariableSets: Record<string, string>;

  /**
   * Global variable sets from hc.globals.set.
   */
  globalVariableSets: Record<string, string>;

  /**
   * Collection headers after hc.collection.headers mutations.
   */
  collectionHeaders: PluginScriptKeyValue[];

  /**
   * hc.test results accumulated during this context lifetime.
   */
  tests: PluginScriptTestResult[];

  /**
   * Captured console.log and console.error output unless console was overridden.
   */
  logs: string[];

  /**
   * Mutable hc.data bag after this run; persists across subsequent run() calls on the same context.
   */
  data: Record<string, unknown>;

  /**
   * Sanitized runtime error when script evaluation throws.
   */
  error?: string;
}

/**
 * Mutable sandbox for running scripts with the same hc API as pre/post request scripts.
 */
export interface PluginScriptContext {
  /**
   * Injects a global variable visible to subsequent run() calls.
   *
   * @param name - Global name exposed inside the compartment.
   * @param value - Value assigned to the global.
   */
  setVariable(name: string, value: unknown): void;

  /**
   * Injects a global function visible to subsequent run() calls.
   *
   * Overrides built-in globals such as console when names collide.
   *
   * @param name - Global name exposed inside the compartment.
   * @param fn - Callable injected into the sandbox.
   */
  setFunction(name: string, fn: (...args: unknown[]) => unknown): void;

  /**
   * Evaluates a script synchronously and returns hc mutations plus the last expression value.
   *
   * @param script - User-authored JavaScript evaluated as the compartment body.
   * @returns Full hc result snapshot with the script's return value.
   */
  run(script: string): PluginScriptRunResult;
}

/**
 * Script sandbox factory available on {@link MainPluginContext.scripts}.
 *
 * Runs user scripts with the same hc object as collection and request pre/post scripts
 * (`hc.request`, `hc.collection`, `hc.environment`, `hc.globals`,
 * `hc.test`, `hc.expect`, and `hc.response` when a response is provided).
 */
export interface PluginScripts {
  /**
   * Creates a fresh script context backed by the shared hc implementation.
   *
   * @param init - Optional request/response/variable/collection/environment seed data.
   * @returns Context with setVariable, setFunction, and run.
   */
  createContext(init?: PluginScriptContextInit): PluginScriptContext;
}

/**
 * The plugin API surface passed as `hc` to your main entry's `activate(hc)` function.
 *
 * Main entries run inside the SES-hardened utilityProcess — not in the renderer.
 * Use this entry for HTTP hooks and custom IPC, not for React UI. Export
 * `activate(hc: MainPluginContext)` and optionally `deactivate()` from your main bundle.
 */
export interface MainPluginContext {
  /**
   * Host-managed disposable list used for registration cleanup on deactivation.
   *
   * Registration APIs append here automatically. Prefer disposing custom resources
   * (timers, listeners, etc.) from `deactivate()` or a React effect cleanup rather
   * than pushing onto this array.
   */
  subscriptions: Disposable[];

  /**
   * Plugin-scoped persistent storage. Requires the `storage` permission.
   */
  storage: PluginStorage;

  /**
   * Plugin-scoped SQLite database. Requires the `database` permission.
   */
  database: PluginDatabase;

  /**
   * HTTP hook registration. Requires the `http` permission.
   */
  http: PluginHttp;

  /**
   * Custom IPC handler registration. Requires the `ipc` permission.
   */
  ipc: PluginIpc;

  /**
   * Script sandbox with the same hc API as pre/post request scripts.
   *
   * Available without an extra permission — contexts only expose hc plus globals
   * you inject via setVariable and setFunction.
   */
  scripts: PluginScripts;

  /**
   * Local HTTP echo server. Requires the `server` permission.
   */
  server: PluginServer;
}
