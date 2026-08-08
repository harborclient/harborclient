import { useCallback, useEffect, useState } from 'react';
import type { HubDeviceKeyRecord } from '@harborclient/core/types';
import { stripIpcInvokeErrorPrefix } from '@harborclient/core/gitHttpErrors';

/**
 * Message returned when device enrollment is gated behind discussion E2EE.
 *
 * Kept in sync with Team Hub's DEVICE_ENROLLMENT_DISABLED_MESSAGE and the
 * team-hub-api helper of the same name.
 */
const DEVICE_ENROLLMENT_DISABLED_MESSAGE =
  'Device enrollment is only available on Team Hubs with discussion E2EE enabled.';

/**
 * Loaded Team Hub device key list and bootstrap state from IPC.
 */
export interface TeamHubDevicesState {
  /**
   * Device key enrollments returned by the management API.
   */
  devices: HubDeviceKeyRecord[];

  /**
   * True while the initial or retried IPC load is in flight.
   */
  loading: boolean;

  /**
   * User-facing message when the IPC bootstrap fails; null on success or before first attempt.
   */
  error: string | null;

  /**
   * True when the hub reports device enrollment as unavailable (discussion E2EE off).
   */
  enrollmentDisabled: boolean;

  /**
   * Re-runs the IPC bootstrap for the current hub id.
   */
  reload: () => void;
}

/**
 * Returns whether an IPC or client error means device enrollment is unavailable.
 *
 * Electron serializes main-process errors as plain `Error` messages, so this
 * matches the enrollment-disabled copy even after IPC wrapping.
 *
 * @param err - Caught value from listing device keys.
 */
function isDeviceEnrollmentDisabledError(err: unknown): boolean {
  const message = err instanceof Error ? stripIpcInvokeErrorPrefix(err.message) : String(err ?? '');
  return message.includes(DEVICE_ENROLLMENT_DISABLED_MESSAGE);
}

/**
 * Loads Team Hub device key enrollments for an admin hub connection via IPC.
 *
 * @param hubId - Team hub connection id with an admin token, or null to skip loading.
 * @returns Device list, loading/error flags, and a reload callback.
 */
export function useTeamHubDevices(hubId: string | null): TeamHubDevicesState {
  const [devices, setDevices] = useState<HubDeviceKeyRecord[]>([]);
  const [loading, setLoading] = useState(Boolean(hubId));
  const [error, setError] = useState<string | null>(null);
  const [enrollmentDisabled, setEnrollmentDisabled] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  /**
   * Triggers a fresh IPC bootstrap without changing external dependencies.
   */
  const reload = useCallback((): void => {
    setReloadToken((token) => token + 1);
  }, []);

  useEffect(() => {
    if (!hubId) {
      return;
    }

    let cancelled = false;

    void Promise.resolve()
      .then(() => {
        if (cancelled) return;
        setLoading(true);
        setError(null);
        setEnrollmentDisabled(false);
        return window.api.listTeamHubDeviceKeys(hubId);
      })
      .then((result) => {
        if (cancelled || result === undefined) return;
        setDevices(result);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoading(false);
        if (isDeviceEnrollmentDisabledError(err)) {
          setDevices([]);
          setEnrollmentDisabled(true);
          setError(null);
          return;
        }
        setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [hubId, reloadToken]);

  if (!hubId) {
    return {
      devices: [],
      loading: false,
      error: null,
      enrollmentDisabled: false,
      reload
    };
  }

  return { devices, loading, error, enrollmentDisabled, reload };
}
