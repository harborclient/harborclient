import {
  Button,
  FaIcon,
  MethodSelect,
  VariableInput,
  fieldFrame
} from '@harborclient/sdk/components';
import type { JSX } from 'react';
import type { HttpMethod, Variable } from '#/shared/types';

import { faStop, faFloppyDisk } from '#/renderer/src/fontawesome';
import { usePluginRequestToolbarActions } from '#/renderer/src/plugins/pluginHooks';
import { urlSource } from '#/renderer/src/autocomplete/sources';
import { REQUEST_URL_INPUT_ID } from '#/renderer/src/ui/Main/RequestEditor/Editor/focusRequestUrl';

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
   * Whether a request is in flight; swaps Send for a stop icon when true.
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
   * Called when the user clicks Save.
   */
  onSave: () => void;

  /**
   * Whether a save is in flight; disables Save and shows progress text.
   */
  savingRequest: boolean;

  /**
   * When true, Save is disabled because there is nothing to persist.
   */
  saveDisabled: boolean;

  /**
   * Called when the user clicks the stop icon during an in-flight request.
   */
  onCancel: () => void;

  /**
   * Opens collection settings to edit variables.
   */
  onEditVariables?: (key: string) => void;
}

/**
 * Method selector, URL input, plugin toolbar actions, Save, and Send buttons.
 */
export function UrlBar({
  method,
  url,
  variables,
  sending,
  onMethodChange,
  onUrlChange,
  onSend,
  onSave,
  savingRequest,
  saveDisabled,
  onCancel,
  onEditVariables
}: Props): JSX.Element {
  const toolbarActions = usePluginRequestToolbarActions();

  return (
    <div className="flex items-center gap-2">
      <div
        className={`request-url-bar flex min-w-0 flex-1 items-center mb-1 ps-2 ${fieldFrame} rounded-full!`}
      >
        <MethodSelect value={method} onChange={onMethodChange} className="mt-0.5" />
        <div className="h-5 w-px shrink-0 bg-separator" />
        <VariableInput
          id={REQUEST_URL_INPUT_ID}
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
        type="button"
        onClick={() => (sending ? onCancel() : onSend())}
        aria-label={sending ? 'Cancel request' : undefined}
        className="hc-send-button inline-flex w-24 shrink-0 items-center justify-center"
      >
        {sending ? <FaIcon icon={faStop} className="h-3.5 w-3.5" aria-hidden /> : 'Send'}
      </Button>
      <Button
        type="button"
        variant="secondary"
        disabled={saveDisabled || savingRequest}
        onClick={onSave}
        className="inline-flex w-16 shrink-0 items-center justify-center"
      >
        <FaIcon icon={faFloppyDisk} className="h-3.5 w-3.5" aria-hidden />
      </Button>
    </div>
  );
}
