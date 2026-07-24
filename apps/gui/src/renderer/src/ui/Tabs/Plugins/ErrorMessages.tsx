import type { JSX } from 'react';
import type { PluginInfo } from '#/shared/plugin/types';

interface Props {
  /**
   * Plugin whose manifest or runtime errors should be shown.
   */
  plugin: PluginInfo;
}

/**
 * Renders manifest load errors and runtime activation/hook failures for one plugin.
 */
export function ErrorMessages({ plugin }: Props): JSX.Element | null {
  if (!plugin.error && !plugin.runtimeError) {
    return null;
  }

  return (
    <div className="mt-1 space-y-1">
      {plugin.error ? (
        <p className="m-0 text-[14px] text-danger" role="alert">
          <span className="font-medium">Load error:</span> {plugin.error}
        </p>
      ) : null}
      {plugin.runtimeError ? (
        <p className="m-0 text-[14px] text-danger" role="alert">
          <span className="font-medium">Runtime error:</span> {plugin.runtimeError}
        </p>
      ) : null}
    </div>
  );
}
