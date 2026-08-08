/**
 * Error thrown when a config file cannot be read or fails validation.
 */
export class ConfigError extends Error {
  /**
   * Creates a config error with a user-facing message.
   *
   * @param message - Description of what went wrong.
   */
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}
