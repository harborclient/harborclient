# Changelog

## Unreleased

- refactor: enhance script execution logging and clean up console components. (`ab0ecf3d`)
- refactor: update code editor theme to Nord. (`5fda54b0`)
- refactor: update ESLint configurations and clean up code. (`fa5f53c9`)

## 0.5.1 - 2026-08-03

- feat(settings): enhance deep link handling for settings navigation. (`3d03652e`)
- feat(settings): introduce appearance settings section and related fields. (`3a5b426e`)
- feat(gui): add response editor split functionality. (`bd1aaaba`)

## 0.5.0 - 2026-08-03

- feat(sse): enhance import functionality for Server-Sent Events (SSE). (`e26fa155`)
- feat(sse): implement SSE session management and protocol handling. (`d9e051bc`)
- feat(mcp-server): enhance MCP server settings and functionality. (`cf36a22f`)

## 0.4.4 - 2026-08-03

- feat(chat-pointers): implement custom match and parse functionality for plugin chat pointers. (`ef062d67`)

## 0.4.3 - 2026-08-03

- feat(menu): add new browser tab option and enhance related functionality. (`18184d9f`)

## 0.4.2 - 2026-08-02

- feat(runtime): integrate runtime management and script injection capabilities. (`074fa871`)
- feat(menu): restructure File menu and add new workflow option. (`01cc3506`)
- feat(mcp): enhance MCP server settings and logging capabilities. (`cfa194f2`)

## 0.4.1 - 2026-08-02

- feat(theme): add page header color variables and update related styles. (`577ab426`)
- feat(theme): introduce header color variable and update related styles. (`6b6637e3`)

## 0.4.0 - 2026-08-01

- feat(live-page): introduce live page functionality and refactor related components. (`16f1f304`)

## 0.3.4 - 2026-08-01

- feat(websites): implement Add Live Page modal and import functionality. (`1bdbf8a4`)
- feat(live-server): implement Add Live Server modal and import functionality. (`a36916fb`)
- feat(live-server): enhance live server and live page management. (`fba086b7`)
- feat(live-server): add openPathOnStartup configuration for live server. (`039b74dc`)

## 0.3.3 - 2026-08-01

- refactor(teamHub): introduce soft-connection handling for team hubs. (`5fc744ec`)
- feat(live-server): integrate live-server package and enhance CLI functionality. (`890d9cd7`)

## 0.3.2 - 2026-07-31

- feat(live-server): add reverse proxy support and enhance server configuration. (`dc483636`)

## 0.3.1 - 2026-07-31

- feat(live-server): enhance SSL and routing features. (`21c7007b`)
- feat(dependencies): add Orama and OpenAI packages. (`1555db1b`)

## 0.3.0 - 2026-07-31

- feat(live-server): enhance live server functionality and UI integration. (`241f4525`)
- feat(live-server): introduce live server management features. (`8bfa8fe7`)

## 0.2.10 - 2026-07-30

- Implement "Copy to chat" feature in browser context menu. (`617b273f`)
- Enhance browser functionality and introduce webpage scripting support. (`e4be8c89`)

## 0.2.9 - 2026-07-30

- Add browser-related features and tests. (`2f8eb307`)

## 0.2.8 - 2026-07-29

- Implement workflow run history management and UI enhancements. (`c87feda3`)
- Enhance development and testing workflow in AGENTS.md and CONTRIBUTING.md. (`181dc04a`)

## 0.2.7 - 2026-07-29

- Enhance Response Editor and Summary with Close Functionality. (`e14d7c7d`)

## 0.2.6 - 2026-07-28

- Enhance CLI and GUI workflow functionalities. (`a8b8f495`)
- Enhance workflow results management and response handling. (`6a092e2e`)
- Add delayMs property to workflow management for enhanced playback control. (`eff9c395`)
- Enhance workflow execution and metadata handling. (`1390072c`)
- Enhance workflow action management with UUID integration. (`9647b650`)
- Enhance workflow management and plugin integration. (`e55d2821`)
- Implement workflow update functionality and enhance playback controls. (`443b20ec`)
- Enhance environment variable management and UI readiness. (`abab021c`)
- Update variable schema and enhance environment management. (`34cc08f0`)
- Implement workflow management features. (`a4525074`)

## 0.2.5 - 2026-07-28

- Implement hc.ask API for one-shot AI completions. (`aed2809f`)
- Enhance plugin library and sidebar selection handling. (`5a919ac6`)
- Refactor settings draft management and enhance default handling. (`5650b3e6`)
- Enhance response body handling and UI interactions. (`af009245`)
- Refactor shortcuts handling and update UI components. (`a85cf446`)
- Enhance response handling and UI features. (`b076b194`)
- Add response viewer functionality and enhance UI elements. (`5da28a40`)

## 0.2.4 - 2026-07-27

- Add @harborclient/team-hub and @harborclient/team-hub-api packages with initial setup. (`83f69f5d`)
- Update @harborclient/team-hub-api dependency to version 0.4.1 and enhance documentation for import handlers. (`516c9dae`)
- Implement Nested Folder Support and Public Collection Features. (`27db1399`)
- Enhance Folder Management with Parent-Child Relationships. (`6c0cc7e9`)
- Add OpenCollection Import Functionality. (`ac4dc71a`)
- Add Appearance Options for Storage Locations, Color Markers, Highlights, and Indicators. (`ee9e54d5`)
- Rename Tab Groups to Workspaces (`TabGroup` → `Workspace`, export kind `workspace`). Breaking type rename; requires a major release.
- Refactor sidebar color handling to markers. (`6f53f3d7`)
- Add Filters and Sorting Options to Sidebar Menu. (`d17dea07`)
- Enhance menu functionality and visibility options. (`89cf8584`)

## 0.2.3 - 2026-07-26

- Add dismissedRequestEditorNotices to general settings. (`22551faa`)

## 0.2.1 - 2026-07-26

- Enhance release workflows with concurrency and rebase logic. (`e26c79de`)

## 0.2.0 - 2026-07-26

- Enhance testing and plugin management functionality. (`48799cc9`)
- Refactor User-Agent handling and enhance settings reconciliation. (`eb753bae`)

## 0.1.6 - 2026-07-26

- Enhance AI chat settings and UI components. (`ad9d10c9`)

## 0.1.5 - 2026-07-26

- Refactor resource paths and update documentation indexing. (`89d0d78f`)

## 0.1.4 - 2026-07-26

- Add new images and plugin metadata. (`37969b6e`)

## 0.1.3 - 2026-07-25

- Update build process and documentation for @harborclient. (`694dc348`)
- chore(http): integrate @harborclient/http package into monorepo. (`2fdd858c`)
- chore(sdk): integrate SDK into monorepo and update related configurations. (`f9143029`)

## 0.1.2 - 2026-07-25

- chore(deps): update @harborclient/sdk to version 1.2.5 and enhance script error handling. (`dd2ab257`)

## 0.1.1 - 2026-07-25

- fix: update pre-commit hook to block any local SDK link overrides. (`a4ab5392`)
- feat(gui): update dependencies and enhance theme management. (`babfa827`)
- feat(gui): enhance user agent handling across storage and request modules. (`cf17b788`)
- feat(core): update .gitignore, add thumbnails, and refactor auth module. (`58bbb3b6`)
- feat(docs): update documentation search index and improve logging format. (`6edd9fc`)
- feat(gui): refactor path resolution and enhance sidebar actions. (`56b3645`)

