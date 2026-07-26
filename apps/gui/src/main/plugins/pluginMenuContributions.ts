import type { SerializableMenuContribution } from '@harborclient/core/plugin/types';

let menuContributions: SerializableMenuContribution[] = [];

/**
 * Returns whether two menu contribution lists describe the same entries in order.
 *
 * @param left - Previously stored contributions.
 * @param right - Incoming contributions from the renderer.
 */
function menuContributionsEqual(
  left: SerializableMenuContribution[],
  right: SerializableMenuContribution[]
): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((entry, index) => {
    const next = right[index];
    return (
      next != null &&
      entry.pluginId === next.pluginId &&
      entry.menu === next.menu &&
      entry.command === next.command &&
      entry.label === next.label &&
      entry.group === next.group &&
      entry.order === next.order
    );
  });
}

/**
 * Replaces the current plugin menu contribution list when it actually changes.
 *
 * @param contributions - Serializable menu entries from the renderer registry.
 * @returns True when the stored list changed and the app menu should rebuild.
 */
export function setPluginMenuContributions(contributions: SerializableMenuContribution[]): boolean {
  if (menuContributionsEqual(menuContributions, contributions)) {
    return false;
  }
  menuContributions = [...contributions];
  return true;
}

/**
 * Returns the current plugin menu contributions sorted for template merge.
 */
export function getPluginMenuContributions(): SerializableMenuContribution[] {
  return [...menuContributions].sort((left, right) => {
    const menuCompare = left.menu.localeCompare(right.menu);
    if (menuCompare !== 0) {
      return menuCompare;
    }
    const leftGroup = left.group ?? '';
    const rightGroup = right.group ?? '';
    const groupCompare = leftGroup.localeCompare(rightGroup);
    if (groupCompare !== 0) {
      return groupCompare;
    }
    const leftOrder = left.order ?? 100;
    const rightOrder = right.order ?? 100;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return (left.label ?? left.command).localeCompare(right.label ?? right.command);
  });
}
