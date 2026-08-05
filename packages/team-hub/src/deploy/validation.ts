/**
 * Validates a Docker image tag or semver fragment used in deployment configuration.
 *
 * @param tag - Candidate image tag from user input or environment.
 * @returns True when the tag is safe to embed in compose files and CLI output.
 */
export function isValidImageTag(tag: string): boolean {
  if (!tag || tag.length > 128) {
    return false;
  }

  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(tag);
}

/**
 * Validates a TCP port number for host port mapping.
 *
 * @param port - Port string from environment or CLI flags.
 * @returns True when the value is an integer between 1 and 65535.
 */
export function isValidPort(port: string): boolean {
  const value = Number.parseInt(port, 10);
  return Number.isInteger(value) && value >= 1 && value <= 65535;
}

/**
 * Validates a deployment directory path segment or absolute path for safe use with Docker.
 *
 * @param dirPath - Directory path supplied by the user.
 * @returns True when the path does not contain shell metacharacters.
 */
export function isSafeDirectoryPath(dirPath: string): boolean {
  if (!dirPath || dirPath.includes('\0')) {
    return false;
  }

  return !/[;&|`$<>]/.test(dirPath);
}

/**
 * Validates a Docker Compose project name.
 *
 * @param name - Compose project name candidate.
 * @returns True when the name matches Docker Compose naming rules.
 */
export function isValidComposeProjectName(name: string): boolean {
  return /^[a-z0-9][a-z0-9_-]*$/i.test(name) && name.length <= 255;
}
