/**
 * Optional TLS settings for a Postgres connection pool.
 *
 * Accepts a boolean toggle or an object with certificate material for managed
 * databases that require custom CA or client certificates.
 */
export type PostgresSslConfig =
  | boolean
  | {
      /**
       * When false, allows self-signed or hostname-mismatched server certificates.
       */
      rejectUnauthorized?: boolean;

      /**
       * PEM-encoded CA certificate(s).
       */
      ca?: string;

      /**
       * PEM-encoded client certificate.
       */
      cert?: string;

      /**
       * PEM-encoded client private key.
       */
      key?: string;
    };

/**
 * Validated configuration for a Postgres database connection.
 */
export interface PostgresDatabaseConfig {
  /**
   * Postgres server hostname or IP address.
   */
  host: string;

  /**
   * TCP port for the Postgres server.
   */
  port: number;

  /**
   * Database user name.
   */
  user: string;

  /**
   * Database user password.
   */
  password: string;

  /**
   * Default database name.
   */
  database: string;

  /**
   * Maximum number of clients in the pool (`pg` `max`).
   *
   * When omitted, the driver default applies (typically 10).
   */
  max?: number;

  /**
   * Milliseconds a client can sit idle in the pool before being closed.
   *
   * When omitted, the driver default applies.
   */
  idleTimeoutMillis?: number;

  /**
   * Milliseconds to wait when connecting a new client before timing out.
   *
   * When omitted, the driver default applies.
   */
  connectionTimeoutMillis?: number;

  /**
   * TLS settings for the connection. Pass `true` to enable TLS with defaults,
   * or an object for custom certificate material.
   *
   * When omitted, the driver default applies (no TLS for typical local setups).
   */
  ssl?: PostgresSslConfig;
}
