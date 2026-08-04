import type { ShortcutBinding, ShortcutId } from '@harborclient/core/shortcuts';
import type { ShortcutLevel } from '@harborclient/shortcut-runner-game';
import { electronAcceleratorToGameShortcut } from './electronAcceleratorToGameShortcut';

/**
 * Everyday shortcuts introduced in Level 1.
 */
const LEVEL_1_IDS: readonly ShortcutId[] = [
  'send-request',
  'save',
  'new-request',
  'focus-request-url',
  'focus-sidebar-search',
  'toggle-sidebar',
  'close-request-tab',
  'previous-request-tab',
  'next-request-tab',
  'action-menu',
  'settings'
];

/**
 * Additional everyday workflow shortcuts added in Level 2 (cumulative with Level 1).
 */
const LEVEL_2_EXTRA_IDS: readonly ShortcutId[] = [
  'new-collection',
  'new-environment',
  'new-workflow',
  'toggle-console',
  'toggle-variables',
  'toggle-terminal',
  'toggle-collections-section',
  'toggle-environments-section',
  'import',
  'sync',
  'browser-reload',
  'focus-browser-address',
  'toggle-ai-sidebar',
  'toggle-git-sidebar',
  'focus-response-editor',
  'documentation'
];

/**
 * Rarer power-user shortcuts added in Level 3 (cumulative with Levels 1–2).
 */
const LEVEL_3_EXTRA_IDS: readonly ShortcutId[] = [
  'focus-main-nav',
  'focus-collections-sidebar',
  'focus-environments-sidebar',
  'focus-workflows-sidebar',
  'focus-live-servers-sidebar',
  'set-method-get',
  'set-method-post',
  'set-method-put',
  'set-method-patch',
  'set-method-delete',
  'set-method-head',
  'set-method-options',
  'plugins',
  'themes',
  'snippets',
  'team-hubs',
  'hide-sidebars',
  'show-sidebars',
  'switch-sidebars',
  'toggle-rail',
  'git-commit',
  'git-push',
  'git-pull',
  'git-fetch',
  'git-create-branch',
  'toggle-mcp',
  'toggle-filters',
  'toggle-sorting',
  'toggle-highlights',
  'new-live-server',
  'new-browser',
  'create-workspace'
];

/**
 * Advanced shortcuts added in Level 4 (cumulative with Levels 1–3).
 *
 * Covers edit chords, browser navigation, zoom, focus helpers, remaining
 * toggles, and extra git / help bindings that are not in Levels 1–3.
 */
const LEVEL_4_EXTRA_IDS: readonly ShortcutId[] = [
  'undo',
  'redo',
  'cut',
  'copy',
  'paste',
  'select-all',
  'browser-go-back',
  'browser-go-forward',
  'zoom-in',
  'zoom-out',
  'reset-zoom',
  'toggle-fullscreen',
  'focus-first-collection',
  'focus-first-environment',
  'focus-first-request-tab',
  'next-sidebar-list-item',
  'previous-sidebar-list-item',
  'toggle-request-editor',
  'toggle-response-editor',
  'toggle-run-results-section',
  'toggle-storage-locations',
  'toggle-color-markers',
  'toggle-indicators',
  'toggle-shortcuts-sidebar',
  'new-browser-tab',
  'git-merge'
];

/**
 * Builds a shortcodes map for the given shortcut ids from resolved bindings.
 *
 * Skips empty accelerators. When two ids resolve to the same game shortcode,
 * the first label wins so earlier (more common) commands keep the chord.
 *
 * @param ids - Shortcut ids to include, in preferred order.
 * @param bindingsById - Resolved bindings keyed by shortcut id.
 * @param platform - Host platform for CmdOrCtrl resolution.
 * @returns Game shortcode → action label map.
 */
function buildShortcodes(
  ids: readonly ShortcutId[],
  bindingsById: Map<ShortcutId, ShortcutBinding>,
  platform: NodeJS.Platform
): Record<string, string> {
  const shortcodes: Record<string, string> = {};

  for (const id of ids) {
    const binding = bindingsById.get(id);
    if (binding == null || binding.accelerator.trim().length === 0) {
      continue;
    }

    const shortcode = electronAcceleratorToGameShortcut(binding.accelerator, platform);
    if (shortcode == null || shortcode in shortcodes) {
      continue;
    }

    shortcodes[shortcode] = binding.label;
  }

  return shortcodes;
}

/**
 * Builds the five cumulative Shortcut Tutor levels from the user's bindings.
 *
 * Levels 1–4 grow from everyday to advanced chords; Level 5 includes every
 * binding that has a non-empty accelerator.
 *
 * @param bindings - Resolved shortcut bindings from settings.
 * @param platform - Host platform for CmdOrCtrl → ctrl/meta mapping.
 * @returns Levels ready to pass to `ShortcutRunnerGame`.
 */
export function buildShortcutTutorLevels(
  bindings: ShortcutBinding[],
  platform: NodeJS.Platform
): ShortcutLevel[] {
  const bindingsById = new Map(bindings.map((binding) => [binding.id, binding]));

  const level1Ids = LEVEL_1_IDS;
  const level2Ids = [...LEVEL_1_IDS, ...LEVEL_2_EXTRA_IDS];
  const level3Ids = [...level2Ids, ...LEVEL_3_EXTRA_IDS];
  const level4Ids = [...level3Ids, ...LEVEL_4_EXTRA_IDS];
  const level5Ids = bindings
    .filter((binding) => binding.accelerator.trim().length > 0)
    .map((binding) => binding.id);

  return [
    {
      name: 'Level 1 · Essentials',
      speed: 0.8,
      shortcodes: buildShortcodes(level1Ids, bindingsById, platform)
    },
    {
      name: 'Level 2 · Everyday',
      speed: 1,
      shortcodes: buildShortcodes(level2Ids, bindingsById, platform)
    },
    {
      name: 'Level 3 · Power user',
      speed: 1.25,
      shortcodes: buildShortcodes(level3Ids, bindingsById, platform)
    },
    {
      name: 'Level 4 · Advanced',
      speed: 1.4,
      shortcodes: buildShortcodes(level4Ids, bindingsById, platform)
    },
    {
      name: 'Level 5 · Everything',
      speed: 1.6,
      shortcodes: buildShortcodes(level5Ids, bindingsById, platform)
    }
  ];
}
