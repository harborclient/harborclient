# Index

Alphabetical index of public `hc.*` APIs. Each entry links to the full reference on its namespace page.

## A

- [`hc.actions.register(namespace, handlers)`](/api/actions#hcactionsregisternamespace-handlers) — Registers plugin actions in HarborClient's Action menu.
- [`hc.ai.copyToChat(input)`](/api/ai#hcaicopytochatinput) — Opens the AI sidebar, ensures a chat exists, stores a snapshot, and queues the badge token in the composer.
- [`hc.ai.instructions.add(text)`](/api/ai#hcaiinstructionsaddtext) — Appends a static fragment to the agent system prompt while the returned disposable is active.
- [`hc.ai.onAfterTurn(handler)`](/api/ai#hcaionafterturnhandler) — Runs once when the turn finishes (completed, cancelled, or error).
- [`hc.ai.onBeforeTurn(handler)`](/api/ai#hcaionbeforeturnhandler) — Runs once when the user sends a chat message, before the first LLM completion step.
- [`hc.ai.registerChatPointer(config)`](/api/ai#hcairegisterchatpointerconfig) — Default grammar (match / parse omitted) — tokens are @plugin.&lt;pluginId&gt;.&lt;id&gt;.&lt;key&gt; with an optional #start.end selection suffix: Custom grammar — supply both match (body after @, as a RegExp or source string) and parse.

## C

- [`hc.commands.execute(id, ...args)`](/api/commands#hccommandsexecuteid-args) — Runs a registered command programmatically — for example to open a main view from another part of your plugin.
- [`hc.commands.register(id, handler)`](/api/commands#hccommandsregisterid-handler) — Registers a command handler.

## D

- [`hc.database.all(sql, params?)`](/api/database#hcdatabaseallsql-params) — Returns all matching rows.
- [`hc.database.exec(sql)`](/api/database#hcdatabaseexecsql) — Executes a multi-statement SQL script (typically migrations).
- [`hc.database.get(sql, params?)`](/api/database#hcdatabasegetsql-params) — Returns the first row, or undefined when no row matches.
- [`hc.database.run(sql, params?)`](/api/database#hcdatabaserunsql-params) — Runs an INSERT, UPDATE, or DELETE statement.
- [`hc.database.transaction(fn)`](/api/database#hcdatabasetransactionfn) — Runs fn inside an exclusive transaction.

## F

- [`hc.fs.pickDirectory(defaultPath?)`](/api/fs#hcfspickdirectorydefaultpath) — Opens a native directory picker.
- [`hc.fs.pickFile(options?)`](/api/fs#hcfspickfileoptions) — Opens a native file picker.
- [`hc.fs.readFile(path)`](/api/fs#hcfsreadfilepath) — Reads a UTF-8 text file from an allowlisted path.
- [`hc.fs.saveFile(content, options?)`](/api/fs#hcfssavefilecontent-options) — Opens a native save dialog and writes content to the chosen path.
- [`hc.fs.writeBytes(path, bytes)`](/api/fs#hcfswritebytespath-bytes) — Writes binary bytes to an allowlisted path.
- [`hc.fs.writeFile(path, content)`](/api/fs#hcfswritefilepath-content) — Writes UTF-8 text to an allowlisted path.

## H

- [`hc.host.applyRequestDraft(payload)`](/api/host#hchostapplyrequestdraftpayload) — Updates the active request editor tab in place.
- [`hc.host.createCollection(payload)`](/api/host#hchostcreatecollectionpayload) — Bulk-creates a collection with folders and saved requests.
- [`hc.host.fetch(input, init?)`](/api/host#hchostfetchinput-init) — Sends one outbound HTTP request through the main-process pipeline using the native fetch(input, init?) signature.
- [`hc.host.loadRequest(requestId)`](/api/host#hchostloadrequestrequestid) — Opens a saved collection request or focuses an existing tab for it.
- [`hc.host.openImageView(payload)`](/api/host#hchostopenimageviewpayload) — Opens or focuses an image-view page tab.
- [`hc.host.openRequestDraft(payload)`](/api/host#hchostopenrequestdraftpayload) — Opens a new unsaved request tab seeded with request metadata.
- [`hc.host.send()`](/api/host#hchostsend) — Sends the active request editor tab using the same pipeline as the Send button.
- [`hc.host.showEntityContextMenu(input)`](/api/host#hchostshowentitycontextmenuinput) — Opens the same collection / folder / request context menu the built-in Collections tree would show — including plugin registerContextMenuItem contributions — positioned in the host window.
- [`hc.http.onAfterScripts(handler)`](/api/http#hchttponafterscriptshandler) — Register a callback that runs after each request stage's scripts complete.
- [`hc.http.onAfterSend(handler)`](/api/http#hchttponaftersendhandler) — Register a callback that runs after the response is received.
- [`hc.http.onBeforeScripts(handler)`](/api/http#hchttponbeforescriptshandler) — Register a callback that runs before each request stage's scripts.
- [`hc.http.onBeforeSend(handler)`](/api/http#hchttponbeforesendhandler) — Register a callback that runs before each outgoing HTTP request.

## I

- [`hc.imports.registerHandler(extensions, handler)`](/api/imports#hcimportsregisterhandlerextensions-handler) — | Callback | Type | Description | | ----------- | --------------------------------------------------- | --------------------------------------------------- | | canImport | (file: ImportFile) =&gt; boolean \| Promise&lt;boolean&gt; | Returns whether this handler should import the file | | import | (file: ImportFile) =&gt; void \| Promise&lt;void&gt; | Performs the import workflow | ImportFile includes name, path, extension (dot-prefixed, lowercase), and UTF-8 contents.
- [`hc.ipc.handle(channel, handler)`](/api/ipc#hcipchandlechannel-handler) — Expose an RPC channel callable from the renderer half of the same plugin.
- [`hc.ipc.invoke(channel, ...args)`](/api/ipc#hcipcinvokechannel-args) — Invokes a handler registered with hc.ipc.handle in the main entry.

## L

- [`hc.livePage`](/api/livePage#hclivepage) — Opens or reuses an embedded browser tab and returns a control handle (focus, close, DOM query/evaluate/inject, viewport screenshot).
- [`hc.livePages.create(input)`](/api/livePages#hclivepagescreateinput) — Persists a new saved live page and returns the created row.
- [`hc.livePages.delete(id)`](/api/livePages#hclivepagesdeleteid) — Deletes a saved live page (moves it to trash).
- [`hc.livePages.get(idOrUuid)`](/api/livePages#hclivepagesgetidoruuid) — Returns one saved live page by database id or uuid, or null when not found.
- [`hc.livePages.list()`](/api/livePages#hclivepageslist) — Lists saved live pages from the local registry.
- [`hc.livePages.update(input)`](/api/livePages#hclivepagesupdateinput) — Updates a saved live page.
- [`hc.liveServers.clearLogs(query)`](/api/liveServers#hcliveserversclearlogsquery) — Clears the in-memory request log buffer for a running instance.
- [`hc.liveServers.create(input)`](/api/liveServers#hcliveserverscreateinput) — Persists a new saved server and returns the created row.
- [`hc.liveServers.delete(id)`](/api/liveServers#hcliveserversdeleteid) — Deletes a saved server.
- [`hc.liveServers.get(idOrUuid)`](/api/liveServers#hcliveserversgetidoruuid) — Returns one saved server by database id or uuid, or null when not found.
- [`hc.liveServers.getLogs(query)`](/api/liveServers#hcliveserversgetlogsquery) — Returns trailing buffered Express access-log lines (default limit 100, max 1000).
- [`hc.liveServers.getStatus(query)`](/api/liveServers#hcliveserversgetstatusquery) — Returns the running instance for the query, or null when not running.
- [`hc.liveServers.list()`](/api/liveServers#hcliveserverslist) — Lists saved live servers from the local registry.
- [`hc.liveServers.listRunning()`](/api/liveServers#hcliveserverslistrunning) — Lists currently running instances.
- [`hc.liveServers.onRequestLog(listener)`](/api/liveServers#hcliveserversonrequestloglistener) — Subscribes to Express access-log lines from running live servers.
- [`hc.liveServers.onRunningChanged(listener)`](/api/liveServers#hcliveserversonrunningchangedlistener) — Subscribes to start/stop list changes (including changes from the Harbor UI).
- [`hc.liveServers.start(input)`](/api/liveServers#hcliveserversstartinput) — Starts from savedId (loads config from the registry when config is omitted) and/or an ad-hoc config.
- [`hc.liveServers.stop(query)`](/api/liveServers#hcliveserversstopquery) — Stops one running instance by runtime id or saved id.
- [`hc.liveServers.update(input)`](/api/liveServers#hcliveserversupdateinput) — Updates a saved server.

## M

- [`hc.mcp.registerServer(config)`](/api/mcp#hcmcpregisterserverconfig) — Discovered tools are prefixed with mcp in the chat agent tool list, using the same naming scheme as user-configured MCP client servers.

## P

- [`hc.pluginId`](/api/pluginId#hcpluginid) — Type: string The plugin manifest id.

## R

- [`hc.react`](/api/react#hcreact) — Type: typeof React The same React instance HarborClient uses in the renderer.

## S

- [`hc.scripts`](/api/scripts#hcscripts) — Creates a script sandbox that exposes the same hc object as collection and request pre/post scripts.
- [`hc.server.onRequest(handler)`](/api/server#hcserveronrequesthandler) — Invoked for each incoming HTTP request.
- [`hc.server.start(options?)`](/api/server#hcserverstartoptions) — Starts listening.
- [`hc.server.stop()`](/api/server#hcserverstop) — Stops the echo server owned by this plugin.
- [`hc.storage.get(key)`](/api/storage#hcstoragegetkey) — Returns the stored value, or undefined if the key has never been set.
- [`hc.storage.set(key, value)`](/api/storage#hcstoragesetkey-value) — Persists a JSON-serializable value.

## T

- [`hc.themes.getActive()`](/api/themes#hcthemesgetactive) — Returns the currently active theme — either a built-in id or a plugin theme reference.
- [`hc.themes.onDidChange(listener)`](/api/themes#hcthemesondidchangelistener) — Fires when the user changes the appearance theme in Settings or when the host resets theme after plugin deactivation.
- [`hc.themes.register(theme)`](/api/themes#hcthemesregistertheme) — Provide colors, metrics, a stylesheet, or a combination.

## U

- [`hc.ui.closeModal(modalId?)`](/api/ui#hcuiclosemodalmodalid) — Closes the open plugin modal overlay.
- [`hc.ui.openModal(modalId, context?)`](/api/ui#hcuiopenmodalmodalid-context) — Opens the registered modal overlay in the host application window.
- [`hc.ui.registerCollectionSettingsTab(tab)`](/api/ui#hcuiregistercollectionsettingstabtab) — Adds a segmented tab to Collection Settings (alongside General, Variables, Headers, and so on).
- [`hc.ui.registerContextMenuItem(item)`](/api/ui#hcuiregistercontextmenuitemitem) — Adds an action to row context menus in the sidebar for collection, folder, and request targets.
- [`hc.ui.registerFooterPanel(panel)`](/api/ui#hcuiregisterfooterpanelpanel) — Registers a slide-up footer panel using the same pattern as Console and Variables.
- [`hc.ui.registerLivePageChromeAction(action)`](/api/ui#hcuiregisterlivepagechromeactionaction) — Adds a RoundButton to the embedded browser chrome bar between Downloads and Ask AI.
- [`hc.ui.registerMainView(view)`](/api/ui#hcuiregistermainviewview) — Registers a full main-area overlay, replacing the request editor while open (same pattern as Team Hubs or Sharing Keys).
- [`hc.ui.registerMenuItem(item)`](/api/ui#hcuiregistermenuitemitem) — Adds an item to the application menu.
- [`hc.ui.registerModal(modal)`](/api/ui#hcuiregistermodalmodal) — Registers a modal rendered in a full-window overlay at the application root.
- [`hc.ui.registerRequestTab(tab)`](/api/ui#hcuiregisterrequesttabtab) — Adds a segmented tab to the request editor (alongside Params, Headers, Body, and so on).
- [`hc.ui.registerRequestToolbarAction(action)`](/api/ui#hcuiregisterrequesttoolbaractionaction) — Adds a button to the request URL bar toolbar.
- [`hc.ui.registerResponseTab(tab)`](/api/ui#hcuiregisterresponsetabtab) — Adds a tab to the response viewer (alongside Body, Headers, Tests).
- [`hc.ui.registerScriptEditorAction(action)`](/api/ui#hcuiregisterscripteditoractionaction) — HarborClient uses request stage for the pre-request and post-request script lists (ScriptPhase: pre | post) and script stage for timing within a list (ScriptStage: before-all, before-each, main, after-each, after-all).
- [`hc.ui.registerSettingsSection(section)`](/api/ui#hcuiregistersettingssectionsection) — Registers a React component as a Settings panel alongside built-in sections (General, Storage, and so on).
- [`hc.ui.registerSidebarPanel(panel)`](/api/ui#hcuiregistersidebarpanelpanel) — Registers a switchable left sidebar destination — a full-height panel the user selects instead of the default collections view.
- [`hc.ui.registerSidebarRailItem(item)`](/api/ui#hcuiregistersidebarrailitemitem) — Registers an activity-rail button.
- [`hc.ui.registerSidebarSection(section)`](/api/ui#hcuiregistersidebarsectionsection) — Adds a collapsible block inside the scrollable sidebar, using the same pattern as the built-in Collections and Environments sections.
- [`hc.ui.registerStatusBarItem(item)`](/api/ui#hcuiregisterstatusbaritemitem) — Adds a custom status indicator to the footer bar.
- [`hc.ui.registerWorkflowActionBlock(block)`](/api/ui#hcuiregisterworkflowactionblockblock) — Renders a HostedSurface inside matching workflow timeline action blocks (below the built-in thumbnail).
- [`hc.ui.registerWorkflowToolbarAction(action)`](/api/ui#hcuiregisterworkflowtoolbaractionaction) — Adds a button to the right of Save in the workflow play/edit toolbar.
- [`hc.ui.setFooterPanelIndicator(panelId, state)`](/api/ui#hcuisetfooterpanelindicatorpanelid-state) — Sets or clears the native status dot beside a footer panel toggle.
- [`hc.ui.showToast(message, options?)`](/api/ui#hcuishowtoastmessage-options) — Shows a non-blocking toast for success or info feedback.
