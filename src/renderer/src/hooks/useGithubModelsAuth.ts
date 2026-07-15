import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import type { GithubModelsStatus } from '#/shared/types';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { setGithubModelsStatus } from '#/renderer/src/store/slices/aiChatSlice';
import { refreshHubLlmModels } from '#/renderer/src/store/thunks/aiChat';

/**
 * Drives GitHub Models device-flow sign-in from Settings or the empty AI sidebar.
 *
 * @param options - Optional callback invoked after successful sign-in.
 */
export function useGithubModelsAuth(options?: { onSignedIn?: () => void }): {
  status: GithubModelsStatus;
  userCode: string | null;
  waiting: boolean;
  busy: boolean;
  error: string | null;
  start: () => Promise<void>;
  finish: () => Promise<void>;
  signOut: () => Promise<void>;
  reloadStatus: () => Promise<void>;
} {
  const dispatch = useAppDispatch();
  const [status, setStatus] = useState<GithubModelsStatus>({ connected: false });
  const [userCode, setUserCode] = useState<string | null>(null);
  const [verificationUri, setVerificationUri] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Reloads GitHub Models connection status from the main process.
   */
  const reloadStatus = useCallback(async (): Promise<void> => {
    const nextStatus = await window.api.getGithubModelsStatus();
    setStatus(nextStatus);
    dispatch(setGithubModelsStatus(nextStatus));
  }, [dispatch]);

  /**
   * Loads GitHub Models status when the hook mounts.
   */
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const nextStatus = await window.api.getGithubModelsStatus();
      if (!cancelled) {
        setStatus(nextStatus);
        dispatch(setGithubModelsStatus(nextStatus));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  /**
   * Applies sign-in completion events from the main-process background poller.
   */
  useEffect(() => {
    const onSignedIn = options?.onSignedIn;
    return window.api.onGithubModelsSignInFinished((event) => {
      setWaiting(false);

      if (event.ok) {
        void (async () => {
          await reloadStatus();
          await dispatch(refreshHubLlmModels()).unwrap();
          setUserCode(null);
          setVerificationUri(null);
          setError(null);
          toast.success('GitHub Models connected.');
          onSignedIn?.();
        })();
        return;
      }

      setUserCode(null);
      setVerificationUri(null);
      setError(event.error ?? 'GitHub sign-in failed.');
    });
  }, [dispatch, options?.onSignedIn, reloadStatus]);

  /**
   * Starts GitHub Models device flow and shows the user code without opening the browser yet.
   */
  const start = useCallback(async (): Promise<void> => {
    setBusy(true);
    setError(null);
    setWaiting(false);
    try {
      const result = await window.api.startGithubModelsSignIn();
      setUserCode(result.userCode);
      setVerificationUri(result.verificationUri);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : String(startError));
    } finally {
      setBusy(false);
    }
  }, []);

  /**
   * Opens the GitHub verification URI and starts background polling for approval.
   */
  const finish = useCallback(async (): Promise<void> => {
    if (!verificationUri) {
      setError('Start GitHub sign-in first to get a verification code.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await window.api.completeGithubModelsSignIn(verificationUri);
      setWaiting(true);
    } catch (finishError) {
      setError(finishError instanceof Error ? finishError.message : String(finishError));
    } finally {
      setBusy(false);
    }
  }, [verificationUri]);

  /**
   * Removes stored GitHub Models credentials.
   */
  const signOut = useCallback(async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await window.api.signOutGithubModels();
      await reloadStatus();
      await dispatch(refreshHubLlmModels()).unwrap();
      setUserCode(null);
      setVerificationUri(null);
      setWaiting(false);
      toast.success('Signed out of GitHub Models.');
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : String(signOutError));
    } finally {
      setBusy(false);
    }
  }, [dispatch, reloadStatus]);

  return {
    status,
    userCode,
    waiting,
    busy,
    error,
    start,
    finish,
    signOut,
    reloadStatus
  };
}
