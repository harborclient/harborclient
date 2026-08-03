# Renderer API

The renderer entry exports `activate(hc)` and optionally `deactivate()`. The `hc` argument is a `PluginContext`:

```typescript
import type { HttpResponse, RequestDraft } from '@harborclient/sdk';
import type * as React from 'react';

export interface Disposable {
  dispose(): void;
}

export interface UiContributionBase {
  /** Must match an id in the corresponding manifest contributes.* array */
  id: string;
  title: string;
}

export interface SettingsSectionContribution extends UiContributionBase {
  Component: React.ComponentType;
}

export interface SidebarPanelContribution extends UiContributionBase {
  icon?: string;
  Component: React.ComponentType;
  order?: number;
}

export interface SidebarSectionContribution extends UiContributionBase {
  Component: React.ComponentType;
  headerActions?: React.ComponentType;
  order?: number;
}

export interface MainViewContribution extends UiContributionBase {
  Component: React.ComponentType;
  /** Optional tab-bar icon name (`server`, `database`, `globe`, `code`, `robot`, `puzzle-piece`, `bolt`, `flask`). */
  icon?: string;
}

export interface RequestTabContext {
  draft: RequestDraft;
  response: HttpResponse | null;
  readOnly: true;
  collectionAuth: AuthConfig;
  collectionHeaders: Array<{ key: string; value: string; enabled: boolean }>;
  /** Merged global, collection, and environment values for {{key}} substitution. */
  variables: Record<string, string>;
}

export interface RequestTabContribution extends UiContributionBase {
  Component: React.ComponentType<{ context: RequestTabContext }>;
  order?: number;
}

export interface ResponseTabContext {
  draft: RequestDraft;
  response: HttpResponse | null;
}

export interface ResponseTabContribution extends UiContributionBase {
  Component: React.ComponentType<{ context: ResponseTabContext }>;
  order?: number;
  /** When to show the tab. Default `hasResponse`. */
  when?: 'always' | 'hasResponse';
}

export interface CollectionSettingsTabContext {
  collectionId: number;
  readOnly: boolean;
}

export interface CollectionSettingsTabContribution extends UiContributionBase {
  Component: React.ComponentType<{ context: CollectionSettingsTabContext }>;
  order?: number;
}

export interface FooterPanelContribution extends UiContributionBase {
  Component: React.ComponentType;
}

export type FooterPanelIndicatorStatus =
  | 'success'
  | 'danger'
  | 'muted'
  | 'accent'
  | 'warning'
  | 'info';

export interface FooterPanelIndicatorState {
  status: FooterPanelIndicatorStatus;
  label?: string;
}

export type AppMenu = 'file' | 'edit' | 'view' | 'help';

export interface MenuItemContribution {
  menu: AppMenu;
  command: string;
  label?: string;
  group?: string;
  order?: number;
}

export interface RequestToolbarActionContribution {
  id: string;
  title: string;
  command: string;
  icon?: string;
  order?: number;
}

export interface LivePageChromeActionContext {
  tabId: string;
  url: string;
  title: string;
  websiteId?: number | null;
}

export interface LivePageChromeActionContribution {
  id: string;
  title: string;
  command: string;
  icon?: string;
}

export type ContextMenuTarget = 'collection' | 'folder' | 'request';

export interface ContextMenuItemContribution {
  id: string;
  title: string;
  command: string;
  when: ContextMenuTarget | ContextMenuTarget[];
  group?: string;
  order?: number;
}

export interface StatusBarItemContribution {
  id: string;
  Component: React.ComponentType;
  alignment?: 'left' | 'right';
  order?: number;
}

/**
 * HarborClient UI color tokens. Override via `colors` or a bundled stylesheet.
 * Maps to `--mac-*` CSS custom properties on `:root`.
 */
export type ThemeColorToken =
  | 'surface'
  | 'header'
  | 'page-header'
  | 'page-header-text'
  | 'page-header-muted'
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
  | 'git-uncommitted'
  | 'control'
  | 'field'
  | 'separator'
  | 'text'
  | 'text-secondary'
  | 'muted'
  | 'accent'
  | 'selection'
  | 'doc-markdown'
  | 'tab-underline'
  | 'resize-separator'
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
  | 'method-options';

/**
 * HarborClient UI metric tokens (typography and geometry).
 * Override via `metrics` or a bundled stylesheet. Maps to `--mac-*` on `:root`.
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

export interface ThemeContribution {
  /** Must match an id in manifest.contributes.themes */
  id: string;
  title: string;
  /** Base appearance for `color-scheme` and native window chrome */
  type: 'light' | 'dark';
  /** Color token overrides without the `--mac-` prefix */
  colors?: Partial<Record<ThemeColorToken, string>>;
  /** Typography/geometry overrides without the `--mac-` prefix (CSS strings) */
  metrics?: Partial<Record<ThemeMetricToken, string>>;
  /** Plugin-relative CSS path (for example `dist/theme.css`) */
  stylesheet?: string;
}

export type BuiltinThemeId = 'light' | 'dark' | 'system' | 'high-contrast';

export type ActiveTheme =
  | { source: 'builtin'; id: BuiltinThemeId }
  | { source: 'plugin'; pluginId: string; themeId: string };

export interface PluginThemes {
  register(theme: ThemeContribution): Disposable;
  getActive(): Promise<ActiveTheme>;
  onDidChange(listener: (theme: ActiveTheme) => void): Disposable;
}

export interface PluginStorage {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
}

export interface PluginCommands {
  register(id: string, handler: (...args: unknown[]) => void | Promise<void>): Disposable;
  execute(id: string, ...args: unknown[]): Promise<void>;
}

export type ActionHandlerMap = Record<string, (...args: unknown[]) => void | Promise<void>>;

export interface PluginActions {
  register(namespace: string, handlers: ActionHandlerMap): Disposable;
}

export interface PluginUi {
  registerSettingsSection(section: SettingsSectionContribution): Disposable;
  registerSidebarPanel(panel: SidebarPanelContribution): Disposable;
  registerSidebarRailItem(item: SidebarRailItemContribution): Disposable;
  registerSidebarSection(section: SidebarSectionContribution): Disposable;
  registerMainView(view: MainViewContribution): Disposable;
  registerRequestTab(tab: RequestTabContribution): Disposable;
  registerResponseTab(tab: ResponseTabContribution): Disposable;
  registerCollectionSettingsTab(tab: CollectionSettingsTabContribution): Disposable;
  registerFooterPanel(panel: FooterPanelContribution): Disposable;
  setFooterPanelIndicator(panelId: string, state: FooterPanelIndicatorState | null): void;
  registerMenuItem(item: MenuItemContribution): Disposable;
  registerRequestToolbarAction(action: RequestToolbarActionContribution): Disposable;
  registerLivePageChromeAction(action: LivePageChromeActionContribution): Disposable;
  registerScriptEditorAction(action: ScriptEditorActionContribution): Disposable;
  registerWorkflowToolbarAction(action: WorkflowToolbarActionContribution): Disposable;
  registerWorkflowActionBlock(block: WorkflowActionBlockContribution): Disposable;
  registerContextMenuItem(item: ContextMenuItemContribution): Disposable;
  registerStatusBarItem(item: StatusBarItemContribution): Disposable;
  showToast(message: string, options?: { duration?: number }): void;
}

export interface PluginContext {
  pluginId: string;
  react: typeof React;
  ui: PluginUi;
  themes: PluginThemes;
  commands: PluginCommands;
  actions: PluginActions;
  storage: PluginStorage;
  fs: PluginFs;
  http: PluginRendererHttp;
  ipc: PluginIpcInvoker;
  host: PluginHost;
  imports: PluginImports;
  mcp: PluginMcp;
  ai: PluginAi;
}

export interface PluginMcpHeader {
  key: string;
  value: string;
}

export interface PluginMcpServerConfig {
  name: string;
  serverURL: string;
  enabled?: boolean;
  headers?: PluginMcpHeader[];
  icon?: string;
}

export interface PluginMcp {
  registerServer(config: PluginMcpServerConfig): Disposable;
}

export interface PluginImports {
  registerHandler(extensions: string | string[], handler: ImportHandler): Disposable;
}

export interface PluginRendererHttp {
  onAfterSend(
    handler: (request: PluginHttpRequest, response: PluginHttpResponse) => void | Promise<void>
  ): Disposable;
}

export interface PluginIpcInvoker {
  invoke<T>(channel: string, ...args: unknown[]): Promise<T>;
}

export interface OpenRequestDraftParam {
  key: string;
  value: string;
}

export interface OpenRequestDraftPayload {
  name?: string;
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  params?: OpenRequestDraftParam[];
  body?: string;
  bodyType?: BodyType;
}

export interface ApplyRequestDraftPayload {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  params?: OpenRequestDraftParam[];
  body?: string;
  bodyType?: BodyType;
}

export type OpenImageViewPayload =
  | { path: string; fileName?: string }
  | { url: string; fileName?: string }
  | { dataUrl: string; fileName: string }
  | { base64: string; contentType: string; fileName: string };

export interface PluginHost {
  openRequestDraft(payload: OpenRequestDraftPayload): Promise<void>;
  applyRequestDraft(payload: ApplyRequestDraftPayload): Promise<void>;
  loadRequest(requestId: number): Promise<void>;
  send(): Promise<void>;
  fetch(
    input: string | URL | { url: string },
    init?: PluginFetchInit
  ): Promise<PluginFetchResponse>;
  createEnvironmentWithVariables(
    name: string,
    variables: PluginVariableInput[]
  ): Promise<CreatedEnvironmentResult>;
  updateEnvironmentVariables(
    environmentId: number,
    variables: PluginVariableInput[]
  ): Promise<void>;
  createCollection(payload: CreateCollectionPayload): Promise<CreateCollectionResult>;
  listWorkflows(): Promise<HostWorkflow[]>;
  getWorkflow(workflowId: number): Promise<HostWorkflow | null>;
  createWorkflow(input: CreateWorkflowPayload): Promise<HostWorkflow>;
  updateWorkflow(input: UpdateWorkflowPayload): Promise<HostWorkflow>;
  renameWorkflow(workflowId: number, name: string): Promise<HostWorkflow>;
  deleteWorkflow(workflowId: number): Promise<void>;
  onWorkflowsChanged(listener: (event: WorkflowsChangedEvent) => void): Disposable;
  openImageView(payload: OpenImageViewPayload): Promise<void>;
}

export interface PluginHttpRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  bodyType?: string;
  params?: Array<{ key: string; value: string }>;
  sourceRequestId?: number;
  sourceRequestName?: string;
}

export interface PluginHttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
}
```

Install `@harborclient/sdk` as a **dev dependency** in your plugin project for types and the JSX runtime helpers. The package tracks HarborClient releases. Type definitions are maintained in [harborclient/sdk](https://github.com/harborclient/sdk). Main entries use `MainPluginContext` instead — import it from `@harborclient/sdk` or `@harborclient/sdk/main` for main-only plugins.

<HcMethod name="pluginId" :level="2" />

<HcMethod name="react" :level="2" />

## React and JSX

Plugins must share the host React instance. HarborClient installs `hc.react` before `activate(hc)` runs. `@harborclient/sdk` ships a small JSX runtime and hook barrel that forwards to that instance — no plugin-side setup call is required.

**TypeScript** (`tsconfig.json`):

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@harborclient/sdk"
  }
}
```

**esbuild** (renderer bundle):

```bash
esbuild src/renderer.tsx \
  --bundle --outfile=dist/renderer.js --format=esm \
  --jsx=automatic --jsx-import-source=@harborclient/sdk \
  --external:react --external:react-dom
```

**Renderer entry:**

```tsx
import type { PluginContext } from '@harborclient/sdk';

export function activate(hc: PluginContext): void {
  // register contributions…
}
```

**Hooks in components** — import from `@harborclient/sdk/react` (not from `react`):

```tsx
import { useEffect, useState } from '@harborclient/sdk/react';
```

**Single-file escape hatch** — `createPluginComponent` builds a component from a factory that receives host React:

```tsx
import { createPluginComponent } from '@harborclient/sdk';
import type { PluginContext } from '@harborclient/sdk';

export function activate(hc: PluginContext): void {
  const Panel = createPluginComponent((React) => {
    return function Panel() {
      const [count, setCount] = React.useState(0);
      return React.createElement('button', { onClick: () => setCount(count + 1) }, count);
    };
  });
}
```

See [harborclient-plugin-skeleton](https://github.com/harborclient/plugin-skeleton) for a complete starter project with renderer and main entries.

## hc.http

Renderer-side HTTP lifecycle events for reacting to completed sends in the UI. Requires the `http` permission. Registration disposables are tracked automatically.

Prefer `hc.http.onAfterSend` over a main entry + custom IPC + polling when you only need to capture completed requests in the renderer (for example history or recent-requests panels).

<HcMethod name="http.onAfterSend" :level="3" />

## hc.ipc

Renderer-side RPC into the plugin's main entry. Requires the `ipc` permission. The host auto-reactivates the main runtime when it has been torn down.

<HcMethod name="ipc.invoke" :level="3" />

## hc.host

Typed wrappers for built-in HarborClient request editor commands. Requires the `ui` permission. Prefer these over stringly-typed `hc.commands.execute('harborclient:…')`.

<HcMethod name="host.openRequestDraft" :level="3" />

<HcMethod name="host.applyRequestDraft" :level="3" />

<HcMethod name="host.loadRequest" :level="3" />

<HcMethod name="host.send" :level="3" />

<HcMethod name="host.fetch" :level="3" />

<HcMethod name="host.openImageView" :level="3" />

## Related reference

- [UI contributions](/renderer-ui) — `hc.ui.register*` methods and `hc.actions.register`
- [Themes and storage](/renderer-data) — themes, commands, storage, filesystem, [File → Import handlers](/renderer-data#hcimports), [MCP client servers](/renderer-data#hcmcp), [Harbor Live Servers](/renderer-data#hcliveservers), and [AI chat pointers](/renderer-data#hcai)
- [Main API](/main-api) — HTTP hooks and IPC in the main entry
