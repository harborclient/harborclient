# Changelog

## Unreleased

- refactor(menu): update theme menu item handling. (`bcf4d08`)
- feat(menu): update menu labels and add tabId support across components. (`7194fda`)
- refactor(menu): remove collections, environments, and run results visibility from menu. (`068258d`)
- feat(menu): update tab group menu item and add new environment option. (`44952c7`)

## 2.5.2 - 2026-07-16

- chore(docs): update search index JSON structure. (`802c342`)
- feat(environments): implement copy missing variables functionality. (`99686bc`)
- feat(settings): introduce close-to-tray functionality in general settings. (`b1f992b`)

## 2.5.1 - 2026-07-16

- feat(theme): update footer and sidebar styles across themes. (`6992c4f`)
- feat(theme): enhance high-contrast theme with updated colors and styles. (`a1c80a5`)
- chore(dependencies): update @harborclient/sdk to version 1.1.22 and enhance theme configurations. (`4685d66`)
- chore(catalog): update theme references to latest versions. (`89f7852`)

## 2.5.0 - 2026-07-15

- feat(collections): enhance collection management and Git integration. (`af4f99c`)
- feat(prettier): add consistent quote properties and refactor header syntax. (`decdc01`)
- refactor(routing): streamline page reference handling and tab management. (`54f1813`)

## 2.4.3 - 2026-07-15

- feat(markdown): enhance markdown tab reconciliation and theme support. (`0fb9d9c`)
- fix(git): update harbor-root document handling and disambiguation. (`d2c6a08`)
- feat(git): enhance GitHub authentication and repository access validation. (`c8de408`)

## 2.4.2 - 2026-07-15

- feat(ui): implement scoped settings core functionality and tests. (`bcb4ad8`)
- refactor(ui): remove Scrollbars component and update import paths. (`02a4f35`)

## 2.4.1 - 2026-07-15

- refactor(imports): update import paths to relative references. (`8b9ac8e`)
- feat(ui): enhance Action Menu Modal with new components and functionality. (`c9276c0`)
- refactor(ui): reorganize component imports to Tabs directory. (`af5b0b1`)
- refactor(ui): update modal and component import paths. (`6aa1f7a`)
- refactor(ui): reorganize shared component imports and update paths. (`c05728b`)
- feat(ui): add animated collapse and horizontal panel components. (`afec5d0`)
- feat(ui): implement typed delete confirmation hook and UI enhancements. (`4313a7f`)

## 2.4.0 - 2026-07-14

- refactor(ui): remove unused openDocumentIds and openRequestIds props. (`838a8bd`)
- feat(ui): enhance skip navigation and focus management. (`3aa9ad1`)
- feat(dependencies): update @harborclient/sdk to a local link and add dotenv. (`68f42c6`)
- feat(git): enhance commit functionality and request tracking. (`4d48935`)

## 2.3.1 - 2026-07-14

- feat(git): enhance file classification and testing for collection requests. (`d69d103`)
- feat(git): enhance Git diff functionality and request metadata handling. (`864eb61`)
- refactor(ai): update client creation to return promises and enhance Git integration. (`e8d7c1e`)
- feat(git): enhance Git menu integration and functionality. (`5d44f7c`)
- feat(git): enhance Git sidebar functionality and theme updates. (`848352d`)
- feat(git): implement git diff functionality for uncommitted changes. (`5657233`)
- feat(git): enhance git identity management and host-based authentication. (`97ee2ac`)
- feat(git): add support for reading remote URLs and enhance git connection management. (`92b43d4`)

## 2.3.0 - 2026-07-13

- feat(dependencies, themes): update harborclient packages and enhance theme management. (`d5562a1`)

## 2.2.4 - 2026-07-12

- chore(dependencies): update @harborclient/sdk to version 1.0.75. (`cb147d3`)
- feat(markdown): implement get_markdown_document tool and enhance markdown handling. (`01e463c`)

## 2.2.3 - 2026-07-12

- feat(collections, themes): enhance built-in collections and theme management. (`9936f04`)
- chore(dependencies): update @harborclient/sdk to version 1.0.74. (`67971e2`)

## 2.2.2 - 2026-07-12

- feat(environments, tabGroups): implement local reordering for environments and tab groups. (`69d9e2b`)
- feat(collections): implement local reordering and moving of collections and container items. (`f769b9b`)

## 2.2.1 - 2026-07-12

- chore(dependencies): update @harborclient/sdk to version 1.0.72. (`d79aa21`)
- refactor(terminal-panel): remove description from TerminalPanel component. (`00a0d99`)

## 2.2.0 - 2026-07-12

- feat(settings): enhance terminal and panel layout settings. (`d9cb138`)
- feat(terminal): integrate terminal functionality into the application. (`7de2b9e`)

## 2.1.0 - 2026-07-11

- fix(tests): add truncation for documents in MySQL and Postgres tables. (`10b743c`)
- chore(dependencies): update @harborclient/sdk and plugin versions. (`944858f`)
- chore(sidebar): refactor and enhance sidebar functionality. (`731d210`)
- refactor: reorganize sidebar components and update dependencies. (`58ac899`)
- feat(documents): implement markdown document management features. (`2f5a61c`)
- feat(settings): add wrapTabs option for improved tab management. (`1157309`)

## 2.0.19 - 2026-07-11

- feat(themes): add built-in themes and enhance theme management. (`678e050`)

## 2.0.18 - 2026-07-10

- chore: update @harborclient/sdk dependency to version 1.0.63. (`0924aac`)
- fix(aiSidebar): replace send icon with confirmation icon. (`4cdd661`)
- refactor: update HarborClient SDK reference and enhance footer UI components. (`02dc064`)

## 2.0.17 - 2026-07-10

- feat(action-menu): implement Action menu functionality and refactor related components. (`7c7418c`)
- feat(aiChat): add startNewChatWithPrompt thunk for initiating chats with user prompts. (`1019fb8`)
- fix: update references to HarborClient in comments and code. (`6997b96`)

## 2.0.16 - 2026-07-10

- feat(teamHub): enhance Team Hub invitation and menu functionality. (`e10084c`)
- feat(teamHub): add Accept Team Hub Invite functionality. (`a875960`)

## 2.0.15 - 2026-07-10

- feat(teamHub): implement Team Hub invitation management and token storage. (`5f83aae`)
- feat(settings): add new warning preferences for unsaved changes and requests. (`6cd5c4f`)

## 2.0.14 - 2026-07-10

- feat(folders): enhance folder management with new properties and update functionality. (`54727ce`)
- feat(logging): integrate Winston for file logging with daily rotation. (`b2324e1`)
- feat(getting-started): implement Getting Started feature with documentation and UI integration. (`266123a`)
- fix(docs): update internalDocumentIDStore in docsSearchIndex.json. (`249a3b5`)
- fix(docs): update docsSearchIndex.json with new internal document IDs. (`bd47ea4`)
- feat(scripting): enhance module import handling and testing. (`87d263e`)

## 2.0.13 - 2026-07-09

- feat(scripting): enhance snippet import functionality and introduce module bundling. (`3122417`)
- feat(scripting): introduce hc.data for mutable state across scripts. (`104cfb4`)

## 2.0.12 - 2026-07-09

- fix(tests): update service configurations and enhance theme styling. (`ff8cb2f`)
- feat(docs): implement documentation indexing and enhance team hub integration. (`48c7f55`)
- chore(dependencies): update @harborclient/sdk to v1.0.50 and improve editor layouts. (`a139cf8`)
- feat(snippets): enhance snippet detail functionality and UI. (`a999819`)

## 2.0.11 - 2026-07-09

- feat(roadmap): update roadmap to reflect current project status and planned features. (`accbd0a`)
- feat(screenshots): enhance screenshot capturing and add new collection-related images. (`9ab7f77`)
- feat(storage): implement script editor UI state migration and enhance script reference merging. (`fa26113`)
- feat(completions): enhance hcCompletions with Chai matchers and live completion sources. (`45e4817`)
- chore(dependencies): update @harborclient/sdk to v1.0.46 and refactor response assertions. (`c1720b3`)
- chore(dependencies): update @harborclient/sdk to v1.0.45 and add chai with type definitions. (`115cdd5`)

## 2.0.10 - 2026-07-08

- feat(ui): enhance VariablesPanel and ResponseEditor with improved layouts and functionality. (`ac4a627`)

## 2.0.9 - 2026-07-08

- feat(scrollbars): integrate OverlayScrollbars and add scrollbar auto-hide feature. (`df61a0d`)
- feat(run-results): implement run results management and UI enhancements. (`9b8d65d`)
- feat(import): enhance import functionality for snippets and themes. (`9a47438`)
- feat(run-results): implement export and import functionality for run results. (`6146468`)
- feat(catalog): add new snippet reference for authentication. (`20a6987`)

## 2.0.8 - 2026-07-07

- feat(menu): implement Creator tab undo/redo functionality. (`d7c8446`)
- feat(themes): introduce custom theme management and enhance theme functionality. (`c1987bc`)
- feat(screenshots): enhance screenshot capturing and add new test scenarios. (`aa5d343`)

## 2.0.7 - 2026-07-07

- chore(deps): update @harborclient/sdk to version 1.0.40 and update snippet reference to v1.0.2. (`26abadd`)

## 2.0.6 - 2026-07-07

- feat(team-hub): implement admin snippet management features. (`19a8d8c`)
- feat(snippets): implement snippet management features. (`06fe0e1`)
- feat(snippets): add uninstall functionality for marketplace snippet bundles. (`9a28865`)

## 2.0.5 - 2026-07-07

- feat(snippets): implement deep link support for snippet installation. (`2376701`)
- feat(snippets): enhance snippet management with catalog and installation features. (`9018a76`)
- feat(snippets): introduce Snippets management feature. (`bdceb5e`)
- docs(AGENTS): add HarborClient style guidelines for brand assets. (`8249deb`)
- feat(chat): enhance ChatComposer with new icons and embedded textarea support. (`9a03d04`)
- chore: update README.md for improved user guidance. (`1fe7b54`)
- chore: update project description for clarity. (`9a96d69`)

## 2.0.4 - 2026-07-06

- feat(mcp): integrate Model Context Protocol SDK and enhance MCP functionality. (`8554da7`)
- feat(settings): add warnWhenClickingReadonlySnippet setting. (`a4a4110`)
- refactor(ai): reorganize imports and introduce chat context utilities. (`11f364b`)
- fix(dependencies): update electron-builder to address compatibility issues. (`0355d56`)

## 2.0.3 - 2026-07-05

- fix(workflow): add libxcrypt-compat dependency for RPM build support in release workflow. (`2cb51a4`)

## 2.0.2 - 2026-07-05

- feat(build): add RPM support and update maintainer information. (`9f47027`)

## 2.0.1 - 2026-07-05

- chore(catalog): update plugin references to latest versions. (`30716cf`)

## 2.0.0 - 2026-07-05

- feat(splash-screen): update splash screen dimensions and styles; enhance About dialog with logo link. (`73fbd60`)
- feat(script-refs): introduce normalizeScriptRefsForCompare function and update related tests. (`8c6707c`)
- chore(dependencies): update @harborclient/sdk to version 1.0.36. (`7efb32e`)
- feat(about-modal): add social media links to About dialog. (`ef411dd`)
- refactor(headers): replace MDN links with HeaderNameLink component. (`b239815`)
- refactor(changelog): improve merge guard logic and documentation. (`27a32c7`)
- feat(headers): enhance header display with MDN documentation links. (`64636ac`)

## 1.9.29 - 2026-07-05

- chore(dependencies): update @harborclient/http to version 0.1.2 and enhance console output handling. (`9ea5260`)

## 1.9.28 - 2026-07-04

- feat(cookies): implement cookie management UI and functionality. (`d611cb5`)
- chore(dependencies): update @harborclient/sdk to version 1.0.35 and enhance UI button states for better accessibility. (`0dae321`)

## 1.9.27 - 2026-07-04

- chore(dependencies): update @harborclient/sdk to version 1.0.34 and adjust UI text sizes in sidebar components. (`e285038`)
- chore(plugins): add theme-nord entry back to catalog.json with version reference v1.0.6. (`16a4b94`)
- fix(workflows): update GitHub API endpoint for site dispatch notifications. (`35ea5cd`)
- chore(plugins): reorder theme-nord entry in catalog.json and maintain version reference. (`ea6963e`)
- chore(plugins): update plugin reference to version 1.0.12 in catalog.json. (`fccc2b4`)
- chore(plugins): update plugin reference to version 1.0.7 in catalog.json and adjust splash screen dimensions and version display. (`c5ce11c`)

## 1.9.26 - 2026-07-04

- chore(plugins): update plugin repository URLs and versions in catalog.json. (`79168b1`)
- chore(plugins): update plugin reference to version 1.0.11 in catalog.json. (`cf29b8e`)
- chore(dependencies): upgrade @harborclient/sdk to version 1.0.33 and update plugin references. (`260006b`)

## 1.9.25 - 2026-07-04

- chore(dependencies): upgrade @harborclient/sdk to version 1.0.32. (`4818229`)
- feat(tags): implement tag management in request editor. (`dceba7d`)
- feat(plugins): update plugin settings and remove deprecated SourceListSection. (`3885cc9`)
- feat(plugins): update CatalogCard and InstalledPluginCard to use Card component from @harborclient/sdk. (`bb3e737`)
- fix(plugins): improve button alignment in InstalledPluginFooterActions. (`f3b52cf`)
- fix(plugins): center align buttons in InstalledPluginFooterActions component. (`248b80d`)

## 1.9.24 - 2026-07-04

- fix(deep-links): resolve theme installation issues in deep-link handling. (`0f8cb1d`)
- feat(themes): enhance theme contributions and filtering capabilities. (`4af5c5b`)

## 1.9.23 - 2026-07-04

- feat(deep-links): add theme support to deep-link handling and related components. (`f8a042f`)
- feat(themes): implement themes management and related functionalities. (`4a5ff2c`)

## 1.9.22 - 2026-07-03

- feat(scripts): enhance request handling with pre/post script arrays and tags. (`a5ab177`)
- feat(requests): add tags field to request schema and related functionalities. (`9ef116f`)

## 1.9.21 - 2026-07-03

- feat(search): introduce global search functionality and related UI components. (`77cc15b`)

## 1.9.20 - 2026-07-03

- feat(collection-runner): enhance modal to support single request execution. (`0cae7f7`)
- feat(settings): enhance quit behavior and theme options. (`36176f6`)
- feat(fontawesome): update icons in settings and script editor. (`d98988a`)

## 1.9.19 - 2026-07-03

- chore(dependencies): update @harborclient/sdk to version 1.0.26. (`233060d`)
- feat(chat): enhance chat title generation and update dependencies. (`e9fdc3e`)
- feat(chat): implement abort signal handling for chat steps. (`e6509cf`)

## 1.9.18 - 2026-07-03

- feat(settings): add script timeout configuration and related tests. (`a438ac0`)
- feat(ai): implement update_request_script tool for inline script management. (`1d94931`)
- chore(dependencies): update @harborclient/sdk to version 1.0.23 and adjust styles. (`a4df70e`)

## 1.9.17 - 2026-07-02

- feat(theme): implement theme picker and shortcuts reference modals. (`db47b7f`)
- fix(TabBar): adjust minimum height for improved layout consistency. (`9031701`)
- fix(RequestEditor): simplify class names for layout consistency. (`0027da9`)
- feat(environments): add merge environment down functionality. (`b02de45`)

## 1.9.16 - 2026-07-02

- feat(ui): enhance settings and editor sections with improved descriptions and layout. (`26ba43d`)

## 1.9.15 - 2026-07-02

- refactor(verifiedPublisherBadge): remove unused badge functionality and update import path. (`c577bb4`)

## 1.9.14 - 2026-07-02

- feat(editor): enhance request and response editor visibility management. (`afaba6f`)

## 1.9.13 - 2026-07-02

- feat(settings): add warnWhenSwitchingThemes option and related functionality. (`4cbd011`)
- feat(menu): add Collections and Environments visibility toggles in the application menu. (`786b9b2`)
- feat(editor): integrate MDXEditor for enhanced comment functionality and update styles. (`ea143fb`)
- chore(dependencies): update @harborclient/sdk to version 1.0.15 and adjust styles across various components. (`20a8205`)

## 1.9.12 - 2026-07-02

- feat(scripts): introduce pre/post request script management and snippet functionality. (`55480e3`)
- feat(ui): enhance button styling and layout across various components. (`9b2b936`)
- feat(theme): implement theme management in application menu. (`ba03f8a`)
- fix(settings): update storage section label and enhance button styling. (`25aa8b8`)

## 1.9.11 - 2026-07-01

- feat(sidebar): enhance sidebar row styling and functionality. (`a7454cd`)
- refactor(settings): improve layout and styling across settings sections. (`216140f`)
- feat(request-editor): enhance NoOpenRequests component with icon and improved layout. (`c745bec`)

## 1.9.10 - 2026-07-01

- fix(tabs): refactor tab management and enhance page navigation. (`3249900`)

## 1.9.9 - 2026-07-01

- feat(sidebar): integrate @szhsin/react-accordion for improved sidebar navigation. (`dc35d4b`)

## 1.9.8 - 2026-07-01

- feat(settings): implement settings search functionality and enhance navigation. (`866fa0f`)
- feat(request-editor): refactor and enhance RequestEditor component. (`7c11038`)
- feat(plugins): add plugin management features and enhance developer tools. (`0fcd9ff`)

## 1.9.6 - 2026-07-01

- fix(catalog): update plugin version to v1.0.7 and enhance ScreenshotCarousel functionality. (`71ee623`)
- feat(plugin-detail-modal): enhance screenshot handling in PluginDetailModal. (`a07c307`)

## 1.9.5 - 2026-07-01

- chore(dependencies): update @harborclient/sdk to version 1.0.3 in package.json and pnpm-lock.yaml. (`c361b7b`)
- fix(catalog): update plugin version for plugin-catppuccin-latte to v1.0.4. (`39c4860`)
- feat(catalog): add optional description field and update plugin version. (`615996f`)

## 1.9.4 - 2026-07-01

- feat(plugins): update plugin catalog with new screenshot handling and optional summary field. (`9e7e4cf`)

## 1.9.3 - 2026-07-01

- feat(autocomplete): implement autocomplete functionality for headers, params, and cookies. (`1f33c97`)
- feat(shortcuts): add search functionality to shortcuts section. (`992a158`)
- feat(menu): add new menu actions and shortcuts for improved navigation. (`c88df8a`)

## 1.9.2 - 2026-06-30

- feat(shortcuts): add new menu actions and their default accelerators. (`809c61d`)

## 1.9.1 - 2026-06-30

- feat(build): enhance electron-builder configuration and Vite setup. (`be1fef7`)

## 1.9.0 - 2026-06-30

- feat(deps): upgrade @harborclient/sdk to version 1.0.0 and update plugin versions. (`2a1565d`)
- feat(plugins): update plugin versions and enhance theme registration. (`c1fdd45`)
- feat(plugins): enhance plugin filesystem operations and UI interactions. (`dccf6ce`)
- feat(plugins): implement plugin UI broker and enhance plugin communication. (`fcaa067`)

## 1.8.38 - 2026-06-29

- chore(deps): update @harborclient/sdk to version 0.6.12 in package.json and pnpm-lock.yaml; refactor checkbox components in various UI sections. (`24d90ed`)

## 1.8.37 - 2026-06-29

- chore(deps): update @harborclient/sdk to version 0.6.7 in package.json and pnpm-lock.yaml. (`9c8a58c`)
- chore(deps): update @harborclient/sdk to version 0.6.6 and adjust type overrides in package.json and pnpm-lock.yaml. (`6ac32f1`)

## 1.8.36 - 2026-06-29

- chore(deps): update @harborclient/sdk to version 0.6.4 in package.json and pnpm-lock.yaml. (`ca9d3c2`)

## 1.8.35 - 2026-06-29

- fix(ui): adjust icon sizes in BreadcrumbPrefix and Response components. (`73d12cd`)

## 1.8.34 - 2026-06-29

- feat(git): implement pre-commit hook to prevent local SDK link overrides. (`938db30`)
- chore: update documentation and configuration files. (`381d0ef`)

## 1.8.33 - 2026-06-28

- feat(http): add @harborclient/http package and improve splash screen error handling. (`e865ec5`)

## 1.8.32 - 2026-06-28

- feat(plugins): enhance plugin loading with JavaScript MIME type support. (`94d17c9`)

## 1.8.31 - 2026-06-28

- feat(plugins): integrate React and ReactDOM for plugin support. (`72c1af2`)
- refactor: update path handling and improve navigation security. (`05587e6`)

## 1.8.30 - 2026-06-28

- refactor(plugins): improve error handling and logging for plugin activation failures. (`929a37c`)

## 1.8.29 - 2026-06-28

- Update .gitignore and clean up build-docs-nav script. (`b67c989`)
- feat(plugins): implement resolvePendingPluginInstallDeepLink function for improved plugin installation handling. (`ea7baf9`)

## 1.8.28 - 2026-06-28

- feat(plugins): introduce --disable-plugins flag for session-based plugin management. (`293d6a3`)

## 1.8.27 - 2026-06-28

- feat(dependencies): add nanoid package version 3.3.8 to project. (`63a58e4`)

## 1.8.26 - 2026-06-28

- feat(deep-linking): implement harborclient protocol for plugin installation. (`ec00f60`)
- feat(response): enhance response handling to include optional base64 encoding for image content. (`5d28aba`)
- feat(plugins): add new HTTPie and JSON Schema Validator plugins, update plugin catalog. (`a02d0a5`)

## 1.8.25 - 2026-06-28

- chore(package): update @harborclient/team-hub-api dependency to version 0.1.1. (`58914e4`)
- feat(team-hub): integrate @harborclient/team-hub-api for improved team hub functionality. (`81b6804`)

## 1.8.24 - 2026-06-28

- feat(requests): implement redirect following functionality in HTTP requests. (`9031ccf`)

## 1.8.23 - 2026-06-28

- chore(package): update @harborclient/sdk version and add new dependencies. (`578571f`)
- chore(package): remove local SDK link from package.json overrides. (`70a5bef`)
- fix(ui): improve code formatting in Sidebar component and adjust PluginScreenshot type definition. (`0886e98`)
- feat(plugins): update plugin database management and enhance plugin storage access. (`93c5d6b`)
- feat(plugins): implement theme prompt for user-enabled plugins. (`6bfd7fa`)
- feat(plugins): add Catppuccin Latte and Nord themes to plugin catalog. (`15f58d1`)

## 1.8.22 - 2026-06-27

- feat(docs): update documentation structure and enhance plugin catalog. (`1d0b18a`)
- feat(plugins): add new plugins and update existing ones in the catalog. (`8e9b581`)
- feat(plugins): enhance plugin catalog functionality and filtering. (`395951e`)
- feat(tabs): enhance tab management with empty state handling and improved persistence. (`54d8a59`)

## 1.8.21 - 2026-06-27

- feat(plugins): update plugin versions and enhance auth configuration. (`b985ffd`)
- feat(tabs): implement open tabs persistence and migration. (`535a436`)
- feat(plugin-manager): add support for unpacked plugin loading and signature handling. (`cd98d88`)
- refactor: update component imports to use @harborclient/sdk/components. (`fdd9358`)
- refactor: update imports and integrate @harborclient/sdk. (`af6660b`)
- chore(package): update @harborclient/sdk to version 0.4.6. (`ea712d4`)

## 1.8.20 - 2026-06-27

- chore(package): update @harborclient/sdk to version 0.4.5. (`09616a3`)
- chore(package): update @harborclient/sdk to version 0.4.5. (`e993bfc`)
- feat(echo-server): implement HTTP echo server plugin with request handling. (`5611b66`)
- feat(import): add support for importing Bruno collections and enhance import functionality. (`360ef76`)
- feat(scripting): integrate script context creation and clean up script evaluator. (`c9c18e7`)
- feat(globals): introduce app-wide global variables management. (`f9c8fc7`)

## 1.8.19 - 2026-06-26

- feat(plugins): add plugin preview functionality from GitHub repositories. (`63e9a26`)
- feat(ui): enhance user interface with new icons and improved button components. (`328b03e`)
- feat(ui): introduce new components for enhanced user experience and accessibility. (`0b5ddfa`)
- refactor(sharing-keys): streamline sharing keys components and enhance accessibility. (`0915d36`)
- refactor(footer): replace button elements with FooterButton and FooterIcon components. (`9fbddbf`)
- refactor(footer): streamline footer panel components and remove unused utilities. (`8b68b35`)
- feat(form): introduce FormGroup component for consistent form layout. (`9708ab0`)
- feat(modal): enhance modal components with new structure and features. (`c4509d7`)
- feat(teamhub): refactor team hubs functionality and introduce new components. (`4d3e233`)
- refactor(editor): improve layout and structure of the request editor component. (`0018bd2`)
- feat(settings): refactor plugin settings section and introduce new components. (`c77436f`)
- feat(settings): enhance settings sections with PageHeader and metadata. (`1206756`)
- fix(collection-modal): update label for provider selection to 'Storage location'. (`31cbe9c`)

## 1.8.18 - 2026-06-26

- fix(auth-editor): adjust margin for no authorization message and update sidebar search placeholder. (`8f3b00d`)
- feat(sidebar): enhance environments and collections with search functionality. (`319ac4b`)
- feat(menu): update AI sidebar label and add report issue option. (`21ea80a`)
- feat(drafts): synchronize draft URLs with enabled parameters. (`5298bac`)
- feat(seed): add --seed flag to ensure HarborClient Echo collection exists. (`38db945`)

## 1.8.17 - 2026-06-26

- feat(collections): enhance storage connection management with discovery features. (`41f1a32`)

## 1.8.16 - 2026-06-26

- feat(storage): add default content seeding during storage creation. (`64d0651`)

## 1.8.15 - 2026-06-26

- feat(team-hubs): enhance admin collection management and synchronization. (`3b855d6`)
- chore(package): update package name and author information. (`e777add`)
- feat(team-hubs): enhance collection management and deletion functionality. (`e1b306e`)

## 1.8.14 - 2026-06-26

- feat(team-hubs): enhance Team Hub management with reload functionality and service flags. (`803b9bb`)

## 1.8.13 - 2026-06-25

- feat(plugins): enhance plugin source management and Team Hub integration. (`9ada4b8`)

## 1.8.12 - 2026-06-25

- feat(variables): introduce dynamic variables support and enhance documentation. (`3497443`)
- feat(collections): implement collection runner functionality. (`b15ade9`)
- chore(plugins): add JWT Inspector plugin to catalog.json. (`c0f910f`)
- chore(plugins): bump History plugin version to 1.0.4 in catalog.json. (`9383de2`)

## 1.8.11 - 2026-06-25

- chore(plugins): update plugin versions to 1.0.3 and adjust screenshot path. (`637d83c`)

## 1.8.10 - 2026-06-25

- chore(plugins): update plugin API references from @harborclient/plugin-api to @harborclient/sdk. (`25e66f5`)
- chore(plugins): remove version references from plugin metadata. (`cb7ad8b`)

## 1.8.9 - 2026-06-25

- refactor(plugins): update plugin metadata to use author instead of company. (`eda9ddf`)
- feat(plugins): enhance plugin signature verification and alert handling. (`38ffcd8`)

## 1.8.8 - 2026-06-25

- feat(plugins): implement plugin signature verification and environment reordering. (`b8f1d2f`)
- refactor(plugins): update author references to company in plugin metadata. (`d41f110`)
- feat(plugins): add Dotenv and OpenAPI plugins to the catalog. (`a4f2d6c`)

## 1.8.7 - 2026-06-25

- feat(plugins): enhance plugin filesystem management and add new APIs. (`8312934`)

## 1.8.6 - 2026-06-25

- feat(plugins): add Interval plugin to the catalog. (`ddea307`)
- chore: update @harborclient/plugin-api dependency to version 0.3.4 and enhance request handling. (`0535895`)

## 1.8.5 - 2026-06-25

- chore: update package description and plugin-api dependency version. (`8d5a812`)
- feat(plugins): consume @harborclient/plugin-api and add renderer runtime APIs. (`652b604`)
- docs: update plugin development and settings documentation. (`6660fcc`)
- refactor(plugin-api): remove deprecated TypeScript definitions and enhance plugin context. (`a260bfc`)

## 1.8.4 - 2026-06-25

- chore: update .gitignore and format PluginHttpRequest interface. (`8bc1f4c`)
- feat(plugins): add Request History plugin and enhance plugin request handling. (`ad376c5`)
- feat(plugin-api): add runtime variables to request tab context. (`3c72bf5`)

## 1.8.3 - 2026-06-25

- feat(settings): enhance settings UI with new icons and layout improvements. (`52a033b`)
- feat(plugin-api): enhance request editor and plugin context. (`58a3176`)

## 1.8.2 - 2026-06-25

- refactor(plugins): update section title from "Plugins" to "Marketplace". (`8774550`)
- fix(docs): update plugin marketplace terminology in documentation. (`6819017`)
- feat(plugins): enhance error handling and UI for plugin management. (`d6364af`)

## 1.8.1 - 2026-06-24

- feat(plugins): enhance plugin catalog and UI improvements. (`13b6e26`)
- feat(plugins): introduce plugin marketplace and enhance management features. (`ef48766`)
- fix(docs): update HarborClient Team Hub references in documentation. (`8b58d90`)
- chore: update repository references from headzoo to harborclient. (`d428396`)
- feat(plugin-api): add sync command and enhance plugin context. (`6bb99d2`)

## 1.8.0 - 2026-06-24

- feat(tests): implement mock for electron-store in vitest setup. (`1dfbcf3`)

## 1.6.3 - 2026-06-24

- feat(plugins): enhance plugin management with Git support. (`3149470`)
- feat(plugins): add filesystem access and menu contributions for plugins. (`25ec4c1`)
- feat(plugins): implement plugin management system and enhance plugin support. (`f74301b`)
- feat(docs): add Plugins section to documentation and sidebar. (`596996a`)
- feat(scripting): enhance script execution with SES integration and update dependencies. (`c2586ab`)
- feat(scripting): add support for modern JavaScript syntax with esbuild transpilation. (`1745953`)
- feat(ui): introduce new components for enhanced user interaction. (`8ff0789`)
- feat(screenshots): add screenshot capturing functionality and update documentation images. (`9937de6`)

## 1.6.2 - 2026-06-24

- refactor(ui): update splash screen HTML structure for improved clarity. (`87849c3`)
- refactor(ui): streamline settings sections and enhance reorder functionality. (`2db4cb8`)
- refactor(ui): enhance form components and modal structure. (`75b3b22`)

## 1.6.1 - 2026-06-24

- refactor(ui): improve action menu structure in Collections component. (`c967150`)
- refactor(security): update terminology from "invite" to "share" in security documentation. (`2f24e2a`)
- feat(ipc): add directory picker functionality. (`5459a7e`)

## 1.6.0 - 2026-06-23

- docs(README): remove CI badge for cleaner presentation. (`a5a4ff6`)
- refactor(ui): simplify action menu structure in Collections component. (`e677a48`)
- docs(README): add Electron badge to enhance visibility. (`6a6065d`)
- refactor(ui): streamline Collections and RequestRow components. (`e44d761`)
- docs(README): enhance documentation with badges and detailed descriptions. (`b6029e9`)

## 1.5.20 - 2026-06-23

- chore(docs): update GitHub Actions workflow for documentation deployment. (`8f51593`)
- refactor(git): improve JSON error handling and sync operations. (`e33a817`)
- refactor(git): rename HarborTeamHubClient to TeamHubClient. (`ba31cd1`)

## 1.5.19 - 2026-06-23

- feat(git): add unit tests for GitSyncManager functionality. (`4199783`)

## 1.5.18 - 2026-06-23

- feat(backup): implement backup and restore functionality for local data. (`1174c10`)
- refactor(database): improve code formatting in storageSettings and types. (`b7fa089`)
- feat(docs): add Git-backed collections feature to documentation. (`46238b3`)
- feat(git): add support for custom GitHub OAuth App in connection settings. (`85373b1`)

## 1.5.17 - 2026-06-23

- feat(docs): update asset synchronization and .gitignore for images. (`1b0af82`)
- refactor(database): improve code formatting and consistency across database files. (`0caa80f`)
- feat(environments): add environment duplication feature and enhance documentation. (`7b86429`)
- feat(git): introduce Git-backed collections for version control. (`aa888be`)
- feat(folders): enhance folder management with UUID support and validation. (`c34b798`)
- feat(docs): integrate dynamic download links and enhance documentation structure. (`49a7dc4`)
- feat(docs): update README and documentation with new screenshot and features. (`248d31d`)
- feat(sidebar): enhance sidebar navigation with folder selection and focus functionality. (`b840ed9`)
- feat(docs): add Blog link and Verbose logging section to documentation. (`ab36624`)
- feat(teamHub): enhance synchronization logic for team hub collections. (`8669326`)

## 1.5.16 - 2026-06-23

- feat(teamHub): implement user and token management for Team Hub. (`c786ae4`)

## 1.5.15 - 2026-06-23

- feat(logging): add verbose and very-verbose logging options for HTTP requests and startup diagnostics. (`5e0efd2`)
- refactor(window): improve main window reveal logic during startup. (`fc68691`)
- refactor(teamHub): replace HarborServerClient with HarborTeamHubClient across the application. (`965efaa`)

## 1.5.14 - 2026-06-22

- feat(logging): enhance verbose logging throughout application startup and database creation. (`b179303`)

## 1.5.13 - 2026-06-22

- fix(tsconfig): update ignoreDeprecations option to version 5.0. (`76a810a`)
- feat(database): implement SQLite fallback logic and enhance connection validation. (`911e539`)
- fix(tsconfig): add ignoreDeprecations option for better compatibility. (`8179f5e`)

## 1.5.12 - 2026-06-22

- refactor(database): improve formatting of fallback SQLite connection logic. (`3424e82`)
- fix(database): improve error handling during database initialization and migration. (`7acea77`)

## 1.5.11 - 2026-06-22

- docs: update terminology for saving requests in documentation. (`0fcdef5`)
- refactor: update footer button styles and improve accessibility. (`d923d5d`)

## 1.5.10 - 2026-06-22

- feat: implement Team Hub user management features. (`e2daef8`)

## 1.5.9 - 2026-06-22

- feat: add keyboard shortcuts for toggling sidebars. (`8d9a916`)
- fix: update font sizes for improved readability in chat components. (`86de51d`)

## 1.5.8 - 2026-06-22

- refactor: standardize type formatting in AI tool executor. (`4ee893c`)
- feat: enhance AI assistant request handling with cookie support and updates. (`0f6fe57`)
- feat: enhance AI assistant with Team Hub integration and model management. (`06cb4c9`)
- feat: update Vitest configuration to include setup files. (`8721783`)
- feat: add markdown rendering to message bubbles. (`09694af`)
- feat: add AI assistant feature and update documentation. (`ce70937`)
- feat: transition from service hubs to team hubs and add jmespath dependency. (`c4b2d7b`)
- feat: enhance chat functionality with model updates and error handling. (`66c36f9`)
- feat: implement chat functionality with database integration. (`47f613a`)
- feat: update settings management and add OpenAI dependency. (`e8a4b2d`)
- feat: add AI settings and sidebar functionality. (`4178704`)

## 1.5.7 - 2026-06-22

- refactor: standardize constructor formatting in database classes. (`b3d76a8`)
- feat: implement sync functionality for providers. (`2686d5a`)
- feat: enhance service hubs integration and provider selection. (`ec321fd`)
- feat: add service hubs functionality. (`70c0c38`)
- fix: address issues with environment import/export validation. (`d2883dd`)

## 1.5.6 - 2026-06-22

- refactor: clean up type definitions and improve HTML structure. (`77b8e3a`)
- feat: implement environment import/export functionality. (`eed4be1`)
- refactor: update menu labels and enhance UI text consistency. (`2a29420`)
- fix: enforce HarborClient export version to 1. (`8485287`)

## 1.5.5 - 2026-06-22

- feat: add global HTTP proxy configuration to settings. (`87e4373`)
- feat: enhance keyboard shortcut management and update check functionality. (`89f6450`)

## 1.5.4 - 2026-06-22

- feat: enhance accessibility and theme support in UI components. (`2bda03e`)
- feat: add file handling and export functionality. (`7848c0f`)
- refactor: update RowActionsMenu to support grouped menu items. (`98748c5`)

## 1.5.3 - 2026-06-22

- feat: implement splash screen functionality during application startup. (`96085d3`)
- chore: update issue templates and improve formatting in various components. (`88d73b1`)
- refactor: replace Font Awesome package and update icon usage. (`5f118f9`)
- refactor: reorganize IPC structure and enhance cookie management. (`b83df70`)
- feat: add code editor theme and settings configuration. (`c693048`)
- feat: implement request export and import functionality. (`669f08f`)
- refactor: update export format version to harborclientVersion. (`9f6e0a3`)
- docs(README): add downloads section with latest release link. (`db7bffc`)

## 1.5.2 - 2026-06-21

- fix: standardize quotes in dependabot.yml and improve formatting in RequestRow and Collections components. (`ebf412b`)
- feat(ui): enhance user interface with custom modals and error handling. (`5d0a059`)
- docs(README): add security policy section. (`cf42c86`)
- feat(collections): add validation for duplicate folder names in collection exports. (`cb21d93`)

## 1.5.1 - 2026-06-21

- feat(docs): enhance documentation with detailed function descriptions. (`019c0be`)
- feat(sidebar): implement persistent sidebar expansion state management. (`9b8852f`)
- feat(collections): dispatch closeTabsForCollection on delete. (`cd29938`)
- feat(docs): enhance Postman collection import and migration documentation. (`415f623`)
- fix(docs): format authorization and variable examples in requests documentation. (`970adf2`)

## 1.5.0 - 2026-06-21

- feat(docs): enhance collections and requests documentation with authorization details. (`da382b7`)
- feat(request-editor): enhance URL and params handling in Editor component. (`ec87898`)
- fix(docs): update contact information in Code of Conduct. (`a0cf200`)

## 1.4.4 - 2026-06-21

- feat(docs): add Code of Conduct and enhance testing documentation. (`0788722`)

## 1.4.3 - 2026-06-20

- chore(formatting): improve code formatting and linting checks. (`9881be7`)
- feat(collections): implement collection duplication and reordering functionality. (`97f6098`)
- chore(docs): update README and index.md tagline for clarity. (`011696e`)
- fix(ci): standardize Java version syntax in CI workflow. (`315c3dc`)
- refactor(docs): improve formatting and clarity in TESTING.md. (`b0976c7`)
- fix(docs): update file paths and enhance cookie management documentation. (`a594b80`)
- fix(sidebar): update logo source for improved visibility. (`7d3af56`)
- feat(tests): enhance test coverage and improve error handling. (`3ce12c2`)
- feat(documentation): enhance code documentation guidelines and add new dependencies. (`a571797`)

## 1.4.2 - 2026-06-20

- feat(certificates): implement certificate management for invite security. (`9b3bbbc`)

## 1.4.1 - 2026-06-20

- fix(busyMiddleware): improve type checking for async thunk actions. (`9a8a832`)
- refactor(sidebar): improve formatting and readability of collection options. (`f2f1b79`)
- feat(folders): implement folder management for collections. (`511353e`)
- feat(collections): enhance sharing functionality and documentation. (`bf2bb93`)
- feat(database): implement routing database and collection management. (`ce10e8a`)
- feat(database): enhance database connection management. (`c868deb`)
- feat(cookies): enhance request handling with cookie management. (`063f472`)
- chore(readme): streamline project description and documentation links. (`ad988d9`)
- feat(requestEditor): implement tab management functionality. (`cc091b1`)
- feat(requests): add multipart and urlencoded body support. (`5cbc310`)
- refactor(http): improve function formatting for readability. (`d1d1802`)
- feat(settings): introduce general request settings management. (`e10f75c`)
- refactor(settings): consolidate database section in sidebar. (`8a67c90`)
- refactor(install-app-deps): improve native module build process. (`447a021`)
- feat(database): add MySQL and PostgreSQL support. (`93425a7`)

## 1.4.0 - 2026-06-20

- Enhance HTTP request handling with cancellation support. (`07c7d14`)
- Refactor state management and enhance component integration. (`032b2e1`)
- Refactor ConsolePanel and enhance AppShell functionality. (`a7c0cdf`)
- Refactor Request and ConsolePanel components for improved UI and functionality. (`4adfc0e`)
- Enhance UI components with resizable features and code cleanup. (`c735424`)
- Refactor application structure and enhance request handling UI. (`a7b8bff`)
- Refactor UI component imports and remove unused classes. (`af56f8a`)
- Refactor app dependency installation script for improved compatibility and error handling. (`0b77c39`)

## 1.3.1 - 2026-06-20

- Update electron-builder configuration and package scripts for improved dependency management. (`b38f7d3`)
- Refactor error handling and code formatting for improved readability. (`128884f`)

## 1.3.0 - 2026-06-20

- Update documentation to enhance user guidance and navigation. (`1eef195`)
- Remove outdated documentation files and enhance getting started guide with installation instructions for Windows, macOS, and Linux. Update sidebar navigation to reflect new structure and include environments section. Improve request scripts documentation with variable resolution details.. (`8236251`)
- Add environment management functionality with IPC handlers and database integration. (`d988503`)
- Enhance application menu and UI components for improved user experience. (`935b8c5`)
- Enhance select component styling for improved user experience. (`eb21315`)
- Remove Settings component and associated logic from the UI, streamlining the application by eliminating unused settings functionality.. (`727b360`)
- Add new dependencies for enhanced functionality and update documentation structure. (`fb1ae63`)
- Refactor UI components to replace button-based tab navigation with SegmentedTabs for improved user experience. Update styles and imports accordingly across multiple files, enhancing consistency in tab management.. (`e4bb3b7`)
- Enhance database management by integrating Firestore support alongside SQLite. Update IStorage interface and SqliteStorage class for asynchronous operations. Refactor IPC handlers and application initialization to accommodate new database settings. Modify package.json for dependency updates and improve test coverage for database interactions.. (`c7bab81`)
- Update README.md to change logo image path from external URL to local path.. (`bd90979`)
- Refactor database interaction by introducing a new SqliteStorage class, updating IPC handlers for improved data management, and enhancing application initialization and theme management to align with the new structure.. (`b82e37e`)
- Refactor database management by removing the old SQLite implementation and replacing it with a new SqliteStorage class. Update IPC handlers to utilize the new database interface for improved data handling and organization. Enhance application initialization and theme management to align with the new database structure.. (`ffe777c`)

## 1.2.1 - 2026-06-19

- Add CodeMirror autocomplete support for JavaScript scripts in the editor. Update package.json and pnpm-lock.yaml to include @codemirror/autocomplete dependency. Enhance CodeEditor component to utilize autocomplete for pre-request and post-request scripts, improving user experience in script editing.. (`628976f`)
- Enhance request and collection management by adding pre-request and post-request script fields. Update database schema and related functions to support script storage. Refactor UI components to allow script editing in collection settings and improve script execution handling in the request workflow.. (`11a0a3d`)
- Add fullscreen escape handler and enhance collection settings management. Implement unsaved changes prompt for loading requests, improve state management in App component, and refine CollectionSettings for better dirty state tracking.. (`505154e`)

## 1.2.0 - 2026-06-19

- Refactor type imports and improve formatting in multiple files for better readability. Update IPC, App, and types to enhance code organization and maintainability.. (`279a6b4`)
- Refactor Font Awesome registry authentication in CI workflows to use a script for configuration. This simplifies the setup process and maintains the requirement for FONTAWESOME_PACKAGE_TOKEN, enhancing security and usability.. (`d40962c`)
- Update CI and release workflows to require FONTAWESOME_PACKAGE_TOKEN and inherit secrets. This enhances security and ensures proper authentication for Font Awesome package management.. (`0182eaf`)
- Add Font Awesome registry authentication to CI workflows. Ensure FONTAWESOME_PACKAGE_TOKEN is configured and set for pnpm, enhancing package management for Font Awesome dependencies.. (`b664034`)
- Add FontAwesome support and implement close confirmation prompts in the application. Update dependencies in package.json and pnpm-lock.yaml, enhance main process with close handlers, and improve UI components for unsaved changes notifications.. (`4e521e8`)
- Refactor response formatting utilities: move formatBytes and formatBody functions to responseFormatUtils. Update ConsolePanel and ResponseViewer to use new imports, enhancing code organization and readability.. (`fdd4d96`)
- Add console panel and footer to App component; implement console logging functionality in store. Refactor ResponseViewer to remove console tab and related code. Enhance TabBar styling for better UI consistency.. (`f9d9546`)
- Add 'Save' action to menu and implement keyboard shortcut (CmdOrCtrl+S) for saving requests. Refactor App and RequestEditor components to handle save action and improve variable management in CodeEditor with tooltip support for editing variables.. (`54859bc`)
- Implement variable editing functionality in RequestEditor and KeyValueEditor components. Add onEditVariable prop to enable editing of variables directly from the UI. Enhance VariableInput with tooltip support for editing, improving user experience in managing collection-scoped variables.. (`b681b7e`)
- Enhance collection management by adding support for headers in database schema and API. Update related functions and UI components to handle headers, ensuring they are included in collection creation, updates, and exports. Introduce tests for header substitution in requests.. (`f642c60`)
- Add logo-white.png to documentation assets and update watch configuration for improved branding consistency. (`f495c33`)
- Update logo images for improved visual consistency; replace logo in README and documentation, and add new logo files for enhanced branding.. (`b6cce6e`)

## 1.1.5 - 2026-06-19

- Refactor App and RequestEditor components to improve variable handling and display. Introduce activeCollection and activeVariables in App, and add collectionName prop to RequestEditor for better context in request naming. Enhance input handling for request names with breadcrumb support.. (`c3ac962`)
- Update icons and images across the project; replace multiple PNG and PSD files for improved visual consistency. Enhance variable handling in the codebase by adding tokenization and resolution functions, and update the RequestEditor component to utilize collection-scoped variables.. (`8a903f9`)
- Update documentation to reflect consistent naming of 'HarborClient' in the hero section, including adjustments to the name and alt text for improved clarity.. (`058415d`)
- Update logo images to improve visual consistency across the project; replace existing PNG and PSD files with new versions.. (`012d39c`)
- Refactor project naming to use 'HarborClient' consistently across configuration, documentation, and codebase. Update database filename and storage keys to reflect new naming convention, ensuring backward compatibility with legacy data. Enhance documentation structure and styling for improved clarity and user experience.. (`c6bdfa9`)
- Update documentation assets and favicon configuration; add new icons for better resolution and remove obsolete favicon file.. (`93dbe2f`)

## 1.1.4 - 2026-06-19

- Update GitHub Actions workflow to replace 'windows-latest' with 'windows-2022' for better compatibility with pnpm and better-sqlite3 compilation.. (`2a616f1`)

## 1.1.3 - 2026-06-19

- Update documentation build process by adding new scripts and modifying existing ones; enhance ESLint configuration to ignore additional directories and update Prettier ignore list. Also, update watch script to include new asset synchronization and improve logo image handling.. (`af5502e`)
- Remove version specification for pnpm in CI and release workflows to streamline setup process.. (`c019fb3`)
- Update Electron build configuration to disable executable signing for Windows and enhance CI workflow to include Windows build support. Add download section in documentation for macOS, Windows, and Linux releases.. (`5fb58f2`)
- Update logo images in README.md and documentation; enhance description clarity in index.md. (`9c9cc17`)
- Update homepage links in package.json and README.md to reflect new domain; adjust siteBase in VitePress config for correct routing.. (`ad3e8ab`)
- Update package.json and pnpm-lock.yaml to add new documentation scripts and dependencies, including concurrently and vitepress. Revise README.md for improved documentation structure and clarity, highlighting features and development instructions.. (`08620f7`)

## 1.1.2 - 2026-06-19

- Enhance Electron app configuration by adding support for theme persistence, improving build settings for macOS and Linux, and updating the CI workflow for better release management. Introduce new database functions for settings management and update the UI to include settings and about dialogs, enhancing user experience and application functionality.. (`d4c1036`)
- Update CI workflow to trigger on workflow_dispatch instead of push and pull_request events, streamlining manual execution of CI jobs.. (`d8c75f9`)

## 1.1.1 - 2026-06-19

- Update Electron build configuration and package.json for improved icon management and desktop name setting. (`2b71cc7`)
- Enhance variable management by introducing a normalization function for legacy variable records, updating the handling of variables in collection exports, and improving the UI for variable settings. Add support for default values and sharing options in the Variable interface, ensuring better data integrity and user experience.. (`96d7430`)

## 1.1.0 - 2026-06-19

- Update GitHub Actions workflows to include a workflow call for CI in release management, ensuring that the CI job is a prerequisite for the release job.. (`4aab107`)
- Update configuration files and improve code consistency by enforcing semicolons and adjusting formatting. Enhance documentation clarity in AGENTS.md and README.md, and refine request handling in the HTTP module for better error management and response processing.. (`094efd7`)
- Add UI components for managing collections, requests, and responses, including CollectionSettings, RequestEditor, ResponseViewer, Sidebar, TabBar, and TitleBar. Enhance user experience with improved layouts and functionality for editing and viewing request details.. (`ee58111`)
- Enhance testing capabilities by adding Vitest as a dependency and updating package.json scripts for running tests. Export utility functions for URL and header building in the HTTP module, improving modularity and reusability.. (`99d8e80`)

