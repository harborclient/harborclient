import { SegmentedTabs, SegmentedTabsGroup } from '@harborclient/sdk/components';
import { useCallback, useEffect, useState, type JSX } from 'react';
import type {
  TeamHubNotificationLevel,
  TeamHubNotificationSettings
} from '@harborclient/core/types';
import { isTeamHubNoticesGracefulError } from './isTeamHubNoticesGracefulError';

interface Props {
  /**
   * Team Hub connection id whose notification settings are being edited.
   */
  hubId: string;

  /**
   * Accessible label prefix for the settings region.
   */
  ariaLabel?: string;
}

const LEVEL_OPTIONS: Array<{ value: TeamHubNotificationLevel; label: string }> = [
  { value: 'all', label: 'All activity' },
  { value: 'mentions', label: 'Mentions only' },
  { value: 'none', label: 'None' }
];

/**
 * Inline notification level picker persisted through Team Hub API routes.
 */
export function TeamHubNotificationSettings({
  hubId,
  ariaLabel = 'Notification settings'
}: Props): JSX.Element {
  const [settings, setSettings] = useState<TeamHubNotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);

  /**
   * Loads notification settings from the Team Hub server.
   */
  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const response = await window.api.getTeamHubNotificationSettings(hubId);
      setSettings(response);
      setUnsupported(false);
    } catch (err) {
      if (isTeamHubNoticesGracefulError(err)) {
        setUnsupported(true);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setLoading(false);
    }
  }, [hubId]);

  /**
   * Loads settings when the hub id changes.
   */
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) {
        void refresh();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  /**
   * Persists a new notification level to the Team Hub server.
   *
   * @param level - Replacement notification delivery preference.
   */
  const handleLevelChange = useCallback(
    async (level: TeamHubNotificationLevel): Promise<void> => {
      setSaving(true);
      setError(null);
      try {
        const response = await window.api.updateTeamHubNotificationSettings(hubId, { level });
        setSettings(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setSaving(false);
      }
    },
    [hubId]
  );

  if (loading) {
    return (
      <p className="m-0 text-muted" role="status" aria-live="polite">
        Loading notification settings…
      </p>
    );
  }

  if (unsupported) {
    return (
      <p className="m-0 text-muted" role="status">
        Notification settings are unavailable on this Team Hub.
      </p>
    );
  }

  return (
    <section aria-label={ariaLabel} aria-busy={saving}>
      <p className="m-0 mb-2 font-medium text-text">Notifications</p>
      <SegmentedTabsGroup
        value={settings?.level ?? 'all'}
        onChange={(value) => {
          void handleLevelChange(value as TeamHubNotificationLevel);
        }}
        ariaLabel="Notification level"
      >
        <SegmentedTabs
          pattern="radiogroup"
          editable={false}
          tabs={LEVEL_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
            disabled: saving
          }))}
        />
      </SegmentedTabsGroup>
      {error != null ? (
        <p className="mt-2 mb-0 text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
