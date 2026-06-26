import type { JSX } from 'react';
import { OverlayCloseButton } from '#/renderer/src/components/OverlayCloseButton';
import { Button } from '#/renderer/src/components/Button';
import { usePluginMainViews } from '#/renderer/src/plugins/pluginHooks';
import { pluginContributionId } from '#/shared/plugin/types';

interface Props {
  /**
   * Plugin manifest id for the active overlay.
   */
  pluginId: string;

  /**
   * Contribution id declared in manifest.contributes.mainViews.
   */
  viewId: string;

  /**
   * Closes the plugin main view overlay.
   */
  onClose: () => void;
}

/**
 * Renders one plugin-contributed full main-area overlay.
 */
export function PluginMainView({ pluginId, viewId, onClose }: Props): JSX.Element | null {
  const views = usePluginMainViews();
  const namespacedId = pluginContributionId(pluginId, viewId);
  const view = views.find((entry) => entry.pluginId === pluginId && entry.id === namespacedId);
  if (!view) {
    return (
      <div className="flex min-h-0 flex-1 flex-col p-6">
        <p className="text-muted">Plugin view is unavailable.</p>
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  const Component = view.Component;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-separator px-6 py-4">
        <h1 className="m-0 text-[15px] font-semibold text-text">{view.title}</h1>
        <OverlayCloseButton label="Close plugin view" onClose={onClose} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <Component />
      </div>
    </div>
  );
}
