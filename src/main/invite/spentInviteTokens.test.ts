import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { LocalDatabase } from '#/main/storage/LocalDatabase';
import {
  clearLocalDatabaseForTesting,
  setLocalDatabaseForTesting
} from '#/main/storage/localDatabaseInstance';
import { createPersistedSpentInviteTokenStore } from '#/main/invite/spentInviteTokens';
import { describeSqlite } from '#/test/nativeModules';

let tempDir: string;
let database: LocalDatabase;

describeSqlite('spentInviteTokens', () => {
  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'hc-spent-invite-'));
    database = new LocalDatabase(tempDir);
    await database.init();
    setLocalDatabaseForTesting(database);
  });

  afterEach(async () => {
    await database.close();
    rmSync(tempDir, { recursive: true, force: true });
    clearLocalDatabaseForTesting();
  });

  it('markSpent records a jti as spent', () => {
    const store = createPersistedSpentInviteTokenStore();
    const exp = Date.now() + 60_000;

    expect(store.isSpent('invite-jti-1')).toBe(false);
    store.markSpent('invite-jti-1', exp);
    expect(store.isSpent('invite-jti-1')).toBe(true);
  });

  it('prunes expired entries and no longer reports them as spent', () => {
    const store = createPersistedSpentInviteTokenStore();
    store.markSpent('expired-jti', Date.now() - 1);

    expect(store.isSpent('expired-jti')).toBe(false);
  });

  it('persists spent entries across store re-creation', () => {
    const exp = Date.now() + 60_000;
    createPersistedSpentInviteTokenStore().markSpent('persisted-jti', exp);

    const reloaded = createPersistedSpentInviteTokenStore();
    expect(reloaded.isSpent('persisted-jti')).toBe(true);
  });
});
