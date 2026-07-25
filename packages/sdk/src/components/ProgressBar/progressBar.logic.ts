/**
 * Computes the fill width percentage for a determinate progress bar.
 *
 * @param value - Current progress count.
 * @param max - Total count; zero yields 0% to avoid division by zero.
 * @returns Rounded percentage between 0 and 100.
 */
export function progressFillPercent(value: number, max: number): number {
  if (max === 0) {
    return 0;
  }
  return Math.round((value / max) * 100);
}
