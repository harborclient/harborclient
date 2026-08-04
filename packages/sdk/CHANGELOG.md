# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

- refactor: update ESLint configurations and clean up code. (`fa5f53c9`)

## 1.6.2 - 2026-08-04

- docs(sdk): enhance API index formatting for improved readability. (`52517d89`)
- feat(docs): add hc_sdk_manifest.json for comprehensive SDK action and command documentation. (`39adb007`)
- docs(sdk): update AGENTS.md to include additional sync script details. (`61daf83a`)
- docs(sdk): clean up API index documentation by removing empty entries. (`d6cfb700`)
- refactor(sdk): replace installReact with setHostReact for improved plugin integration. (`3acb19dd`)
- feat(docs): update SDK documentation and improve manifest guidelines. (`a85afcea`)

## 1.6.1 - 2026-08-03

- feat(docs): enhance SDK documentation and update API references. (`6331350c`)
- feat(docs): update SDK documentation and enhance plugin API guidelines. (`46a2a29e`)
- refactor(ResponseEditor): simplify split pane wrapping and adjust padding. (`4b480786`)
- feat(settings): enhance deep link handling for settings navigation. (`3d03652e`)
- feat(gui): add response editor split functionality. (`bd1aaaba`)

## 1.6.0 - 2026-08-03

- feat(sse): enhance import functionality for Server-Sent Events (SSE). (`e26fa155`)
- feat(sse): implement SSE session management and protocol handling. (`d9e051bc`)
- feat(mcp-server): enhance MCP server settings and functionality. (`cf36a22f`)

## 1.5.4 - 2026-08-03

- chore(package.json): remove deprecated release scripts and tidy up formatting. (`e1e112f1`)
- feat(chat-pointers): implement custom match and parse functionality for plugin chat pointers. (`ef062d67`)

## 1.5.2 - 2026-08-02

- feat(runtime): integrate runtime management and script injection capabilities. (`074fa871`)

## 1.5.1 - 2026-08-02

- feat(theme): add page header color variables and update related styles. (`577ab426`)
- feat(theme): introduce header color variable and update related styles. (`6b6637e3`)
- feat(VariableInput): portal tooltip to document body for improved positioning. (`65430293`)

## 1.5.0 - 2026-08-01

- feat(live-page): introduce live page functionality and refactor related components. (`16f1f304`)

## 1.4.5 - 2026-08-01

- feat(websites): implement Add Live Page modal and import functionality. (`1bdbf8a4`)
- feat(live-page): refactor live page settings panel and update related functionality. (`6a3dfb3e`)
- feat(live-server): implement Add Live Server modal and import functionality. (`a36916fb`)
- feat(live-server): enhance live server and live page management. (`fba086b7`)
- feat(live-server): add openPathOnStartup configuration for live server. (`039b74dc`)

## 1.4.4 - 2026-08-01

- refactor(teamHub): introduce soft-connection handling for team hubs. (`5fc744ec`)

## 1.4.3 - 2026-08-01

- feat(live-server): integrate live-server package and enhance CLI functionality. (`890d9cd7`)

## 1.4.2 - 2026-07-31

- feat(live-server): add reverse proxy support and enhance server configuration. (`dc483636`)

## 1.4.1 - 2026-07-31

- feat(live-server): enhance SSL and routing features. (`21c7007b`)
- feat(dependencies): add Orama and OpenAI packages. (`1555db1b`)

## 1.4.0 - 2026-07-31

- feat(live-server): enhance live server functionality and UI integration. (`241f4525`)

## 1.3.9 - 2026-07-30

- Implement "Copy to chat" feature in browser context menu. (`617b273f`)
- Enhance browser functionality and introduce webpage scripting support. (`e4be8c89`)

## 1.3.8 - 2026-07-30

- Add browser-related features and tests. (`2f8eb307`)

## 1.3.7 - 2026-07-29

- Implement workflow run history management and UI enhancements. (`c87feda3`)
- Enhance development and testing workflow in AGENTS.md and CONTRIBUTING.md. (`181dc04a`)
- Refactor styling in WorkflowRecordingDialog and TimelineBlock components. (`3f0b9348`)

## 1.3.6 - 2026-07-29

- Enhance Response Editor and Summary with Close Functionality. (`e14d7c7d`)

## 1.3.5 - 2026-07-28

- Enhance CLI and GUI workflow functionalities. (`a8b8f495`)
- Enhance workflow results management and response handling. (`6a092e2e`)
- Add delayMs property to workflow management for enhanced playback control. (`eff9c395`)
- Enhance workflow execution and metadata handling. (`1390072c`)
- Enhance workflow action management with UUID integration. (`9647b650`)
- Enhance workflow management and plugin integration. (`e55d2821`)
- Implement workflow update functionality and enhance playback controls. (`443b20ec`)
- Enhance environment variable management and UI readiness. (`abab021c`)
- Update variable schema and enhance environment management. (`34cc08f0`)
- Add workspace management features to routing and state management. (`2bb3eb22`)
- Implement workflow management features. (`a4525074`)

## 1.3.4 - 2026-07-28

- Implement hc.ask API for one-shot AI completions. (`aed2809f`)
- Enhance plugin library and sidebar selection handling. (`5a919ac6`)
- Enhance settings management and UI components. (`31e7f975`)
- Refactor settings draft management and enhance default handling. (`5650b3e6`)
- Refactor BodyEditor and enhance selection handling. (`d28dd6b7`)
- Refactor shortcuts handling and update UI components. (`a85cf446`)
- Enhance response handling and UI features. (`b076b194`)

## 1.3.3 - 2026-07-27

- Update @harborclient/team-hub-api dependency to version 0.4.1 and enhance documentation for import handlers. (`516c9dae`)
- Add OpenCollection Import Functionality. (`ac4dc71a`)
- Add Appearance Options for Storage Locations, Color Markers, Highlights, and Indicators. (`ee9e54d5`)
- Rename `SidebarTabGroupItem` to `SidebarWorkspaceItem`. Breaking export rename; requires a major release.
- Refactor sidebar color handling to markers. (`6f53f3d7`)
- Add Filters and Sorting Options to Sidebar Menu. (`d17dea07`)
- Enhance menu functionality and visibility options. (`89cf8584`)

## 1.3.2 - 2026-07-26

- Add dismissedRequestEditorNotices to general settings. (`22551faa`)

## 1.3.0 - 2026-07-26

- Enhance release workflows with concurrency and rebase logic. (`e26c79de`)
- Enhance testing and plugin management functionality. (`48799cc9`)
- Enhance AI chat settings and UI components. (`ad9d10c9`)
- Enhance Toolbar component to support responsive action icon wrapping. (`f1cad2f6`)

## 1.2.7 - 2026-07-25

- Update documentation deployment workflow and enhance UI components. (`a82232bd`)

## 1.2.5 - 2026-07-25

- feat(CodeEditor): support diagnostic actions in lint hover tooltips. (`40c83c3`)

## 1.2.4 - 2026-07-25

- fix(CodeEditor): keep lint hover tooltips open across diagnostic refreshes. (`8953212`)

## 1.2.3 - 2026-07-25

- fix(SidebarHistoryItem): use status-dot-only metadata and strengthen label truncation so History sidebar rows ellipsize like Collections and Runs.

## 1.2.2 - 2026-07-25

- feat(CodeEditor): add support for host diagnostics in CodeEditor component. (`597b60a`)

## 1.2.1 - 2026-07-25

- chore: remove .eslintcache file. (`08ed38e`)
- fix(Breadcrumb): adjust SegmentShell width for better layout. (`ca8494e`)

## 1.1.35 - 2026-07-25

- fix(SegmentedTabs): improve tab layout and wrapping behavior. (`88b3eb2`)

## 1.1.34 - 2026-07-25

- fix(tests): update methodColorClass test to include badge class. (`f61eecf`)
- feat(theme): introduce metrics for typography and geometry in theme configuration. (`2df99d2`)

## 1.1.33 - 2026-07-24

- refactor(FormDataEditor): improve file selection layout and remove unnecessary conditional rendering. (`6c897b4`)

## 1.1.32 - 2026-07-23

- feat(types): add ApplyRequestDraftPayload interface and applyRequestDraft method. (`ab18b57`)

## 1.1.30 - 2026-07-21

- Fix prettier formatting in React shim memo helper.. (`2ffea4d`)
- Export memo and useReducer from the React shim.. (`4d1cabc`)

## 1.1.29 - 2026-07-21

- docs: update subscription management documentation and clarify disposal practices. (`b1d931a`)

## 1.1.28 - 2026-07-21

- refactor: streamline subscription management in plugin context. (`6ae8e6b`)

## 1.1.26 - 2026-07-21

- docs(renderer-ui): improve documentation formatting for MainViewContribution parameters. (`5e083b1`)
- feat(renderer): add optional icon property for MainViewContribution. (`642a1eb`)

## 1.1.25 - 2026-07-20

- feat(API): enhance HTTP request handling and response structure. (`504e4c4`)

## 1.1.24 - 2026-07-16

- feat(CodeEditor): add `css` language mode via `@codemirror/lang-css`.

## 1.1.23 - 2026-07-15

- feat(theme): add ThemeColorToken values for sidebar toolbar/section text, footer chrome, toolbar active state, tab underline, resize handle, and variable token; wire FooterIcon, FooterButton, Toolbar, and SidebarSection to use them.

## 1.1.22 - 2026-07-15

- feat(theme): add breadcrumb-background and breadcrumb-segment ThemeColorToken values and wire Breadcrumb to use them.

## 1.1.21 - 2026-07-15

- feat(Sidebar): improve icon alignment and add GitChangeCollection story. (`f7398ec`)

## 1.1.20 - 2026-07-15

- docs(Themes): enhance theme plugin documentation with JSON import details. (`e650013`)

## 1.1.19 - 2026-07-15

- feat(Theme): add 'doc-markdown' color token for sidebar markdown document icon. (`5d46918`)

## 1.1.18 - 2026-07-15

- feat(Sidebar): enhance commit item display with push status indicator. (`63f4f90`)

## 1.1.15 - 2026-07-15

- feat(Sidebar): refactor Sidebar components and improve exports. (`7715453`)

## 1.1.14 - 2026-07-15

- feat(Catalog): add CatalogCard and CatalogReadmeMarkdown components. (`6b815bb`)

## 1.1.13 - 2026-07-14

- feat(Sidebar): add SidebarBadge component and integrate into SidebarRunItem. (`806fcca`)

## 1.1.12 - 2026-07-14

- feat(VariableInput): enhance tooltip functionality and accessibility. (`ec05179`)

## 1.1.11 - 2026-07-14

- feat(Breadcrumb): add Breadcrumb component and type exports. (`ceda104`)

## 1.1.10 - 2026-07-14

- feat(Sidebar): enhance accessibility for sidebar items. (`96d3be2`)

## 1.1.9 - 2026-07-14

- feat(Sidebar): enhance sidebar functionality with new components and accessibility improvements. (`1c84c6d`)

## 1.1.8 - 2026-07-14

- feat(Sidebar): enhance sidebar with scrollable content and add empty state. (`e07d0c5`)

## 1.1.6 - 2026-07-14

- feat(Sidebar): implement resizable sidebar with scrollbars. (`682d918`)

## 1.1.5 - 2026-07-14

- fix(types): update git-related color tokens for accuracy. (`f6385df`)

## 1.1.4 - 2026-07-14

- style(EmptySectionLabel): update border style for improved visual distinction. (`b6538c9`)

## 1.1.3 - 2026-07-13

- style(EmptySectionLabel): reorder class names for improved readability. (`41ee1b0`)
- fix(EmptySectionLabel): change div to span and update styling. (`9b8013d`)

## 1.1.2 - 2026-07-13

- feat(EmptySectionLabel): add EmptySectionLabel component and its props to exports. (`5d1c1d0`)

## 1.1.1 - 2026-07-13

- feat(mcp): add support for remote MCP client server registration. (`e81054e`)

## 1.1.0 - 2026-07-13

- feat(ci, release): enhance workflows with manual inputs for branch and version bump. (`bdffa6c`)

## 1.0.77 - 2026-07-13

- feat(ColorPicker): set default value and onChange handler in ColorPicker story. (`19fda35`)

## 1.0.75 - 2026-07-12

- fix(styles): standardize body text size and line height across components. (`772dd57`)

## 1.0.74 - 2026-07-12

- refactor(KeyValueEditor, VariableTable): remove padding from table cells. (`895cd98`)

## 1.0.73 - 2026-07-12

- feat(footer-panel, resizable): replace button with RoundButton component. (`e0714a4`)

## 1.0.72 - 2026-07-12

- feat(types): add 'terminal' theme color token to ThemeColorToken type. (`00be7d1`)

## 1.0.71 - 2026-07-11

- feat(row-actions-menu): add placement option for menu positioning. (`c44408e`)

## 1.0.69 - 2026-07-11

- feat(row-actions-menu): enhance menu item functionality and styling. (`6a7a702`)

## 1.0.68 - 2026-07-11

- feat(tab-bar): implement drag-and-drop functionality for tab reordering. (`6ac2b6e`)

## 1.0.67 - 2026-07-11

- fix(footer-panel): update import path for FooterPanel component. (`3a4bdbe`)
- chore(.gitignore): remove .vscode directory from ignore list. (`c85f9c1`)
- feat(footer-button): make `active` and `controlsId` props optional. (`83bbd48`)

## 1.0.66 - 2026-07-11

- docs: enhance documentation for import handlers and update related references. (`c1cc35b`)

## 1.0.64 - 2026-07-10

- fix(tests): ensure consistent formatting in import handler test. (`e38c9a3`)
- fix(tests): update import handler test for consistent formatting. (`89509d1`)
- feat(imports): add file import handler registration functionality. (`8d85a8f`)

## 1.0.63 - 2026-07-10

- feat(footer-icon): add `activeStyle` prop with toolbar-matching `selection` variant.

## 1.0.61 - 2026-07-10

- feat(actions): introduce action registration for dynamic menu commands. (`5e78027`)

## 1.0.60 - 2026-07-10

- feat(autocomplete): enhance AutocompleteInput and SuggestionList functionality. (`16907c0`)

## 1.0.59 - 2026-07-10

- feat(code-editor): enhance selection action toolbar and tooltip functionality. (`5718362`)

## 1.0.58 - 2026-07-10

- feat(toolbar): add support for right-aligned toggles and refactor action rendering. (`b2d4002`)

## 1.0.57 - 2026-07-10

- feat(editor): enhance syntax-highlighted placeholder functionality. (`4d1fe81`)

## 1.0.55 - 2026-07-10

- fix(variables): enhance variable substitution with filter support. (`3968373`)

## 1.0.54 - 2026-07-09

- docs(snippets): standardize import syntax and improve formatting. (`b6b0630`)
- docs: add snippets documentation and update sidebar. (`83b61ad`)

## 1.0.53 - 2026-07-09

- docs: enhance hc.data documentation and introduce new data property. (`ac16ba6`)

## 1.0.52 - 2026-07-09

- feat(types): add new script stage accent colors to ThemeColorToken. (`35ff9d7`)

## 1.0.50 - 2026-07-09

- style(PageSidebar): increase width of sidebar from 180px to 220px for improved layout. (`a6679c8`)

## 1.0.49 - 2026-07-09

- docs: update React integration instructions across multiple documents. (`3268077`)

## 1.0.43 - 2026-07-08

- chore(package): remove unused types entry from package.json. (`65bf340`)

## 1.0.41 - 2026-07-07

- fix(docs): update variable references in API documentation and type definitions. (`110f9f1`)

## 1.0.40 - 2026-07-07

- fix(snippets): correct indentation in HcExpectMatcher interface. (`82b249d`)

## 1.0.39 - 2026-07-07

- chore(package): update keywords in package.json to include plugins, themes, and snippets. (`84a709e`)

## 1.0.37 - 2026-07-07

- Enhance signing functionality to support snippets-only bundles. (`de418a0`)

## 1.0.36 - 2026-07-05

- Refactor Toolbar component styles for improved consistency and added pressed state story. (`d1bc41d`)

## 1.0.35 - 2026-07-04

- Enhance SegmentedTabs component styling for improved alignment. (`4e8ecea`)

## 1.0.34 - 2026-07-04

- Update toolbar action button styles for improved visual consistency. (`221a733`)

## 1.0.33 - 2026-07-04

- Refactor CLI signing functionality for improved path resolution and environment variable support. (`1f815dc`)

## 1.0.32 - 2026-07-04

- Refactor SegmentedTabs component for improved code readability. (`ae5f9b0`)
- Refactor SegmentedTabs component for improved styling and layout. (`96a2f5f`)

## 1.0.31 - 2026-07-04

- Update PageHeader component styles for improved visual consistency. (`eea60fb`)

## 1.0.30 - 2026-07-04

- Refactor Modal, PageSidebar, and SegmentedTabs components for improved readability. (`f9fe5b8`)
- Refactor components to enhance type safety and props handling. (`c777731`)
- Refactor AsyncListState and Card components for improved structure and clarity. (`6a6024c`)
- Enhance project configuration and component utilities. (`eec167c`)

## 1.0.29 - 2026-07-04

- Update documentation to clarify plugin and theme management. (`36bdeb7`)

## 1.0.28 - 2026-07-03

- Update Toolbar component styles for improved UI consistency. (`488a52e`)

## 1.0.27 - 2026-07-03

- Update RowActionsMenu styles for improved UI consistency. (`744e875`)

## 1.0.26 - 2026-07-03

- Enhance CodeEditor with linting support and new story examples. (`ec17c1f`)

## 1.0.25 - 2026-07-03

- Refactor CodeEditor component to simplify editor creation callback. (`7352dfa`)

## 1.0.23 - 2026-07-02

- Fix export statement in styles.css.d.ts for consistency. (`7b2a250`)
- Update ESLint cache, enhance package.json exports, and copy TypeScript definitions for styles. (`fd163a5`)
- Refactor FormGroup component for improved ID resolution logic. (`820049b`)
- Update package version to 1.0.22 and enhance sideEffects configuration. (`3b2ff8f`)
- Update package description for clarity and consistency. (`d3c8e14`)
- Refactor component styles for improved consistency and accessibility. (`58090ba`)

## 1.0.21 - 2026-07-02

- Update MethodSelect component styles for improved focus visibility. (`1077ed8`)

## 1.0.20 - 2026-07-02

- Enhance TabCloseButton component with tabIndex prop for improved accessibility. (`4053939`)
- Enhance SegmentedTabs component with keyboard navigation improvements. (`6ec88d2`)

## 1.0.19 - 2026-07-02

- Enhance MethodSelect component with dynamic method color classes. (`6fbc2f2`)

## 1.0.18 - 2026-07-02

- Refactor SegmentedTabs component styles for improved layout and accessibility. (`5993349`)

## 1.0.17 - 2026-07-02

- Refactor SegmentedTabs component for improved accessibility attributes. (`c11f504`)
- Enhance SegmentedTabs component with editable tab visibility features. (`144d978`)

## 1.0.16 - 2026-07-02

- Enhance Radio component styling with new radioDot class. (`fe1ca3e`)

## 1.0.15 - 2026-07-02

- Enhance VariableInput and form styles for improved usability. (`fc6eca5`)

## 1.0.14 - 2026-07-02

- Refactor PageHeader component for improved readability. (`1654121`)
- Enhance FormGroup and PageHeader components for improved usability and styling. (`739a87b`)

## 1.0.13 - 2026-07-02

- Refactor FormGroup component to improve ID resolution logic. (`6ad450d`)
- Enhance FormGroup and VariableInput components for improved usability and styling. (`673bf2b`)

## 1.0.12 - 2026-07-01

- Enhance PageHeader component styling for improved visual hierarchy. (`d6dbfe6`)

## 1.0.11 - 2026-07-01

- Enhance PageSidebar component styling for improved user interaction. (`b3c5fd9`)

## 1.0.10 - 2026-07-01

- Update PageSidebar component styles for improved layout. (`3e63d44`)

## 1.0.9 - 2026-07-01

- chore: update version to 1.0.8 and enhance BackButton component accessibility and styling. (`bec3759`)

## 1.0.7 - 2026-07-01

- Refactor Modal and SegmentedTabs components for improved code clarity. (`0ac6fce`)
- Enhance component styling with consistent class prefixes. (`d86919a`)

## 1.0.6 - 2026-07-01

- Refactor PageHeader and SidebarLayout components for improved styling. (`49caa57`)

## 1.0.5 - 2026-07-01

- Update PageHeader component styles to improve padding and layout consistency. (`7205c06`)

## 1.0.4 - 2026-07-01

- Add linting instructions to AGENTS.md. (`440e1de`)
- Update PageHeader component styles for improved layout. (`88aa4e7`)
- Test changelog hook. (`12b6780`)

## 1.0.1 - 2026-06-30

- `createStorageStore` now hydrates from storage on creation.

## 0.6.17 - 2026-06-30

- Add `@harborclient/sdk/react-dom` with host-delegated `createPortal` for plugin portals.
- Add `portalToBody` helper in `@harborclient/sdk/components` for modals that must escape overflow-hidden plugin webview containers.

## 0.7.0 - 2026-06-30

- Add `registerTheme(hc, theme)` and `defineTheme(theme)` helpers for theme plugins — `registerTheme` registers a theme and pushes its disposable onto `hc.subscriptions`.
- Add `requestKey` to `RequestTabContext` and `ResponseTabContext` — stable per-request identifier for namespacing persistent plugin state (`req:<id>` for saved requests, `METHOD url` fallback for unsaved tabs).

## 0.6.11 - 2026-06-29

- Fix Checkbox and Radio click target alignment: pass pointer events through the decorative box/circle and pin the wrapper to 18px so the overlay input matches the visible control.

## 0.4.4 - 2026-06-26

- Document global variables for plugins: precedence chain, `RequestTabContext.variables`, and `harborclient:updateGlobalVariables` host command.
- Clarify `RequestTabContext.variables` JSDoc to include globals in the merge order.

## 0.4.3 - 2026-06-25

- Rename npm package from `@harborclient/plugin-api` to `@harborclient/sdk`.
- Move documentation site from `harborclient.github.io/plugin-api/` to `harborclient.github.io/sdk/`.
- **Breaking:** Plugin authors must update imports, `jsxImportSource`, and esbuild `--jsx-import-source` to `@harborclient/sdk`, then rebuild plugin bundles.

## 0.4.0 - 2026-06-25

- Add `@harborclient/sdk/signing` with `signPlugin`, `verifyPlugin`, and CLI tools (`hc-plugin-sign`, `hc-plugin-verify`).

## 0.3.3 - 2026-06-25

- Add `hc.host.sendRequest()` to send the active request editor tab from plugins.

## 0.3.1 - 2026-06-24

- Export utility subpaths: `./http`, `./ui`, `./storage`, `./clipboard`, `./runtime-utils`, and `./store`.
- Restore utility module sources under `src/` so `tsc` rebuilds them (previously only committed in `dist/`).

## 0.3.0 - 2026-06-24

- Add renderer `hc.http.onAfterSend`, `hc.ipc.invoke`, and `hc.host` (`openRequestDraft`, `loadRequest`) to `PluginContext`.
- Add `OpenRequestDraftPayload`, `OpenRequestDraftParam`, `PluginRendererHttp`, `PluginIpcInvoker`, and `PluginHost` types.
- Extend `PluginHttpRequest` with `bodyType`, `params`, `sourceRequestId`, and `sourceRequestName`.

## 0.2.5 - 2026-06-24

- Add React/JSX runtime (`installReact`, `createPluginComponent`, `@harborclient/sdk/react`, `@harborclient/sdk/jsx-runtime`).
- Add `pluginId` to `PluginContext`.

## 0.2.1 - 2026-06-24

- Extend `RequestTabContext` with `variables` for merged collection and environment {{key}} substitution.

## 0.2.0 - 2026-06-24

- Add `AuthType`, `AuthConfig`, and `BodyType` types for plugin authors.
- Extend `RequestDraft` with `auth` and `body_type` fields.
- Extend `RequestTabContext` with `collectionAuth` and `collectionHeaders` for send-time defaults.

## 0.1.2 - 2026-06-24

- Add main-process types (`MainPluginContext`, `PluginHttp`, `PluginIpc`, `PluginHttpRequest`, `PluginHttpResponse`) and `@harborclient/sdk/main` subpath export.
- Add renderer `PluginFs` types and `fs` on `PluginContext`.

## 0.1.1 - 2026-06-24

- Initial standalone npm package extracted from HarborClient monorepo.
