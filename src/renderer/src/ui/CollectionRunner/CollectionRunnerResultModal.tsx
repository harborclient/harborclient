import { useMemo, type JSX } from 'react';
import type { ResponseTabContext } from '#/shared/plugin/types';
import type { CollectionRunnerRequestResult } from '#/shared/collectionRunner';
import { defaultAuth } from '#/shared/auth';
import {
  pluginRequestKey,
  toPluginHttpResponse,
  toPluginRequestDraft
} from '#/renderer/src/plugins/pluginContextAdapters';
import { ResponseEditor } from '#/renderer/src/ui/Main/ResponseEditor';
import { Modal } from '@harborclient/sdk/components';

interface Props {
  /**
   * Runner result row to inspect, or null when the modal is closed.
   */
  result: CollectionRunnerRequestResult | null;

  /**
   * Closes the response detail modal.
   */
  onClose: () => void;
}

/**
 * Modal that embeds the response editor for a completed collection runner request.
 */
export function CollectionRunnerResultModal({ result, onClose }: Props): JSX.Element | null {
  /**
   * Read-only plugin context for response tabs inside the runner result modal.
   */
  const responseTabContext = useMemo((): ResponseTabContext => {
    const draft = {
      id: result?.requestId,
      name: result?.requestName ?? 'Request',
      method: 'GET' as const,
      url: result?.requestUrl ?? '',
      headers: [],
      params: [],
      auth: defaultAuth(),
      body: '',
      body_type: 'none' as const,
      pre_request_script: '',
      post_request_script: '',
      pre_request_scripts: [],
      post_request_scripts: [],
      comment: '',
      tags: ''
    };

    return {
      draft: toPluginRequestDraft(draft),
      response: toPluginHttpResponse(result?.response ?? null),
      requestKey: pluginRequestKey(draft)
    };
  }, [result]);

  if (!result?.response) {
    return null;
  }

  return (
    <Modal
      onClose={onClose}
      className="flex h-[70vh] w-[80vw] max-w-[calc(100vw-2rem)] flex-col"
      labelledBy="collection-runner-result-modal-title"
      title={result.requestName}
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden -mt-4">
        <ResponseEditor
          key={result.requestId}
          response={result.response}
          responseTabContext={responseTabContext}
          sending={false}
          testResults={result.testResults ?? []}
          scriptLogs={result.scriptLogs ?? []}
          scriptError={result.scriptError}
          requestUrl={result.requestUrl ?? ''}
          onCancel={() => {}}
        />
      </div>
    </Modal>
  );
}
