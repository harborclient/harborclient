# HarborClient Shortcut Runner Game

A compact React + TypeScript shortcut-training game designed for HarborClient. The user selects a level, reads an action name, and presses the configured keyboard shortcut before the cactus reaches the dinosaur.

The project includes:

- A reusable `ShortcutRunnerGame` React component
- A standalone Vite demo
- A Vite library build with generated TypeScript declarations
- Per-level scrolling speed
- Progressive hints that reveal one shortcut key per H press
- A key-count indicator for every command
- Shortcut normalization for Ctrl, Alt, Shift, Meta/Command, function keys, arrows, and common aliases
- Procedurally generated background music and sound effects using the Web Audio API
- A mute control, score, streaks, accuracy, and level-completion callback
- No game engine, image files, audio files, or runtime dependencies beyond React

## Run the demo

```bash
pnpm install
pnpm dev
```

## Build the package

```bash
pnpm build
```

The build produces:

```text
dist/
├── index.js
├── index.d.ts
├── index.d.ts.map
└── style.css
```

## Add it to the HarborClient monorepo

Copy this directory into your workspace, for example:

```text
packages/
└── shortcut-runner-game/
```

Add it to the consuming package:

```json
{
  "dependencies": {
    "@harborclient/shortcut-runner-game": "workspace:*"
  }
}
```

Then import the component and stylesheet:

```tsx
import { ShortcutRunnerGame, type ShortcutLevel } from '@harborclient/shortcut-runner-game';
import '@harborclient/shortcut-runner-game/style.css';

const levels: ShortcutLevel[] = [
  {
    name: 'Level 1',
    speed: 0.8,
    shortcodes: {
      'ctrl+enter': 'Send Request',
      'ctrl+l': 'Focus URL'
    }
  },
  {
    name: 'Level 2',
    speed: 1.25,
    shortcodes: {
      'F4': 'Do Something Harder',
      'ctrl+alt+t': 'Start Server'
    }
  }
];

export function ShortcutTraining() {
  return <ShortcutRunnerGame levels={levels} />;
}
```

The `shortcodes` value is a `Record<string, string>` where each key is a configured shortcut and each value is the action name shown to the user.

## Level speed

`speed` is a multiplier applied to the base `roundDurationMs`:

```ts
{
  name: 'Advanced',
  speed: 1.5,
  shortcodes: { /* ... */ },
}
```

- `1` is normal speed.
- `1.5` is 50% faster.
- `0.75` is 25% slower.
- Omitted `speed` defaults to `1`.
- Values are clamped between `0.25` and `5`.

## Game controls

- `H`: reveal the next key in the shortcut hint
- `P`: pause or resume the game

Both controls are displayed persistently inside the game area during play.

## Progressive hints

During a round, pressing plain H reveals one key at a time. For `ctrl+alt+t`, the hint progresses like this:

```text
Ctrl+
Ctrl+Alt+
Ctrl+Alt+T
```

The number of required keys is always shown at the bottom of the game. Press P to pause or resume the game. Modified H/P shortcuts such as `ctrl+h` and `ctrl+p` still work normally. If the configured answer is plain `h` or plain `p`, that key is treated as the answer for that round.

## Component props

```ts
interface ShortcutRunnerGameProps {
  levels: ShortcutLevel[];
  width?: number; // default: 600
  height?: number; // default: 500
  roundsPerLevel?: number; // default: 6
  roundDurationMs?: number; // default: 5000 at speed 1
  initialMuted?: boolean; // default: false
  className?: string;
  onLevelComplete?: (level: ShortcutLevel, stats: ShortcutGameStats) => void;
}

interface ShortcutLevel {
  name: string;
  shortcodes: Record<string, string>;
  speed?: number;
}
```

The component is 600×500 pixels by default and uses `max-width: 100%`, so it can shrink horizontally in a narrower container.

## Shortcut syntax

Examples:

```text
ctrl+enter
ctrl+shift+s
alt+left
meta+k
cmd+k
F4
escape
```

Aliases are normalized internally:

- `control` → `ctrl`
- `cmd`, `command`, `super`, `win` → `meta`
- `option` → `alt`
- `return` → `enter`
- `esc` → `escape`
- `arrowleft` → `left`

On macOS, shortcut hints display familiar symbols such as `⌘`, `⌥`, `⌃`, and `⇧`.

## Electron integration notes

The game only captures keyboard events while its root element is focused. Starting a level focuses the game automatically. Clicking inside the panel restores focus.

Some shortcuts may already be consumed by Electron menus, the browser shell, or the operating system. For shortcuts such as `F4`, `Ctrl+W`, or `Cmd+Q`, make sure HarborClient's menu accelerators and window-level handlers allow the renderer to receive the event while the training screen is active.

For the best long-term integration, generate the `levels` prop from HarborClient's real command/shortcut registry instead of maintaining a separate copy. This keeps the game synchronized with user-customized shortcuts.

## Audio

Music and effects are synthesized at runtime with the Web Audio API. No copyrighted or external audio assets are bundled. Browser autoplay restrictions are satisfied because audio starts only after the user clicks the start button.

## Styling

All selectors are prefixed with `hcsr-` to reduce collisions with HarborClient styles. Colors are defined as CSS variables near the top of `ShortcutRunnerGame.css`, making rebranding straightforward.
