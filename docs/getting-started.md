# Getting started

HarborClient is a desktop app for building, sending, and inspecting HTTP requests. You do not need Node.js, pnpm, or any other development tools — just download the installer for your operating system, install it, and launch the app. Your collections and requests are saved locally on your machine.

## Download

<DownloadLinks />

## Install on Windows

1. Download `harborclient-{version}.exe`.
2. Run the installer and follow the prompts. You can accept the default install location or choose another folder.
3. Launch **HarborClient** from the Start menu.

If Windows SmartScreen shows a warning because the app is from an unknown publisher, choose **More info**, then **Run anyway** to continue.

## Install on macOS

Choose the correct disk image for your Mac:

- **Apple Silicon** (M1, M2, M3, and later) — `harborclient-{version}-arm64.dmg`
- **Intel** — `harborclient-{version}-x64.dmg`

To install:

1. Open the downloaded `.dmg` file.
2. Drag **HarborClient** into the **Applications** folder.
3. Eject the disk image when finished.

Launch HarborClient from Applications. If macOS blocks the app on first open, right-click the app, choose **Open**, and confirm — you only need to do this once.

## Install on Linux

### `.deb` package (recommended for Debian/Ubuntu)

**Using the GUI:** Open the downloaded `.deb` file with Software Install (or your distribution’s package installer) and follow the prompts.

**Using the terminal:**

```bash
sudo dpkg -i harborclient-{version}.deb
```

If the installer reports missing dependencies, run:

```bash
sudo apt-get install -f
```

Launch **HarborClient** from your application menu.

### `.AppImage` (portable, no system install)

1. Download `harborclient-{version}.AppImage`.
2. Make it executable:

```bash
chmod +x harborclient-{version}.AppImage
```

3. Run it directly:

```bash
./harborclient-{version}.AppImage
```

## Verbose logging

HarborClient supports optional main-process logging for troubleshooting.

| Flag | Environment variable | What is logged |
| ---- | -------------------- | -------------- |
| `-v` / `--verbose` | `HARBOR_VERBOSE=1` | Startup steps and diagnostic output |
| `-vv` / `--very-verbose` | `HARBOR_VERBOSE=2` | Everything in `-v`, plus each outbound HTTP request's method, URL, request headers, and body |

Response headers and response bodies are never logged, even with `-vv`.

**Packaged build:**

```bash
./HarborClient -v
./HarborClient -vv
```

**Development:**

```bash
pnpm dev -- -v
pnpm dev -- -vv
```

## What's next

- [Making requests](/requests) — build, send, and inspect HTTP requests.
- [Collections](/collections) — organize saved requests and share variables, headers, and scripts.
- [Features](/features) — overview of the request builder, collections, tabs, and response viewer.
- [Environments](/environments) — define variable groups and switch between them while testing APIs.
- [Request scripts](/request-scripts) — run JavaScript before or after requests to set variables and write tests.
- [Settings](/settings) — configure appearance, storage provider, and backend connection details.
- [Team hubs](/team-hubs) — connect to HarborClient Team Hub for shared collections with API tokens.