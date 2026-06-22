/**
 * Thrown when a HarborClient Server request fails or the response body is invalid.
 */
export class ServerClientError extends Error {
  /**
   * HTTP status code from the server, or `0` for network and parse failures.
   */
  readonly status: number;

  /**
   * HTTP method used for the failed request.
   */
  readonly method: string;

  /**
   * Request path relative to the configured base URL.
   */
  readonly path: string;

  /**
   * Creates a server client error with request context for logging and UI display.
   *
   * @param message - Human-readable error description.
   * @param options - HTTP status and request metadata.
   */
  constructor(
    message: string,
    options: {
      status: number;
      method: string;
      path: string;
    }
  ) {
    super(message);
    this.name = 'ServerClientError';
    this.status = options.status;
    this.method = options.method;
    this.path = options.path;
  }
}
