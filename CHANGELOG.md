# Changelog

## Unreleased

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

