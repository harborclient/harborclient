import { describe, expect, it } from 'vitest';
import { ConfigError } from '#/config/configError.js';
import { interpolateEnvInDocument } from '#/config/interpolateEnv.js';

describe('interpolateEnvInDocument', () => {
  it('substitutes a simple ${VAR} placeholder', () => {
    const result = interpolateEnvInDocument(
      { db: { password: '${TEAM_HUB_DB_PASSWORD}' } },
      { TEAM_HUB_DB_PASSWORD: 's3cret' }
    );

    expect(result).toEqual({ db: { password: 's3cret' } });
  });

  it('applies ${VAR:-default} when the variable is unset', () => {
    const result = interpolateEnvInDocument(
      { redis: { host: '${TEAM_HUB_REDIS_HOST:-127.0.0.1}' } },
      {}
    );

    expect(result).toEqual({ redis: { host: '127.0.0.1' } });
  });

  it('applies an empty default for ${VAR:-}', () => {
    const result = interpolateEnvInDocument(
      { metrics: { authToken: '${TEAM_HUB_METRICS_AUTH_TOKEN:-}' } },
      {}
    );

    expect(result).toEqual({ metrics: { authToken: '' } });
  });

  it('prefers a non-empty env value over a default', () => {
    const result = interpolateEnvInDocument(
      { redis: { host: '${TEAM_HUB_REDIS_HOST:-127.0.0.1}' } },
      { TEAM_HUB_REDIS_HOST: 'redis.internal' }
    );

    expect(result).toEqual({ redis: { host: 'redis.internal' } });
  });

  it('treats empty env as unset for ${VAR:-default}', () => {
    const result = interpolateEnvInDocument(
      { redis: { host: '${TEAM_HUB_REDIS_HOST:-127.0.0.1}' } },
      { TEAM_HUB_REDIS_HOST: '' }
    );

    expect(result).toEqual({ redis: { host: '127.0.0.1' } });
  });

  it('throws ConfigError naming the variable and key path when required env is missing', () => {
    expect(() =>
      interpolateEnvInDocument({ db: { password: '${TEAM_HUB_DB_PASSWORD}' } }, {})
    ).toThrow(ConfigError);

    expect(() =>
      interpolateEnvInDocument({ db: { password: '${TEAM_HUB_DB_PASSWORD}' } }, {})
    ).toThrow('Missing environment variable TEAM_HUB_DB_PASSWORD for config key db.password');
  });

  it('throws when a required env value is empty', () => {
    expect(() =>
      interpolateEnvInDocument(
        { db: { password: '${TEAM_HUB_DB_PASSWORD}' } },
        { TEAM_HUB_DB_PASSWORD: '' }
      )
    ).toThrow('Missing environment variable TEAM_HUB_DB_PASSWORD for config key db.password');
  });

  it('escapes $${NAME} to a literal ${NAME}', () => {
    const result = interpolateEnvInDocument(
      { note: 'use $${TEAM_HUB_DB_PASSWORD} in docs' },
      { TEAM_HUB_DB_PASSWORD: 'should-not-appear' }
    );

    expect(result).toEqual({ note: 'use ${TEAM_HUB_DB_PASSWORD} in docs' });
  });

  it('interpolates nested objects and arrays', () => {
    const result = interpolateEnvInDocument(
      {
        llm: {
          providers: {
            openai: { apiKey: '${OPENAI_KEY}' }
          },
          models: ['${MODEL_A}', 'gpt-4o']
        }
      },
      { OPENAI_KEY: 'sk-test', MODEL_A: 'gpt-4o-mini' }
    );

    expect(result).toEqual({
      llm: {
        providers: {
          openai: { apiKey: 'sk-test' }
        },
        models: ['gpt-4o-mini', 'gpt-4o']
      }
    });
  });

  it('leaves numbers, booleans, and null unchanged', () => {
    const input = {
      port: 8787,
      enabled: true,
      missing: null,
      label: '${LABEL}'
    };

    const result = interpolateEnvInDocument(input, { LABEL: 'ok' });

    expect(result).toEqual({
      port: 8787,
      enabled: true,
      missing: null,
      label: 'ok'
    });
  });

  it('supports multiple placeholders in one string', () => {
    const result = interpolateEnvInDocument(
      { url: 'postgres://${USER}:${PASS}@${HOST}' },
      { USER: 'u', PASS: 'p', HOST: 'db' }
    );

    expect(result).toEqual({ url: 'postgres://u:p@db' });
  });

  it('returns documents without placeholders unchanged', () => {
    const input = { host: '127.0.0.1', port: 5432 };
    expect(interpolateEnvInDocument(input, {})).toEqual(input);
  });
});
