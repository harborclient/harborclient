import type { RegisteredSidebarPanel } from '@harborclient/core/plugin/types';

/**
 * Fingerprint of the last multi-replacement conflict warning so we only log once
 * per distinct candidate set (avoids spam on every render).
 */
let lastCollectionsReplacementConflictKey: string | null = null;

/**
 * Compares two sidebar panels for replacement winner selection.
 *
 * Order: lowest `order` (default 100), then `pluginId`, then `contributionId`
 * (all lexicographic for string fields).
 *
 * @param a - First panel.
 * @param b - Second panel.
 * @returns Negative when `a` should win over `b`.
 */
function compareReplacementCandidates(
  a: RegisteredSidebarPanel,
  b: RegisteredSidebarPanel
): number {
  const orderA = a.order ?? 100;
  const orderB = b.order ?? 100;
  if (orderA !== orderB) {
    return orderA - orderB;
  }
  const pluginCmp = a.pluginId.localeCompare(b.pluginId);
  if (pluginCmp !== 0) {
    return pluginCmp;
  }
  return a.contributionId.localeCompare(b.contributionId);
}

/**
 * Selects the single panel that replaces the built-in Collections sidebar.
 *
 * When multiple panels declare `replaces: "collections"`, the winner is the
 * lowest `order` (default 100), then lowest `pluginId`, then lowest
 * `contributionId`. A deduped warning is logged when more than one candidate
 * exists.
 *
 * @param panels - Registered sidebar panel contributions.
 * @returns The winning replacement panel, or `null` when none claim collections.
 */
export function selectCollectionsReplacementPanel(
  panels: RegisteredSidebarPanel[]
): RegisteredSidebarPanel | null {
  const candidates = panels.filter((panel) => panel.replaces === 'collections');
  if (candidates.length === 0) {
    return null;
  }

  const sorted = [...candidates].sort(compareReplacementCandidates);
  const winner = sorted[0] ?? null;

  if (sorted.length > 1 && winner != null) {
    const conflictKey = sorted.map((panel) => panel.id).join('|');
    if (conflictKey !== lastCollectionsReplacementConflictKey) {
      lastCollectionsReplacementConflictKey = conflictKey;
      const losers = sorted
        .slice(1)
        .map((panel) => `${panel.pluginId}/${panel.contributionId}`)
        .join(', ');
      console.warn(
        `[sidebar] Multiple plugins claim replaces: "collections". ` +
          `Using ${winner.pluginId}/${winner.contributionId}; ignoring: ${losers}.`
      );
    }
  } else if (sorted.length <= 1) {
    lastCollectionsReplacementConflictKey = null;
  }

  return winner;
}

/**
 * Resolves which sidebar panel body the host should mount.
 *
 * - A non-null `activeId` that matches a registered panel → that panel.
 * - `activeId === null` with a collections replacement winner → that winner
 *   (primary collections surface).
 * - Otherwise → `null` (built-in Collections tree).
 *
 * Stale ids that no longer match a registered panel fall through to the primary
 * surface resolution (replacement or built-in).
 *
 * @param panels - Registered sidebar panel contributions.
 * @param activeId - Redux `activeSidebarPanelId` (`null` = primary surface).
 * @returns The panel to display, or `null` for the built-in Collections body.
 */
export function resolveDisplayedSidebarPanel(
  panels: RegisteredSidebarPanel[],
  activeId: string | null
): RegisteredSidebarPanel | null {
  if (activeId != null) {
    const matched = panels.find((panel) => panel.id === activeId);
    if (matched != null) {
      return matched;
    }
  }

  if (activeId === null) {
    return selectCollectionsReplacementPanel(panels);
  }

  // Stale non-null id: treat like primary surface.
  return selectCollectionsReplacementPanel(panels);
}

/**
 * Returns plugin panels that do not replace the built-in Collections sidebar.
 *
 * These remain switchable destinations alongside the primary surface.
 *
 * @param panels - Registered sidebar panel contributions.
 * @returns Panels without `replaces: "collections"`.
 */
export function getNonReplacingSidebarPanels(
  panels: RegisteredSidebarPanel[]
): RegisteredSidebarPanel[] {
  return panels.filter((panel) => panel.replaces !== 'collections');
}

/**
 * Whether the sidebar panel switcher strip should render.
 *
 * Without a replacement winner: show when any plugin panels exist (legacy).
 * With a winner: show only when at least one non-replacing panel can be switched to.
 *
 * @param panels - All registered sidebar panels.
 * @param winner - Collections replacement winner, if any.
 * @returns `true` when the switcher should be visible.
 */
export function shouldRenderSidebarPanelSwitcher(
  panels: RegisteredSidebarPanel[],
  winner: RegisteredSidebarPanel | null
): boolean {
  if (winner == null) {
    return panels.length > 0;
  }
  return getNonReplacingSidebarPanels(panels).length > 0;
}

/**
 * Resets the conflict-warning dedupe key (for unit tests).
 */
export function resetCollectionsReplacementConflictWarning(): void {
  lastCollectionsReplacementConflictKey = null;
}
