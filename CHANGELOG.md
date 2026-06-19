# Changelog

## Unreleased

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

