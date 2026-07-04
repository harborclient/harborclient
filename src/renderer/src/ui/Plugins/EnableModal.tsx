import { Button, FaIcon, Modal, ModalFooter, FieldError } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import type { PluginInfo } from '#/shared/plugin/types';
import { pluginIsTheme } from '#/shared/plugin/themeCategory';

import { faCircleCheck } from '#/renderer/src/fontawesome';
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
 * Post-install dialog listing requested permissions before enabling a plugin or theme.
 */
export function EnableModal({ plugin, onConfirm, onCancel }: Props): JSX.Element {
  const noun = pluginIsTheme(plugin) ? 'theme' : 'plugin';

  return (
    <Modal
      onClose={onCancel}
      labelledBy="plugin-permissions-title"
      title={`Enable ${plugin.name}?`}
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
      <ul className="mb-4 list-disc pl-5 text-[14px] text-text">
        {plugin.permissions.map((permission) => (
          <li key={permission}>{PERMISSION_LABELS[permission] ?? permission}</li>
        ))}
      </ul>
      <ModalFooter>
        <Button type="button" onClick={onConfirm}>
          {plugin.signature?.status === 'unsigned' ? 'Enable anyway' : `Enable ${noun}`}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
