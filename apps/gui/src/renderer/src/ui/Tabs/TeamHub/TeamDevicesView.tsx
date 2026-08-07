import {
  AsyncListState,
  Button,
  Page,
  ResourceList,
  ResourceListPrimary,
  ResourceListRow
} from '@harborclient/sdk/components';
import type { JSX } from 'react';
import type { HubDeviceKeyRecord, TeamHub } from '@harborclient/core/types';
import { useMemo } from 'react';
import { faLock } from '#/renderer/src/fontawesome';
import { useTeamHubDevices } from '#/renderer/src/hooks/useTeamHubDevices';
import { useTeamHubUsers } from '#/renderer/src/hooks/useTeamHubUsers';
import { useTypedDeleteConfirm } from '#/renderer/src/hooks/useTypedDeleteConfirm';
import { DeleteConfirmModal } from '#/renderer/src/ui/Shared/DeleteConfirm/DeleteConfirmModal';
import { toolbarDangerButtonClass } from '#/renderer/src/ui/Shared/classes';

interface Props {
  /**
   * Admin team hub connection whose device keys are being managed.
   */
  hub: TeamHub;
}

/**
 * Formats an optional ISO timestamp for display.
 *
 * @param value - Timestamp string or null when unset.
 * @returns Formatted timestamp or a dash placeholder.
 */
function formatOptionalTimestamp(value: string | null): string {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString();
}

/**
 * Team Hub device key administration view for E2EE enrollment records.
 */
export function TeamDevicesView({ hub }: Props): JSX.Element {
  const { devices, loading, error, reload } = useTeamHubDevices(hub.id);
  const { users } = useTeamHubUsers(hub.id);
  const userNamesById = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of users) {
      map.set(user.id, user.name);
    }
    return map;
  }, [users]);

  const revokeDevice = useTypedDeleteConfirm<HubDeviceKeyRecord>({
    onDelete: (device) => window.api.revokeTeamHubDeviceKey(hub.id, device.id),
    onSuccess: reload,
    successMessage: 'Device revoked.'
  });

  return (
    <Page
      embedded
      title="Devices"
      icon={faLock}
      description={`${hub.name || 'Untitled'} · ${hub.baseUrl}`}
    >
      <p className="mb-4 text-muted">
        Revoking a device key prevents that device from participating in encrypted discussions. Lost
        private keys cannot be recovered from the server; another authorized device must re-add the
        user in a later MLS release.
      </p>

      <AsyncListState
        loading={loading}
        error={error}
        onRetry={reload}
        isEmpty={devices.length === 0}
        emptyMessage="No enrolled devices found."
      >
        <ResourceList>
          {devices.map((device) => (
            <ResourceListRow
              key={device.id}
              primary={
                <div className="flex min-w-0 items-center gap-2">
                  <ResourceListPrimary>{device.label || 'Untitled device'}</ResourceListPrimary>
                  <span className="truncate font-mono text-[14px] text-muted">
                    {device.fingerprintPrefix}
                  </span>
                  {device.revokedAt ? (
                    <span className="text-[14px] text-muted">Revoked</span>
                  ) : null}
                </div>
              }
              secondary={userNamesById.get(device.userId) ?? device.userId}
              meta={
                <span className="block truncate text-[14px] text-muted">
                  Enrolled {formatOptionalTimestamp(device.createdAt)}
                  {device.lastSeenAt
                    ? ` · Last seen ${formatOptionalTimestamp(device.lastSeenAt)}`
                    : ''}
                </span>
              }
              actions={
                device.revokedAt ? null : (
                  <Button
                    type="button"
                    variant="toolbar"
                    className={toolbarDangerButtonClass}
                    onClick={() => revokeDevice.open(device)}
                  >
                    Revoke
                  </Button>
                )
              }
            />
          ))}
        </ResourceList>
      </AsyncListState>

      {revokeDevice.target ? (
        <DeleteConfirmModal
          title="Revoke device?"
          description={
            <>
              This revokes &ldquo;{revokeDevice.target.label || 'Untitled device'}&rdquo; (
              {revokeDevice.target.fingerprintPrefix}). The device cannot decrypt future encrypted
              comments after revocation.
            </>
          }
          busy={revokeDevice.busy}
          error={revokeDevice.error}
          onConfirm={() => void revokeDevice.confirm()}
          onClose={revokeDevice.close}
        />
      ) : null}
    </Page>
  );
}
