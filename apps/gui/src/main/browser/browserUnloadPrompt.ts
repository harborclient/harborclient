/**
 * Interprets the Leave / Stay button index from the browser unload confirmation dialog.
 *
 * Button 0 is Leave (allow unload); any other index (including Stay / cancel) keeps the page.
 *
 * @param buttonIndex - Index returned by `dialog.showMessageBoxSync`.
 * @returns True when the user chose Leave.
 */
export function isLeaveBrowserUnloadChoice(buttonIndex: number): boolean {
  return buttonIndex === 0;
}
