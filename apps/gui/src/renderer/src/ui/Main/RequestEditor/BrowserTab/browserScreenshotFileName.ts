/**
 * Builds a default PNG filename for a browser tab screenshot save dialog.
 *
 * Prefers a sanitized page title; falls back to `screenshot.png`.
 *
 * @param title - Browser tab page title.
 * @returns Filename ending in `.png`.
 */
export function browserScreenshotDefaultFileName(title: string): string {
  const sanitized = title
    .trim()
    .replace(/[^\w\s-]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  if (!sanitized) {
    return 'screenshot.png';
  }
  return `${sanitized}.png`;
}
