/**
 * Rebuilds the full tab order after the visible subset was reordered by drag,
 * keeping hidden tabs pinned at their original positions.
 *
 * @param fullOrder - Current tab ids in display order.
 * @param hiddenTabIds - Tab ids that are hidden from the tab bar during edit mode.
 * @param newVisibleOrder - Reordered visible tab ids.
 * @returns Full tab order with hidden tabs unchanged and visible tabs reordered.
 */
export function mergeVisibleTabOrder(
  fullOrder: string[],
  hiddenTabIds: ReadonlySet<string>,
  newVisibleOrder: string[]
): string[] {
  const queue = [...newVisibleOrder];
  return fullOrder.map((tabId) => (hiddenTabIds.has(tabId) ? tabId : (queue.shift() ?? tabId)));
}
