# UI contributions

All `hc.ui.register*` methods:

- Require the `ui` permission.
- Return a `Disposable` that unregisters the contribution when called.
- Require an `id` that matches an entry in the corresponding `manifest.contributes.*` array.

Registration disposables are tracked automatically when you call `hc.ui.register*` methods. Custom disposables (timers, focus sync, etc.) should be disposed in `deactivate()` or React effect cleanup.

See [Manifest](/manifest#contribution-types) for the manifest keys that correspond to each registrar.

## hc.ui.registerSettingsSection(section)

**Signature:** `(section: SettingsSectionContribution) => Disposable`

**Manifest:** `contributes.settingsSections`

| Parameter   | Type                  | Description                   |
| ----------- | --------------------- | ----------------------------- |
| `id`        | `string`              | Settings section id           |
| `title`     | `string`              | Label in the Settings sidebar |
| `Component` | `React.ComponentType` | Panel content                 |

Registers a React component as a Settings panel alongside built-in sections (General, Storage, and so on).

```typescript
hc.ui.registerSettingsSection({
  id: 'compactMode',
  title: 'Compact Mode',
  Component: CompactModePanel
});
```

## hc.ui.registerSidebarPanel(panel)

**Signature:** `(panel: SidebarPanelContribution) => Disposable`

**Manifest:** `contributes.sidebarPanels`

| Parameter   | Type                  | Description                       |
| ----------- | --------------------- | --------------------------------- |
| `id`        | `string`              | Panel id                          |
| `title`     | `string`              | Label when switching sidebar mode |
| `icon`      | `string`              | Optional icon name                |
| `Component` | `React.ComponentType` | Full sidebar content              |
| `order`     | `number`              | Sort order among plugin panels    |

Registers a switchable left sidebar destination — a full-height panel the user selects instead of the default collections view.

```typescript
hc.ui.registerSidebarPanel({
  id: 'myPlugin.panel',
  title: 'My Tools',
  icon: 'wrench',
  Component: MySidebarPanel
});
```

## hc.ui.registerSidebarSection(section)

**Signature:** `(section: SidebarSectionContribution) => Disposable`

**Manifest:** `contributes.sidebarSections`

| Parameter       | Type                  | Description                                 |
| --------------- | --------------------- | ------------------------------------------- |
| `id`            | `string`              | Section id                                  |
| `title`         | `string`              | Collapsible section heading                 |
| `Component`     | `React.ComponentType` | Section body                                |
| `headerActions` | `React.ComponentType` | Optional controls in the section header row |
| `order`         | `number`              | Sort order below Collections / Environments |

Adds a collapsible block inside the scrollable sidebar, using the same pattern as the built-in Collections and Environments sections.

```typescript
hc.ui.registerSidebarSection({
  id: 'myPlugin.section',
  title: 'Quick links',
  Component: QuickLinksSection,
  order: 100
});
```

## hc.ui.registerMainView(view)

**Signature:** `(view: MainViewContribution) => Disposable`

**Manifest:** `contributes.mainViews`

| Parameter   | Type                  | Description                                                                                                                                               |
| ----------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`        | `string`              | View id                                                                                                                                                   |
| `title`     | `string`              | Display name for the page tab                                                                                                                             |
| `Component` | `React.ComponentType` | Full main-area content                                                                                                                                    |
| `icon`      | `string` (optional)   | Tab-bar icon name. Supported: `server`, `database`, `globe`, `code`, `robot`, `puzzle-piece`, `bolt`, `flask`. Unknown names fall back to `puzzle-piece`. |

Registers a full main-area overlay, replacing the request editor while open (same pattern as Team Hubs or Sharing Keys). Open the view with `hc.commands.execute` from a menu item or other trigger. The `title` and optional `icon` appear on the page tab.

```typescript
hc.ui.registerMainView({
  id: 'myPlugin.view',
  title: 'My Dashboard',
  icon: 'server',
  Component: DashboardView
});
```

## hc.ui.registerModal(modal)

**Signature:** `(modal: ModalContribution) => Disposable`

**Manifest:** `contributes.modals`

| Parameter   | Type                                         | Description                                     |
| ----------- | -------------------------------------------- | ----------------------------------------------- |
| `id`        | `string`                                     | Modal id                                        |
| `title`     | `string`                                     | Accessible title for the modal surface          |
| `Component` | `React.ComponentType<{ context?: unknown }>` | Modal body; receives `context` from `openModal` |

Registers a modal rendered in a full-window overlay at the application root. Open it with `hc.ui.openModal(modalId, context?)` and close it with `hc.ui.closeModal(modalId?)`. Requires the `ui` permission.

```typescript
hc.ui.registerModal({
    id: 'myPlugin.editor',
    title: 'Edit item',
    Component: ({ context }) => <EditorModal context={context} />
  })
hc.ui.openModal('myPlugin.editor', { itemId: 'abc' });
```

## hc.ui.openModal(modalId, context?)

**Signature:** `(modalId: string, context?: unknown) => void`

**Manifest:** `contributes.modals` — `modalId` must match a registered modal contribution.

Opens the registered modal overlay in the host application window. Optional `context` is passed to the modal component as a `context` prop.

## hc.ui.closeModal(modalId?)

**Signature:** `(modalId?: string) => void`

Closes the open plugin modal overlay. When `modalId` is provided, the overlay closes only if that modal is currently open.

## hc.ui.registerRequestTab(tab)

**Signature:** `(tab: RequestTabContribution) => Disposable`

**Manifest:** `contributes.requestTabs`

| Parameter   | Type                                                  | Description                  |
| ----------- | ----------------------------------------------------- | ---------------------------- |
| `id`        | `string`                                              | Tab id                       |
| `title`     | `string`                                              | Tab label                    |
| `Component` | `React.ComponentType<{ context: RequestTabContext }>` | Tab content                  |
| `order`     | `number`                                              | Sort order among editor tabs |

Adds a segmented tab to the request editor (alongside Params, Headers, Body, and so on). The component receives `context.draft` for the active request, `context.response` when a response exists, and `context.variables` for merged global, collection, and environment substitution values (see [Global variables](/renderer-data#global-variables)).

```typescript
hc.ui.registerRequestTab({
  id: 'myPlugin.requestTab',
  title: 'Audit',
  Component: AuditTab
});
```

## hc.ui.registerResponseTab(tab)

**Signature:** `(tab: ResponseTabContribution) => Disposable`

**Manifest:** `contributes.responseTabs`

| Parameter   | Type                                                   | Description                                     |
| ----------- | ------------------------------------------------------ | ----------------------------------------------- |
| `id`        | `string`                                               | Tab id                                          |
| `title`     | `string`                                               | Tab label                                       |
| `Component` | `React.ComponentType<{ context: ResponseTabContext }>` | Tab content                                     |
| `order`     | `number`                                               | Sort order among response tabs                  |
| `when`      | `'always' \| 'hasResponse'`                            | When the tab is visible. Default `hasResponse`. |

Adds a tab to the response viewer (alongside Body, Headers, Tests).

```typescript
hc.ui.registerResponseTab({
  id: 'myPlugin.responseTab',
  title: 'Summary',
  when: 'hasResponse',
  Component: ResponseSummaryTab
});
```

## hc.ui.registerCollectionSettingsTab(tab)

**Signature:** `(tab: CollectionSettingsTabContribution) => Disposable`

**Manifest:** `contributes.collectionSettingsTabs`

| Parameter   | Type                                                             | Description                               |
| ----------- | ---------------------------------------------------------------- | ----------------------------------------- |
| `id`        | `string`                                                         | Tab id                                    |
| `title`     | `string`                                                         | Tab label                                 |
| `Component` | `React.ComponentType<{ context: CollectionSettingsTabContext }>` | Tab content                               |
| `order`     | `number`                                                         | Sort order among collection settings tabs |

Adds a segmented tab to Collection Settings (alongside General, Variables, Headers, and so on). The component receives `context.collectionId` and `context.readOnly`.

```typescript
hc.ui.registerCollectionSettingsTab({
  id: 'myPlugin.collTab',
  title: 'Plugin',
  Component: CollectionPluginTab
});
```

## hc.ui.registerFooterPanel(panel)

**Signature:** `(panel: FooterPanelContribution) => Disposable`

**Manifest:** `contributes.footerPanels`

| Parameter   | Type                  | Description                    |
| ----------- | --------------------- | ------------------------------ |
| `id`        | `string`              | Panel id                       |
| `title`     | `string`              | Toggle label in the footer bar |
| `Component` | `React.ComponentType` | Slide-up panel content         |

Registers a slide-up footer panel using the same pattern as Console and Variables.
The host wraps your component in a resizable shell — you do not implement resize
logic yourself. The shell provides:

- A top drag handle (and keyboard resize on the handle)
- Per-panel height persistence in `localStorage` (`hc.footerPanel.<namespaced-id>`)
- A close button in the top-right corner

**Layout contract:** Your `Component` should fill the resizable area with
`flex h-full min-h-0 flex-col` and put scrollable content in a
`flex-1 overflow-auto` child. Leave roughly 32px of right padding on header
rows so controls do not sit under the host close button.

```typescript
hc.ui.registerFooterPanel({
  id: 'myPlugin.footer',
  title: 'My Log',
  Component: PluginLogPanel
});
```

To show a status dot beside the footer toggle (running / stopped / error), use
[`hc.ui.setFooterPanelIndicator`](#hcuisetfooterpanelindicatorpanelid-state) —
do not mount your own indicator UI.

Example panel structure:

```tsx
function PluginLogPanel() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-control">
      <div className="flex shrink-0 items-center border-b border-separator px-3 py-2 pr-8">
        <h3 className="text-[14px] font-medium text-text">My Log</h3>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">{/* scrollable body */}</div>
    </div>
  );
}
```

## hc.ui.setFooterPanelIndicator(panelId, state)

**Signature:** `(panelId: string, state: FooterPanelIndicatorState | null) => void`

**Manifest:** `contributes.footerPanels` — `panelId` must match a registered panel

Sets or clears the native status dot beside a footer panel toggle. The host
renders a `StatusDot`; plugins do not mount an indicator webview.

| Parameter | Type                                | Description                                 |
| --------- | ----------------------------------- | ------------------------------------------- |
| `panelId` | `string`                            | Manifest footerPanels id                    |
| `state`   | `FooterPanelIndicatorState \| null` | Indicator status, or `null` to hide the dot |

`FooterPanelIndicatorState`:

| Field    | Type                                                                  | Description                          |
| -------- | --------------------------------------------------------------------- | ------------------------------------ |
| `status` | `'success' \| 'danger' \| 'muted' \| 'accent' \| 'warning' \| 'info'` | Color preset for the status dot      |
| `label`  | `string`                                                              | Optional accessible name for the dot |

Call from the agent (always-on) renderer after registering the panel, and again
whenever status changes:

```typescript
hc.ui.setFooterPanelIndicator('myPlugin.footer', {
  status: running ? 'success' : 'muted',
  label: running ? 'My server active' : 'My server stopped'
});

// Hide the dot:
hc.ui.setFooterPanelIndicator('myPlugin.footer', null);
```

## hc.ui.registerMenuItem(item)

**Signature:** `(item: MenuItemContribution) => Disposable`

**Manifest:** `contributes.menus` plus a matching `contributes.commands` entry

| Parameter | Type                                   | Description                 |
| --------- | -------------------------------------- | --------------------------- |
| `menu`    | `'file' \| 'edit' \| 'view' \| 'help'` | Target application menu     |
| `command` | `string`                               | Command id to run on click  |
| `label`   | `string`                               | Menu label override         |
| `group`   | `string`                               | Menu group for separators   |
| `order`   | `number`                               | Sort order within the group |

Adds an item to the application menu. Register the command handler with `hc.commands.register` separately.

For **File → Import** workflows, prefer [`hc.imports.registerHandler`](/renderer-data#hcimports) instead of adding a separate File menu import item. Built-in HarborClient formats are detected first; plugin handlers receive only unrecognized files whose extensions they registered.

```typescript
hc.commands.register('myPlugin.run', () => {
  hc.ui.showToast('Command ran');
});
hc.ui.registerMenuItem({ menu: 'view', command: 'myPlugin.run', group: 'plugin' });
```

## hc.actions.register(namespace, handlers)

**Signature:** `(namespace: string, handlers: Record<string, () => void | Promise<void>>) => Disposable`

**Manifest:** none. Requires the `ui` permission.

| Parameter   | Type                                          | Description                                       |
| ----------- | --------------------------------------------- | ------------------------------------------------- |
| `namespace` | `string`                                      | Prefix shown before each action label             |
| `handlers`  | `Record<string, () => void \| Promise<void>>` | Action labels mapped to handlers run on selection |

Registers plugin actions in HarborClient's Action menu. Users open the Action menu, type `#`, and see actions grouped as `Namespace: Label`.

Use this for lightweight commands that should be discoverable without adding a persistent menu item or toolbar button. Because actions are dynamic, they do not need `manifest.contributes.commands` entries, but the plugin must include the `ui` permission.

```typescript
hc.actions.register('cURL', {
  View: () => {
    hc.ui.showToast('Viewing generated cURL command');
  },
  Close: () => {
    hc.ui.showToast('Closed cURL preview');
  }
});
```

With that plugin installed, typing `#curl` in the Action menu shows:

- `cURL: View`
- `cURL: Close`

## hc.ui.registerRequestToolbarAction(action)

**Signature:** `(action: RequestToolbarActionContribution) => Disposable`

**Manifest:** `contributes.requestToolbarActions` plus a matching `contributes.commands` entry

| Parameter | Type     | Description                     |
| --------- | -------- | ------------------------------- |
| `id`      | `string` | Action id                       |
| `title`   | `string` | Button label or tooltip         |
| `command` | `string` | Command id to run on click      |
| `icon`    | `string` | Optional icon name              |
| `order`   | `number` | Sort order near the Send button |

Adds a button to the request URL bar toolbar.

```typescript
hc.commands.register('myPlugin.sendAction', () => {
  hc.ui.showToast('Pre-send check passed');
});
hc.ui.registerRequestToolbarAction({
  id: 'myPlugin.sendAction',
  title: 'Run check',
  command: 'myPlugin.sendAction'
});
```

## hc.ui.registerScriptEditorAction(action)

**Signature:** `(action: ScriptEditorActionContribution) => Disposable`

**Manifest:** `contributes.scriptEditorActions` plus a matching `contributes.commands` entry

| Parameter | Type            | Description                                                               |
| --------- | --------------- | ------------------------------------------------------------------------- |
| `id`      | `string`        | Action id                                                                 |
| `title`   | `string`        | Button label or tooltip                                                   |
| `command` | `string`        | Command id to run on click                                                |
| `icon`    | `string`        | Optional icon name                                                        |
| `order`   | `number`        | Sort order within the row action group                                    |
| `phases`  | `ScriptPhase[]` | Optional filter — show only in pre-request and/or post-request stage tabs |

HarborClient uses **request stage** for the pre-request and post-request script lists (`ScriptPhase`: `pre` | `post`) and **script stage** for timing within a list (`ScriptStage`: `before-all`, `before-each`, `main`, `after-each`, `after-all`).

Script rows carry a {@link ScriptStage} value that controls when the script runs within its request stage. Plugin script editor actions are not filtered by script stage today — use `phases` only.

Adds an icon button to each script row in the pre-request and post-request stage editors. The command handler receives a single {@link ScriptEditorActionContext} argument with `phase` (request stage), `scriptId`, and `code`.

```typescript
hc.commands.register('myPlugin.convert', (context: ScriptEditorActionContext) => {
  hc.ui.openModal('preview', context);
});
hc.ui.registerScriptEditorAction({
  id: 'myPlugin.convert',
  title: 'Convert',
  command: 'myPlugin.convert'
});
```

## hc.ui.registerContextMenuItem(item)

**Signature:** `(item: ContextMenuItemContribution) => Disposable`

**Manifest:** `contributes.contextMenus` plus a matching `contributes.commands` entry

| Parameter | Type                                             | Description                                         |
| --------- | ------------------------------------------------ | --------------------------------------------------- |
| `id`      | `string`                                         | Menu item id                                        |
| `title`   | `string`                                         | Menu label                                          |
| `command` | `string`                                         | Command id; handler receives target context as args |
| `when`    | `'collection' \| 'folder' \| 'request'` or array | Sidebar row types                                   |
| `group`   | `string`                                         | Menu group                                          |
| `order`   | `number`                                         | Sort order within the group                         |

Adds an action to row context menus in the sidebar.

```typescript
hc.commands.register('myPlugin.requestMenu', (target) => {
  hc.ui.showToast(`Action on request ${target.requestId}`);
});
hc.ui.registerContextMenuItem({
  id: 'myPlugin.requestMenu',
  title: 'Plugin action',
  command: 'myPlugin.requestMenu',
  when: 'request'
});
```

## hc.ui.registerStatusBarItem(item)

**Signature:** `(item: StatusBarItemContribution) => Disposable`

**Manifest:** `contributes.statusBarItems`

| Parameter   | Type                  | Description                   |
| ----------- | --------------------- | ----------------------------- |
| `id`        | `string`              | Item id                       |
| `Component` | `React.ComponentType` | Status content                |
| `alignment` | `'left' \| 'right'`   | Footer side. Default `right`. |
| `order`     | `number`              | Sort order on that side       |

Adds a custom status indicator to the footer bar.

```typescript
hc.ui.registerStatusBarItem({
  id: 'myPlugin.status',
  alignment: 'right',
  Component: PluginStatusBadge
});
```

## hc.ui.showToast(message, options?)

**Signature:** `(message: string, options?: { duration?: number }) => void`

Shows a non-blocking toast for success or info feedback. Do not use toasts for errors that require acknowledgment — show those inline in your plugin UI instead.

```typescript
hc.ui.showToast('Settings saved', { duration: 3000 });
```
