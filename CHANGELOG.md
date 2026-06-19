# Changelog

## Unreleased

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

