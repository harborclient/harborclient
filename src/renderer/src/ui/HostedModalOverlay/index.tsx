import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectHostedModal } from '#/renderer/src/store/slices/modalsSlice';
import { HostedSurface } from '#/renderer/src/plugins/HostedSurface';
import type { JSX } from 'react';

/**
 * Full-window overlay hosting an isolated plugin modal webview at the application root.
 *
 * Plugin code paints its own backdrop and centered panel inside the guest document so
 * modals are not clipped by tiny header-actions or sidebar webviews.
 */
export function HostedModalOverlay(): JSX.Element | null {
  const hostedModal = useAppSelector(selectHostedModal);

  if (!hostedModal) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[1000]" data-hosted-modal-overlay="" aria-hidden={false}>
      <HostedSurface
        pluginId={hostedModal.pluginId}
        contributionId={hostedModal.contributionId}
        kind="modals"
        context={hostedModal.context}
        resizeMode="fill"
        className="h-full w-full"
        style={{ height: '100%' }}
      />
    </div>
  );
}
