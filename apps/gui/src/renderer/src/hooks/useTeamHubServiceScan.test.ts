import { describe, expect, it } from 'vitest';
import {
  clearTeamHubServiceScanListeners,
  requestTeamHubServiceRescan,
  subscribeTeamHubServiceRescan
} from './useTeamHubServiceScan';

describe('requestTeamHubServiceRescan', () => {
  it('notifies every registered listener', () => {
    clearTeamHubServiceScanListeners();

    let callCount = 0;
    const unsubscribe = subscribeTeamHubServiceRescan(() => {
      callCount += 1;
    });

    requestTeamHubServiceRescan();
    expect(callCount).toBe(1);

    requestTeamHubServiceRescan();
    expect(callCount).toBe(2);

    unsubscribe();
    requestTeamHubServiceRescan();
    expect(callCount).toBe(2);

    clearTeamHubServiceScanListeners();
  });
});
