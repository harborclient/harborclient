import {
  Button,
  FaIcon,
  MethodSelect,
  VariableInput,
  fieldFrame
} from '@harborclient/sdk/components';
import type { JSX, KeyboardEvent } from 'react';
import type { HttpMethod, RequestProtocol, Variable } from '@harborclient/core/types';

import { faStop, faFloppyDisk } from '#/renderer/src/fontawesome';
import { usePluginRequestToolbarActions } from '#/renderer/src/plugins/pluginHooks';
import { urlSource } from '#/renderer/src/autocomplete/sources';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { focusResponseEditor } from '../../ResponseEditor/focusResponseEditor';
import { REQUEST_URL_INPUT_ID } from './focusRequestUrl';

interface Props {
  /**
   * HTTP method for the request.
   */
  method: HttpMethod;

  /**
   * Transport protocol (`http` or `sse`).
   */
  protocol: RequestProtocol;

  /**
   * Request URL.
   */
  url: string;

  /**
   * Collection-scoped variables for URL highlighting and tooltips.
   */
  variables: Variable[];

  /**
   * Whether a request is in flight or an SSE session is active.
   */
  sending: boolean;

  /**
   * Called when the HTTP method changes.
   */
  onMethodChange: (method: HttpMethod) => void;

  /**
   * Called when the transport protocol changes.
   */
  onProtocolChange: (protocol: RequestProtocol) => void;

  /**
   * Called when the URL changes.
   */
  onUrlChange: (url: string) => void;

  /**
   * Called when the user clicks Send / Connect.
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
   * Called when the user clicks the stop / Disconnect control.
   */
  onCancel: () => void;

  /**
   * Opens collection settings to edit variables.
   */
  onEditVariables?: (key: string) => void;
}

/**
 * Method selector, URL input, plugin toolbar actions, Send/Connect, and Save.
 */
export function UrlBar({
  method,
  protocol,
  url,
  variables,
  sending,
  onMethodChange,
  onProtocolChange,
  onUrlChange,
  onSend,
  onSave,
  savingRequest,
  saveDisabled,
  onCancel,
  onEditVariables
}: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const toolbarActions = usePluginRequestToolbarActions();
  const isSse = protocol === 'sse';

  /**
   * Whether Save is inactive; uses aria-disabled so the control stays in tab order.
   */
  const saveInactive = saveDisabled || savingRequest;

  /**
   * Primary action label for the Send / Connect button when idle.
   */
  const idleLabel = isSse ? 'Connect' : 'Send';

  /**
   * Accessible name while a request or SSE session is active.
   */
  const busyLabel = isSse ? 'Disconnect SSE stream' : 'Cancel request';

  /**
   * Moves keyboard focus into the response editor when Down is pressed on Send.
   *
   * Mirrors tab-bar ArrowDown navigation so Send is a spatial jump point into
   * the response panel without requiring Tab through every request editor control.
   *
   * @param event - Keyboard event from the Send / Connect button.
   */
  const handleSendKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (
      event.key !== 'ArrowDown' ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) {
      return;
    }

    event.preventDefault();
    focusResponseEditor(dispatch);
  };

  return (
    <div className="flex items-center gap-2">
      <div
        className={`request-url-bar flex h-[35px] min-w-0 flex-1 items-center ps-2 ${fieldFrame} rounded-md!`}
      >
        <MethodSelect
          value={method}
          protocol={protocol}
          onChange={onMethodChange}
          onProtocolChange={onProtocolChange}
          className="mt-0.5"
        />
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
        onKeyDown={handleSendKeyDown}
        aria-label={sending ? busyLabel : idleLabel}
        className="hc-send-button inline-flex min-h-[35px] w-24 shrink-0 items-center justify-center"
      >
        {sending ? (
          isSse ? (
            'Disconnect'
          ) : (
            <FaIcon icon={faStop} className="h-3.5 w-3.5" aria-hidden />
          )
        ) : (
          idleLabel
        )}
      </Button>
      <Button
        type="button"
        variant="secondary"
        aria-label={savingRequest ? 'Saving request' : 'Save request'}
        aria-disabled={saveInactive || undefined}
        aria-busy={savingRequest || undefined}
        onClick={() => {
          if (saveInactive) {
            return;
          }
          onSave();
        }}
        onKeyDown={(event) => {
          if (saveInactive && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
          }
        }}
        className={`hc-save-button inline-flex min-h-[35px] w-16 shrink-0 items-center justify-center${saveInactive ? ' cursor-not-allowed opacity-50' : ''}`}
      >
        <FaIcon icon={faFloppyDisk} className="h-3.5 w-3.5" aria-hidden />
      </Button>
    </div>
  );
}
