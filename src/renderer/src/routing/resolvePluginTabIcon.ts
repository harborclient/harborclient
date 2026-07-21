import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faBolt,
  faCode,
  faDatabase,
  faFlask,
  faGlobe,
  faPuzzlePiece,
  faRobot,
  faServer
} from '#/renderer/src/fontawesome';

/**
 * Curated map from plugin-declared icon names to host Font Awesome icons.
 * Plugins pass these names via `MainViewContribution.icon`.
 */
const PLUGIN_TAB_ICONS: Record<string, IconDefinition> = {
  'server': faServer,
  'database': faDatabase,
  'globe': faGlobe,
  'code': faCode,
  'robot': faRobot,
  'puzzle-piece': faPuzzlePiece,
  'bolt': faBolt,
  'flask': faFlask
};

/**
 * Resolves a plugin main-view icon name to a Font Awesome icon definition.
 * Unknown or missing names fall back to the puzzle-piece plugin default.
 *
 * @param name - Optional icon name from the plugin contribution.
 * @returns Icon used in the page tab bar.
 */
export function resolvePluginTabIcon(name: string | undefined): IconDefinition {
  if (name == null || name.trim().length === 0) {
    return faPuzzlePiece;
  }
  return PLUGIN_TAB_ICONS[name.trim()] ?? faPuzzlePiece;
}
