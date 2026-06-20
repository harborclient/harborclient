# Getting started

HarborClient is a desktop app for building, sending, and inspecting HTTP requests. You do not need Node.js, pnpm, or any other development tools — just download the installer for your operating system, install it, and launch the app. Your collections and requests are saved locally on your machine.

## Download

Download the latest release from [GitHub Releases](https://github.com/headzoo/harborclient/releases/latest).

1. Open the latest release page.
2. Scroll to **Assets**.
3. Download the file that matches your operating system (see the table below).

| Platform | Download |
| -------- | -------- |
| Windows | `harborclient-{version}.exe` |
| macOS (Apple Silicon) | `harborclient-{version}-arm64.dmg` |
| macOS (Intel) | `harborclient-{version}-x64.dmg` |
| Linux (Debian/Ubuntu) | `harborclient-{version}.deb` |
| Linux (portable) | `harborclient-{version}.AppImage` |

Replace `{version}` with the release version shown on the page (for example, `1.2.0`).

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

## What's next

- [Features](/features) — overview of the request builder, collections, tabs, and response viewer.
- [Environments](/environments) — define variable groups and switch between them while testing APIs.
- [Request scripts](/request-scripts) — run JavaScript before or after requests to set variables and write tests.