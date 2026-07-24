/**
 * Validates and normalizes a public git repository URL for plugin installation.
 *
 * Only http and https URLs are accepted to avoid cloning local paths or ssh targets.
 *
 * @param url - User-supplied repository URL.
 * @returns Trimmed, validated URL string.
 * @throws When the URL is missing, malformed, or uses a disallowed scheme.
 */
export function assertSafeGitPluginUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error('Repository URL is required.');
  }

  if (trimmed.startsWith('git@') || trimmed.includes('://git@')) {
    throw new Error('SSH git URLs are not supported. Use an https:// repository URL.');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Repository URL is not valid.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https git repository URLs are supported.');
  }

  if (!parsed.hostname) {
    throw new Error('Repository URL must include a hostname.');
  }

  return trimmed;
}
