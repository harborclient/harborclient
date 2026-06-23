---
layout: home
sidebar: false
outline: false

hero:
  tagline: The free API client that keeps your work private - no accounts, no subscriptions, no lock-in.
  actions:
    - theme: brand
      text: Download
      link: /getting-started#download
    - theme: alt
      text: Get Started
      link: /getting-started
  screenshot:
    src: /images/screenshots/hc-1.png
    alt: HarborClient workspace with collections, request editor, and response panel

features:
  - title: Free and decentralized
    details: No accounts, subscriptions, or central servers. HarborClient runs on your machine and stores data where you choose—locally or in a database you control.
  - title: Database backends
    details: Pluggable storage for collections, requests, and environments. Use SQLite locally or connect to remote engines such as Firestore, MySQL, or PostgreSQL.
  - title: Team collaboration
    details: Point multiple HarborClient instances at the same remote database to share collections across your team.
  - title: Team hubs
    details: Self-host HarborClient Team Hub and connect via team hubs so your team shares collections through a centralized workflow service—token-based access without shared database credentials.
  - title: Request builder
    details: Method selector, URL bar, query params, headers, and body (none, JSON, or plain text).
  - title: Collections
    details: Organize saved requests into named collections with create, rename, and delete.
  - title: Environments
    details: Define global variable groups and switch between them from the TabBar. Environment variables override collection variables with the same key.
  - title: Scripts and tests
    details: Pre- and post-request JavaScript at the collection or request level. Modify requests, and test responses.
  - title: Folders and drag-and-drop
    details: Organize saved requests into folders, reorder them, and move requests between folders with drag-and-drop.
  - title: Variable substitution
    details: Use {{variable}} placeholders in URLs, headers, params, body, and scripts. Hover any token to preview its resolved value.
  - title: Cross-platform desktop app
    details: A native Electron app for macOS, Windows, and Linux—no browser or web service required.
  - title: Encrypted invites
    details: Share live remote collections with signed, encrypted invite tokens backed by RSA key pairs you manage under Certificates.
  - title: Tabbed workspace
    details: Open multiple requests side by side. Each tab keeps its own draft, response, and unsaved-changes indicator.
  - title: AI assistant
    details: Chat with AI using your own API keys stored locally. The assistant can inspect collections, send requests, and read responses.

---
