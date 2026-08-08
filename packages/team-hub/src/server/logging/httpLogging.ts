import type { FastifyInstance } from 'fastify';
import type { LogFormat } from '#/config/loggingConfig.js';
import type { Logger } from '#/server/logging/logger.js';

/**
 * Options for {@link registerHttpLogging}.
 */
export interface RegisterHttpLoggingOptions {
  /**
   * Winston logger configured from server.yaml.
   */
  logger: Logger;

  /**
   * Output format; JSON mode emits access logs at info for Loki/Cloud Logging.
   */
  format: LogFormat;
}

/**
 * Registers HTTP request, completion, and error logging hooks on a Fastify instance.
 *
 * Incoming requests are logged at debug. Completions include duration and status
 * (info for JSON format, debug for simple). Unhandled errors are logged at error
 * without altering response handling.
 *
 * @param app - Fastify server to attach hooks to.
 * @param options - Logger and format used to choose access-log severity.
 */
export function registerHttpLogging(
  app: FastifyInstance,
  options: RegisterHttpLoggingOptions
): void {
  const { logger, format } = options;

  app.addHook('onRequest', async (request) => {
    logger.debug('request', {
      reqId: request.id,
      method: request.method,
      url: request.url,
      ip: request.ip
    });
  });

  app.addHook('onResponse', async (request, reply) => {
    const payload = {
      reqId: request.id,
      method: request.method,
      url: request.url,
      route: request.routeOptions.url ?? 'unknown',
      statusCode: reply.statusCode,
      durationMs: Math.round(reply.elapsedTime)
    };

    if (format === 'json') {
      logger.info('request completed', payload);
    } else {
      logger.debug('request completed', payload);
    }
  });

  app.addHook('onError', async (request, reply, error) => {
    logger.error('request error', {
      reqId: request.id,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      message: error.message,
      stack: error.stack
    });
  });
}
