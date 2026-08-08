import { describe, expect, it } from 'vitest';
import { mysqlConfigSchema } from '#/db/mysql/schemas.js';

const validConfig = {
  driver: 'mysql' as const,
  host: '127.0.0.1',
  port: 3306,
  user: 'harbor',
  password: 'harbor',
  database: 'harbor'
};

describe('mysqlConfigSchema pool options', () => {
  it('accepts optional pool and ssl fields', () => {
    const parsed = mysqlConfigSchema.safeParse({
      ...validConfig,
      max: 25,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 2000,
      ssl: true
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.max).toBe(25);
      expect(parsed.data.idleTimeoutMillis).toBe(10000);
      expect(parsed.data.connectionTimeoutMillis).toBe(2000);
      expect(parsed.data.ssl).toBe(true);
    }
  });

  it('coerces numeric string pool fields from env-rendered YAML', () => {
    const parsed = mysqlConfigSchema.safeParse({
      ...validConfig,
      max: '25',
      idleTimeoutMillis: '10000',
      connectionTimeoutMillis: '2000'
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.max).toBe(25);
      expect(parsed.data.idleTimeoutMillis).toBe(10000);
      expect(parsed.data.connectionTimeoutMillis).toBe(2000);
    }
  });

  it('treats null and empty pool fields as unset', () => {
    const parsed = mysqlConfigSchema.safeParse({
      ...validConfig,
      max: null,
      idleTimeoutMillis: '',
      connectionTimeoutMillis: null,
      ssl: ''
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.max).toBeUndefined();
      expect(parsed.data.idleTimeoutMillis).toBeUndefined();
      expect(parsed.data.connectionTimeoutMillis).toBeUndefined();
      expect(parsed.data.ssl).toBeUndefined();
    }
  });

  it('accepts object ssl settings and string boolean values', () => {
    const objectSsl = mysqlConfigSchema.safeParse({
      ...validConfig,
      ssl: { rejectUnauthorized: false, ca: 'pem' }
    });
    const stringTrue = mysqlConfigSchema.safeParse({
      ...validConfig,
      ssl: 'true'
    });
    const stringFalse = mysqlConfigSchema.safeParse({
      ...validConfig,
      ssl: 'false'
    });

    expect(objectSsl.success).toBe(true);
    if (objectSsl.success) {
      expect(objectSsl.data.ssl).toEqual({ rejectUnauthorized: false, ca: 'pem' });
    }
    expect(stringTrue.success).toBe(true);
    if (stringTrue.success) {
      expect(stringTrue.data.ssl).toBe(true);
    }
    expect(stringFalse.success).toBe(true);
    if (stringFalse.success) {
      expect(stringFalse.data.ssl).toBe(false);
    }
  });

  it('rejects invalid max and timeout values', () => {
    expect(
      mysqlConfigSchema.safeParse({
        ...validConfig,
        max: 0
      }).success
    ).toBe(false);
    expect(
      mysqlConfigSchema.safeParse({
        ...validConfig,
        idleTimeoutMillis: -1
      }).success
    ).toBe(false);
    expect(
      mysqlConfigSchema.safeParse({
        ...validConfig,
        connectionTimeoutMillis: 'nope'
      }).success
    ).toBe(false);
    expect(
      mysqlConfigSchema.safeParse({
        ...validConfig,
        ssl: 1
      }).success
    ).toBe(false);
  });
});
