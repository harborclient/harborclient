import { useCallback, useState } from 'react';

/**
 * Enrollment action state for Team Hub device keys.
 */
export interface TeamHubDeviceEnrollmentState {
  /**
   * True while enrollment IPC is in flight.
   */
  enrolling: boolean;

  /**
   * User-facing enrollment error, if the last attempt failed.
   */
  error: string | null;

  /**
   * Enrolls the current device on the given Team Hub connection.
   */
  enroll: (hubId: string, label?: string) => Promise<boolean>;

  /**
   * Clears the last enrollment error without changing enrollment state.
   */
  clearError: () => void;
}

/**
 * Wraps Team Hub device enrollment IPC for renderer UI flows.
 *
 * @returns Enrollment busy/error state and an enroll callback.
 */
export function useTeamHubDeviceEnrollment(): TeamHubDeviceEnrollmentState {
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Enrolls the current device and triggers a session rescan on success.
   */
  const enroll = useCallback(async (hubId: string, label?: string): Promise<boolean> => {
    setEnrolling(true);
    setError(null);

    try {
      await window.api.enrollTeamHubDevice(hubId, label);
      await window.api.scanTeamHubSessions();
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setEnrolling(false);
    }
  }, []);

  /**
   * Clears the displayed enrollment error.
   */
  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  return { enrolling, error, enroll, clearError };
}
