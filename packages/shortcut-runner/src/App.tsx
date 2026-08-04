import { ShortcutRunnerGame, type ShortcutLevel } from './lib';

const level1Shortcodes = {
  'ctrl+enter': 'Send Request',
  'ctrl+l': 'Focus URL',
  'ctrl+s': 'Save Request'
};

const level2Extra = {
  'ctrl+shift+d': 'Duplicate Request',
  'ctrl+shift+s': 'Save Request As',
  'ctrl+alt+r': 'Rename Request'
};

const level3Extra = {
  'F4': 'Toggle Environment Panel',
  'ctrl+shift+p': 'Open Command Palette',
  'ctrl+alt+enter': 'Send Without Hooks'
};

const level4Extra = {
  'ctrl+z': 'Undo',
  'ctrl+y': 'Redo',
  'alt+left': 'Browser Back',
  'ctrl+=': 'Zoom In'
};

const levels: ShortcutLevel[] = [
  {
    name: 'Level 1 · Essentials',
    speed: 0.8,
    shortcodes: level1Shortcodes
  },
  {
    name: 'Level 2 · Everyday',
    speed: 1,
    shortcodes: {
      ...level1Shortcodes,
      ...level2Extra
    }
  },
  {
    name: 'Level 3 · Power user',
    speed: 1.25,
    shortcodes: {
      ...level1Shortcodes,
      ...level2Extra,
      ...level3Extra
    }
  },
  {
    name: 'Level 4 · Advanced',
    speed: 1.4,
    shortcodes: {
      ...level1Shortcodes,
      ...level2Extra,
      ...level3Extra,
      ...level4Extra
    }
  },
  {
    name: 'Level 5 · Everything',
    speed: 1.6,
    shortcodes: {
      ...level1Shortcodes,
      ...level2Extra,
      ...level3Extra,
      ...level4Extra,
      'ctrl+/': 'Toggle Shortcuts Sidebar',
      'ctrl+shift+g': 'Open Git Sidebar'
    }
  }
];

/**
 * Standalone Vite demo shell for the Shortcut Runner game component.
 *
 * @returns Demo page with five sample levels.
 */
export default function App() {
  return (
    <main className="demo-shell">
      <section className="demo-intro">
        <span>Component demo</span>
        <h1>HarborClient Shortcut Sprint</h1>
        <p>
          The game is intentionally constrained to a 600×500 panel so it can live inside a settings,
          onboarding, or training screen.
        </p>
      </section>

      <ShortcutRunnerGame
        levels={levels}
        roundsPerLevel={8}
        onLevelComplete={(level, stats) => {
          console.info('Shortcut level completed', { level: level.name, stats });
        }}
      />
    </main>
  );
}
