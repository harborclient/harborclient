import { describe, expect, it } from 'vitest';
import {
  filterCollectionProviders,
  filterSnippetProviders,
  type ProviderOption
} from './useProviders';

const databaseProvider: ProviderOption = {
  id: 'db-1',
  name: 'Local SQLite',
  kind: 'database',
  type: 'sqlite'
};

const userHubProvider: ProviderOption = {
  id: 'hub-user',
  name: 'Team Hub User',
  kind: 'team-hub'
};

const adminHubProvider: ProviderOption = {
  id: 'hub-admin',
  name: 'Team Hub Admin',
  kind: 'team-hub'
};

describe('filterCollectionProviders', () => {
  it('keeps admin team hubs alongside databases and user team hubs', () => {
    const providers = [databaseProvider, userHubProvider, adminHubProvider];

    expect(filterCollectionProviders(providers)).toEqual(providers);
  });
});

describe('filterSnippetProviders', () => {
  it('omits team hubs without snippet storage while keeping databases', () => {
    const providers = [databaseProvider, userHubProvider, adminHubProvider];
    const unsupportedHubIds = new Set(['hub-admin']);

    expect(filterSnippetProviders(providers, unsupportedHubIds)).toEqual([
      databaseProvider,
      userHubProvider
    ]);
  });
});
