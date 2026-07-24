import type { SerializableMenuContribution } from '#/shared/plugin/types';

let menuContributions: SerializableMenuContribution[] = [];

/**
 * Replaces the current plugin menu contribution list.
 *
 * @param contributions - Serializable menu entries from the renderer registry.
 */
export function setPluginMenuContributions(contributions: SerializableMenuContribution[]): void {
  menuContributions = [...contributions];
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
