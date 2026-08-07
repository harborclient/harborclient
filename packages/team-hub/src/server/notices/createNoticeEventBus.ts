import { redisSectionSchema } from '#/config/serverConfig.schema.js';
import type { INoticeEventBus } from '#/server/notices/INoticeEventBus.js';
import { InMemoryNoticeEventBus } from '#/server/notices/InMemoryNoticeEventBus.js';
import { RedisNoticeEventBus } from '#/server/notices/RedisNoticeEventBus.js';

/**
 * Supported notice event fan-out modes.
 */
export type NoticeEventBusMode = 'memory' | 'redis';

/**
 * Creates the configured notice event bus from the raw `redis` config section.
 *
 * Defaults to an in-memory bus. Set `redis.noticeEventsPubSub: true` to enable
 * Redis pub/sub for multi-instance deployments.
 *
 * @param redisConfig - Raw `redis` section from server.yaml.
 * @returns Notice event bus implementation.
 */
export function createNoticeEventBus(redisConfig: unknown): INoticeEventBus {
  const mode = resolveNoticeEventBusMode(redisConfig);
  return createNoticeEventBusForMode(mode, redisConfig);
}

/**
 * Resolves the notice event bus mode from server.yaml redis settings.
 *
 * @param redisConfig - Raw `redis` section from server.yaml.
 * @returns Effective notice event bus mode.
 */
export function resolveNoticeEventBusMode(redisConfig: unknown): NoticeEventBusMode {
  const parsed = redisSectionSchema.safeParse(redisConfig);
  if (!parsed.success) {
    return 'memory';
  }

  if (parsed.data.noticeEventsPubSub === true) {
    return 'redis';
  }

  return 'memory';
}

/**
 * Builds a notice event bus for the requested mode.
 *
 * @param mode - In-memory or Redis pub/sub mode.
 * @param redisConfig - Raw `redis` section from server.yaml.
 * @returns Notice event bus implementation.
 */
export function createNoticeEventBusForMode(
  mode: NoticeEventBusMode,
  redisConfig: unknown
): INoticeEventBus {
  if (mode === 'redis') {
    return RedisNoticeEventBus.fromConfig(redisConfig);
  }

  return new InMemoryNoticeEventBus();
}
