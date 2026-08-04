import { ShortcutRunnerGame, type ShortcutLevel } from './lib';

const levels: ShortcutLevel[] = [
  {
    name: 'Level 1 · Essentials',
    speed: 0.8,
    shortcodes: {
      'ctrl+enter': 'Send Request',
      'ctrl+l': 'Focus URL',
      'ctrl+s': 'Save Request',
    },
  },
  {
    name: 'Level 2 · Workflow',
    speed: 1,
    shortcodes: {
      'ctrl+shift+d': 'Duplicate Request',
      'ctrl+shift+s': 'Save Request As',
      'ctrl+alt+r': 'Rename Request',
    },
  },
  {
    name: 'Level 3 · Advanced',
    speed: 1.35,
    shortcodes: {
      F4: 'Toggle Environment Panel',
      'ctrl+shift+p': 'Open Command Palette',
      'ctrl+alt+enter': 'Send Without Hooks',
    },
  },
];

export default function App() {
  return (
    <main className="demo-shell">
      <section className="demo-intro">
        <span>Component demo</span>
        <h1>HarborClient Shortcut Sprint</h1>
        <p>
          The game is intentionally constrained to a 600×500 panel so it can live inside a
          settings, onboarding, or training screen.
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
