/**
 * Optional TLS settings for a MySQL connection pool.
 *
 * Accepts a boolean toggle or an object with certificate material for managed
 * databases that require custom CA or client certificates.
 */
export type MysqlSslConfig =
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
 * Validated configuration for a MySQL database connection.
 */
export interface MysqlDatabaseConfig {
  /**
   * MySQL server hostname or IP address.
   */
  host: string;

  /**
   * TCP port for the MySQL server.
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
   * Default database/schema name.
   */
  database: string;

  /**
   * Maximum number of connections in the pool.
   *
   * Mapped to mysql2 `connectionLimit`. When omitted, the driver default applies
   * (typically 10).
   */
  max?: number;

  /**
   * Milliseconds an idle connection may remain in the pool before being closed.
   *
   * Mapped to mysql2 `idleTimeout`. When omitted, the driver default applies.
   */
  idleTimeoutMillis?: number;

  /**
   * Milliseconds to wait when establishing a new connection before timing out.
   *
   * Mapped to mysql2 `connectTimeout`. When omitted, the driver default applies.
   */
  connectionTimeoutMillis?: number;

  /**
   * TLS settings for the connection. Pass `true` to enable TLS with defaults,
   * or an object for custom certificate material.
   *
   * When omitted, the driver default applies (no TLS for typical local setups).
   */
  ssl?: MysqlSslConfig;
}
