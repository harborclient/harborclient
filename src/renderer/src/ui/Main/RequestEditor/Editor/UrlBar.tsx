import { Button, MethodSelect, VariableInput, fieldFrame } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import type { HttpMethod, Variable } from '#/shared/types';

import { usePluginRequestToolbarActions } from '#/renderer/src/plugins/pluginHooks';
import { urlSource } from '#/renderer/src/autocomplete/sources';

interface Props {
  /**
   * HTTP method for the request.
   */
  method: HttpMethod;

  /**
   * Request URL.
   */
  url: string;

  /**
   * Collection-scoped variables for URL highlighting and tooltips.
   */
  variables: Variable[];

  /**
   * Disables Send while a request is in flight.
   */
  sending: boolean;

  /**
   * Called when the HTTP method changes.
   */
  onMethodChange: (method: HttpMethod) => void;

  /**
   * Called when the URL changes.
   */
  onUrlChange: (url: string) => void;

  /**
   * Called when the user clicks Send.
   */
  onSend: () => void;

  /**
   * Opens collection settings to edit variables.
   */
  onEditVariables?: () => void;
}

/**
 * Method selector, URL input, plugin toolbar actions, and Send button.
 */
export function UrlBar({
  method,
  url,
  variables,
  sending,
  onMethodChange,
  onUrlChange,
  onSend,
  onEditVariables
}: Props): JSX.Element {
  const toolbarActions = usePluginRequestToolbarActions();

  return (
    <div className="flex items-center gap-2">
      <div className={`flex min-w-0 flex-1 items-center ${fieldFrame}`}>
        <MethodSelect value={method} onChange={onMethodChange} />
        <div className="h-5 w-px shrink-0 bg-separator" />
        <VariableInput
          className="app-no-drag"
          value={url}
          onChange={onUrlChange}
          variables={variables}
          source={urlSource}
          placeholder="Enter request URL"
          aria-label="Request URL"
          onEditVariable={onEditVariables}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSend();
          }}
        />
      </div>
      {toolbarActions.map((action) => (
        <Button
          key={`${action.pluginId}:${action.id}`}
          type="button"
          variant="secondary"
          title={action.title}
          aria-label={action.title}
          onClick={() => void window.api.executePluginAgentCommand(action.pluginId, action.command)}
        >
          {action.title}
        </Button>
      ))}
      <Button
        onClick={onSend}
        disabled={sending}
        className="inline-flex w-24 shrink-0 items-center justify-center rounded-full!"
      >
        {sending ? 'Sending…' : 'Send'}
      </Button>
    </div>
  );
}
