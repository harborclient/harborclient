import { useCallback, useState, type JSX } from 'react';
import { Button, FaIcon, Modal, ModalFooter, FieldError } from '@harborclient/sdk/components';
import type { PluginInfo } from '#/shared/plugin/types';
import { pluginIsTheme } from '#/shared/plugin/themeCategory';
import type { GeneralSettings } from '#/shared/types';

import { faCircleCheck } from '#/renderer/src/fontawesome';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { patchGeneralSettings } from '#/renderer/src/store/thunks/settings';
import { PERMISSION_LABELS } from './constants';

interface Props {
  /**
   * Newly installed plugin awaiting enable confirmation.
   */
  plugin: PluginInfo;

  /**
   * Enables the plugin and closes the dialog.
   */
  onConfirm: () => void;

  /**
   * Cancels enablement and removes the pending plugin.
   */
  onCancel: () => void;
}

/**
 * Returns whether install cannot continue until network access is configured.
 *
 * @param plugin - Newly installed plugin awaiting enable confirmation.
 * @param general - Current general settings from the renderer store.
 */
function pluginNeedsNetworkSetting(plugin: PluginInfo, general: GeneralSettings): boolean {
  if (!plugin.permissions.includes('network')) {
    return false;
  }
  if (general.allowScriptNetworkRequests) {
    return false;
  }
  return !general.allowedNetworkPlugins.includes(plugin.id);
}

/**
 * Post-install dialog listing requested permissions before enabling a plugin or theme.
 */
export function EnableModal({ plugin, onConfirm, onCancel }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const general = useAppSelector((state) => state.settings.general);
  const [busy, setBusy] = useState(false);
  const noun = pluginIsTheme(plugin) ? 'theme' : 'plugin';
  const needsNetworkChoice = pluginNeedsNetworkSetting(plugin, general);

  /**
   * Persists a general-settings patch, then completes enablement when the patch succeeds.
   */
  const handleEnableWithPatch = useCallback(
    async (patch: Partial<GeneralSettings>): Promise<void> => {
      setBusy(true);
      try {
        if (Object.keys(patch).length > 0) {
          await dispatch(patchGeneralSettings(patch)).unwrap();
        }
        onConfirm();
      } finally {
        setBusy(false);
      }
    },
    [dispatch, onConfirm]
  );

  /**
   * Adds the pending plugin to the per-plugin network allowlist and enables it.
   */
  const handleEnableForThisPlugin = useCallback((): void => {
    const allowed = general.allowedNetworkPlugins.includes(plugin.id)
      ? general.allowedNetworkPlugins
      : [...general.allowedNetworkPlugins, plugin.id];
    void handleEnableWithPatch({ allowedNetworkPlugins: allowed });
  }, [general.allowedNetworkPlugins, handleEnableWithPatch, plugin.id]);

  return (
    <Modal
      onClose={onCancel}
      labelledBy="plugin-permissions-title"
      title={`Enable ${plugin.name}?`}
      closeDisabled={busy}
      disableEscape={busy}
    >
      <p className="mb-3 text-[14px] text-text">
        Version {plugin.version} requests the following permissions:
      </p>
      {plugin.signature?.status === 'verified' ? (
        <p className="mb-3 flex items-center gap-2 text-[14px] text-text" role="status">
          <FaIcon icon={faCircleCheck} className="h-3.5 w-3.5 shrink-0 text-success" />
          Verified by {plugin.signature.author ?? plugin.manifest.author}
        </p>
      ) : null}
      {plugin.signature?.status === 'unsigned' ? (
        <FieldError spacing="section" className="mb-3 mt-0" roleAlert>
          This {noun} is not signed by a trusted publisher. Only enable it if you trust the source.
        </FieldError>
      ) : null}
      {needsNetworkChoice ? (
        <FieldError spacing="section" className="mb-3 mt-0" roleAlert>
          This {noun} needs outbound HTTP access, but <strong>Allow script network requests</strong>{' '}
          is turned off in Settings → General. Choose how to continue before enabling it.
        </FieldError>
      ) : null}
      <ul className="mb-4 list-disc pl-5 text-[14px] text-text">
        {plugin.permissions.map((permission) => (
          <li key={permission}>{PERMISSION_LABELS[permission] ?? permission}</li>
        ))}
      </ul>
      {needsNetworkChoice ? (
        <ModalFooter spaced>
          <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>
            Discontinue install
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={busy}
            onClick={() => void handleEnableWithPatch({ allowScriptNetworkRequests: true })}
          >
            Turn on script network requests
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={busy}
            onClick={handleEnableForThisPlugin}
          >
            Turn on for just this {noun}
          </Button>
        </ModalFooter>
      ) : (
        <ModalFooter>
          <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" disabled={busy} onClick={onConfirm}>
            {plugin.signature?.status === 'unsigned' ? 'Enable anyway' : `Enable ${noun}`}
          </Button>
        </ModalFooter>
      )}
    </Modal>
  );
}
