import { Button, Page } from '@harborclient/sdk/components';
import { useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { TeamHub } from '@harborclient/core/types';
import { faArrowsRotate } from '#/renderer/src/fontawesome';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { getReloadConfigAlertMessage } from '#/renderer/src/ui/Tabs/TeamHub/teamHubReloadHelpers';
import { formatIpcErrorMessage, showAlert } from '#/renderer/src/ui/Modals/dialogHelpers';

interface Props {
  /**
   * Admin team hub connection whose server config will be reloaded.
   */
  hub: TeamHub;
}

/**
 * Team Hub admin panel for reloading reloadable server.yaml sections.
 */
export function TeamReloadView({ hub }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Reloads reloadable config sections on the selected hub connection.
   */
  const handleReload = async (): Promise<void> => {
    if (reloading) {
      return;
    }

    setError(null);
    setReloading(true);

    try {
      const result = await window.api.reloadTeamHubConfig(hub.id);
      const alertMessage = getReloadConfigAlertMessage(result);
      if (alertMessage) {
        showAlert(dispatch, alertMessage, 'Config reload failed', { icon: 'warning' });
        return;
      }

      toast.success('Config reloaded.');
    } catch (err) {
      setError(formatIpcErrorMessage(err, 'Failed to reload team hub config.'));
    } finally {
      setReloading(false);
    }
  };

  return (
    <Page
      embedded
      title="Reload"
      icon={faArrowsRotate}
      description={`${hub.name || 'Untitled'} · ${hub.baseUrl}`}
    >
      <p className="mb-4 text-muted">
        Re-read server.yaml and apply reloadable sections (database, Redis, LLM, and plugins)
        without restarting the Team Hub process. Changes to host or port require a restart and are
        not applied live.
      </p>

      {error ? (
        <p className="mb-4 text-danger" role="status">
          {error}
        </p>
      ) : null}

      <Button type="button" disabled={reloading} onClick={() => void handleReload()}>
        {reloading ? 'Reloading…' : 'Reload config'}
      </Button>
    </Page>
  );
}
