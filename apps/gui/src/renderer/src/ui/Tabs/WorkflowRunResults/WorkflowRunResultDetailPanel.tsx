import { useCallback, useId, useMemo, useRef, type JSX } from 'react';
import type { ResponseTabContext } from '@harborclient/core/plugin/types';
import type { WorkflowAction, WorkflowRunActionResult } from '@harborclient/core/types';
import { defaultAuth } from '@harborclient/core/auth';
import { CodeEditor, ResizeHandle, RoundButton, useResizable } from '@harborclient/sdk/components';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import {
  pluginRequestKey,
  toPluginHttpResponse,
  toPluginRequestDraft
} from '#/renderer/src/plugins/pluginContextAdapters';
import { ResponseEditor } from '#/renderer/src/ui/Main/ResponseEditor';
import { isWorkflowRunRequestResult } from '#/renderer/src/workflows/isWorkflowRunRequestResult';
import { workflowRunRequestResultToEditorModel } from '#/renderer/src/workflows/workflowRunRequestResultToSendResult';

/** Default detail panel height in pixels. */
const DEFAULT_PANEL_HEIGHT = 320;

/** Minimum detail panel height in pixels. */
const MIN_PANEL_HEIGHT = 160;

/** localStorage key for the Results detail panel height. */
const PANEL_STORAGE_KEY = 'workflow-run-results-detail-height';

interface Props {
  /**
   * Workflow action for the selected Results row, or null when closed.
   */
  action: WorkflowAction | null;

  /**
   * Run-log result for the selected row, or null when closed.
   */
  result: WorkflowRunActionResult | null;

  /**
   * Closes the detail panel.
   */
  onClose: () => void;
}

/**
 * Reads a display title from an action result when it has a string `name`.
 *
 * @param result - Action result payload.
 * @returns Result name, or a generic fallback.
 */
function actionResultTitle(result: unknown): string {
  if (result != null && typeof result === 'object' && 'name' in result) {
    const name = (result as { name?: unknown }).name;
    if (typeof name === 'string' && name.trim().length > 0) {
      return name;
    }
  }
  return 'Action result';
}

/**
 * Bottom detail panel for a selected workflow-run Results row.
 *
 * Request sends embed {@link ResponseEditor}; other actions show read-only JSON.
 * Height is persisted via {@link useResizable} with a horizontal resize handle.
 *
 * @param props - Selected action/result and close handler.
 * @returns Resizable bottom panel, or null when closed.
 */
export function WorkflowRunResultDetailPanel({
  action,
  result,
  onClose
}: Props): JSX.Element | null {
  const panelRef = useRef<HTMLElement | null>(null);
  const editorId = useId();
  const titleId = 'workflow-run-result-detail-title';

  /**
   * Caps panel height so it cannot consume the entire Results tab.
   */
  const getMaxPanelHeight = useCallback((): number => {
    const parent = panelRef.current?.parentElement;
    if (parent == null) {
      return window.innerHeight * 0.8;
    }
    return Math.max(MIN_PANEL_HEIGHT, parent.clientHeight - 120);
  }, []);

  const {
    size: panelHeight,
    minSize: panelMinSize,
    maxSize: panelMaxSize,
    onResizeStart,
    onKeyboardResize
  } = useResizable({
    axis: 'y',
    direction: -1,
    defaultSize: DEFAULT_PANEL_HEIGHT,
    minSize: MIN_PANEL_HEIGHT,
    getMaxSize: getMaxPanelHeight,
    storageKey: PANEL_STORAGE_KEY
  });

  /**
   * True when the selection is a request.send snapshot suitable for ResponseEditor.
   */
  const requestResult =
    action?.type === 'request.send' && isWorkflowRunRequestResult(result) ? result : null;

  /**
   * Response Editor model mapped from the portable request result.
   */
  const editorModel = useMemo(() => {
    if (requestResult == null) {
      return null;
    }
    return workflowRunRequestResultToEditorModel(requestResult);
  }, [requestResult]);

  /**
   * Read-only plugin context for response tabs inside the Results panel.
   */
  const responseTabContext = useMemo((): ResponseTabContext => {
    const draft = {
      id: undefined as number | undefined,
      name: requestResult?.name ?? 'Request',
      method: requestResult?.method ?? ('GET' as const),
      url: requestResult?.url ?? '',
      headers: [],
      params: [],
      auth: defaultAuth(),
      userAgent: '',
      body: '',
      body_type: 'none' as const,
      body_raw: null,
      body_raw_open: false,
      pre_request_script: '',
      post_request_script: '',
      pre_request_scripts: [],
      post_request_scripts: [],
      comment: '',
      tags: ''
    };

    return {
      draft: toPluginRequestDraft(draft),
      response: toPluginHttpResponse(editorModel?.response ?? null),
      requestKey: pluginRequestKey(draft)
    };
  }, [requestResult, editorModel]);

  /**
   * Pretty-printed JSON for non-request action results.
   */
  const jsonDraft = useMemo(
    () => (result == null ? '' : JSON.stringify(result, null, 2)),
    [result]
  );

  /**
   * No-op change handler; the JSON editor is read-only.
   */
  const handleJsonChange = useCallback((): void => {}, []);

  if (action == null || result == null) {
    return null;
  }

  const jsonTitle = actionResultTitle(result);

  return (
    <>
      <ResizeHandle
        orientation="horizontal"
        value={panelHeight}
        min={panelMinSize}
        max={panelMaxSize}
        onResizeStart={onResizeStart}
        onKeyboardResize={onKeyboardResize}
        ariaLabel="Resize workflow result detail panel"
      />
      <section
        ref={panelRef}
        style={{ height: panelHeight }}
        className="flex min-h-0 shrink-0 flex-col overflow-hidden border-t border-separator bg-surface"
        role="region"
        aria-label={
          requestResult != null ? `Response for ${requestResult.name}` : `Result for ${jsonTitle}`
        }
      >
        {editorModel != null && requestResult != null ? (
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <ResponseEditor
              key={`${requestResult.uuid}-${requestResult.url}-${requestResult.response.status}`}
              response={editorModel.response}
              responseTabContext={responseTabContext}
              sending={false}
              testResults={editorModel.testResults}
              scriptLogs={editorModel.scriptLogs}
              executionEvents={editorModel.executionEvents}
              scriptError={editorModel.scriptError}
              scriptErrors={editorModel.scriptErrors}
              requestUrl={editorModel.requestUrl}
              onCancel={() => {}}
              onClear={onClose}
              onClose={onClose}
            />
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden p-3">
            <div className="flex shrink-0 items-center justify-between gap-2">
              <h2 id={titleId} className="m-0 truncate text-[18px] font-semibold">
                {jsonTitle}
              </h2>
              <RoundButton icon={faXmark} ariaLabel="Close action result panel" onClick={onClose} />
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <CodeEditor
                id={editorId}
                value={jsonDraft}
                onChange={handleJsonChange}
                language="json"
                readOnly
                minHeight="100%"
                aria-label="Workflow action result JSON"
                aria-labelledby={titleId}
              />
            </div>
          </div>
        )}
      </section>
    </>
  );
}
