import {
  FormDataEditor,
  FormGroup,
  KeyValueEditor,
  CodeEditor,
  Radio,
  COPY_TO_CHAT_SHORTCUT_CODEMIRROR_KEY
} from '@harborclient/sdk/components';
import type { CodeEditorTextSelection } from '@harborclient/sdk/components';
import { useCallback, useEffect, useId, useMemo, useState, type JSX } from 'react';
import type { BodyType, FormDataPart, KeyValue, Variable } from '@harborclient/core/types';
import { parseFormParts, serializeFormParts } from '@harborclient/core/formData';
import { parseUrlEncodedParts, serializeUrlEncodedParts } from '@harborclient/core/urlencoded';
import {
  generateMultipartBoundary,
  parseMultipartRaw,
  renderMultipartRaw
} from '@harborclient/core/multipartRaw';
import { rawUrlEncodedToRows, rowsToRawUrlEncoded } from '@harborclient/core/urlencodedRaw';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { useAiAvailability } from '#/renderer/src/hooks/useAiAvailability';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectActiveChatId,
  setPendingComposerText
} from '#/renderer/src/store/slices/aiChatSlice';
import { setRequestBodySelection } from '#/renderer/src/store/slices/requestBodySelectionsSlice';
import { setShowAiSidebar } from '#/renderer/src/store/slices/navigationSlice';
import { createNewChat } from '#/renderer/src/store/thunks/aiChat';
import { formatBody } from '#/renderer/src/ui/Shared/responseFormatUtils';
import { lineNumberAtOffset } from './markdownSelection';
import {
  buildRequestBodyReferenceToken,
  requestBodySelectionLabel,
  requestBodySelectionSourceText
} from './bodySelection';

import type { RequestDraft } from '#/renderer/src/store/tabs';
import { emptyKeyValue } from '#/renderer/src/store/tabs';
import { urlencodedKeySource, urlencodedValueSource } from '#/renderer/src/autocomplete/sources';
import { RawBodyDrawer } from './RawBodyDrawer';

const BODY_TYPE_OPTIONS: { value: BodyType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'json', label: 'JSON' },
  { value: 'text', label: 'Text' },
  { value: 'multipart', label: 'Multipart Form' },
  { value: 'urlencoded', label: 'Form URL Encoded' }
];

interface Props {
  /**
   * Content type of the request body.
   */
  bodyType: BodyType;

  /**
   * Structured request body content (JSON parts/rows for multipart/urlencoded).
   */
  body: string;

  /**
   * Verbatim Raw body override; null when structured rows are authoritative.
   */
  bodyRaw: string | null;

  /**
   * Whether the Raw body drawer is expanded.
   */
  bodyRawOpen: boolean;

  /**
   * Merges a partial update into the current draft.
   */
  update: (patch: Partial<RequestDraft>) => void;

  /**
   * Collection-scoped variables for highlighting and tooltips.
   */
  variables: Variable[];

  /**
   * Opens collection settings to edit variables.
   */
  onEditVariables?: (key: string) => void;
}

/**
 * Body type selector and editor for JSON, text, multipart, and urlencoded bodies.
 *
 * Multipart and urlencoded include a Raw body drawer with best-effort two-way sync.
 * When the user edits Raw text, `body_raw` becomes authoritative for sending (including
 * intentionally invalid bodies). Editing the structured rows clears the override.
 */
export function BodyEditor({
  bodyType,
  body,
  bodyRaw,
  bodyRawOpen,
  update,
  variables,
  onEditVariables
}: Props): JSX.Element {
  const confirm = useConfirm();
  const dispatch = useAppDispatch();
  const { aiAvailable, aiSettings } = useAiAvailability();
  const activeChatId = useAppSelector(selectActiveChatId);
  const bodyTypeGroupName = useId();
  const overrideActive = bodyRaw != null;

  /**
   * Stable multipart boundary for projecting structured parts into Raw text while no
   * override is active. Regenerated when the structured body changes so Content-Type
   * and body stay coherent for the projection (not the wire until send).
   */
  const [multipartBoundary, setMultipartBoundary] = useState(() => generateMultipartBoundary());

  const urlEncodedRows = bodyType === 'urlencoded' ? parseUrlEncodedParts(body) : [];
  const multipartParts = bodyType === 'multipart' ? parseFormParts(body) : [];

  /**
   * Whether the active raw override cleanly maps to structured rows.
   * When false, the table is dimmed because Raw is authoritative and unparseable.
   */
  const rawRepresentable = useMemo((): boolean => {
    if (bodyRaw == null) {
      return true;
    }
    if (bodyType === 'multipart') {
      return parseMultipartRaw(bodyRaw).representable;
    }
    return true;
  }, [bodyRaw, bodyType]);

  /**
   * Derives the Raw editor value: active override text, or a projection from rows.
   */
  const projectedRaw = useMemo((): string => {
    if (bodyRaw != null) {
      return bodyRaw;
    }
    if (bodyType === 'urlencoded') {
      return rowsToRawUrlEncoded(parseUrlEncodedParts(body));
    }
    if (bodyType === 'multipart') {
      return renderMultipartRaw(parseFormParts(body), multipartBoundary);
    }
    return '';
  }, [bodyRaw, bodyType, body, multipartBoundary]);

  /**
   * Stable body change handler for JSON/text CodeEditor onChange.
   */
  const handleBodyChange = useCallback(
    (nextBody: string): void => {
      update({ body: nextBody });
    },
    [update]
  );

  /**
   * Pretty-prints the JSON body when the user chooses Format from the native
   * context menu. Invalid JSON is left unchanged.
   */
  useEffect(() => {
    if (bodyType !== 'json') {
      return;
    }

    const unsubscribe = window.api.onMenuAction((action) => {
      if (action !== 'format-json-body') {
        return;
      }

      const formatted = formatBody(body);
      if (formatted === body) {
        return;
      }

      update({ body: formatted });
    });

    return unsubscribe;
  }, [body, bodyType, update]);

  /**
   * Updates structured urlencoded rows and clears any raw override.
   */
  const handleUrlEncodedRowsChange = useCallback(
    (rows: KeyValue[]): void => {
      update({ body: serializeUrlEncodedParts(rows), body_raw: null });
    },
    [update]
  );

  /**
   * Updates structured multipart parts and clears any raw override.
   */
  const handleMultipartPartsChange = useCallback(
    (parts: FormDataPart[]): void => {
      setMultipartBoundary(generateMultipartBoundary());
      update({ body: serializeFormParts(parts), body_raw: null });
    },
    [update]
  );

  /**
   * Activates the raw override and best-effort refreshes structured rows from the text.
   */
  const handleRawChange = useCallback(
    (text: string): void => {
      if (bodyType === 'urlencoded') {
        const rows = rawUrlEncodedToRows(text);
        update({
          body_raw: text,
          body: serializeUrlEncodedParts(rows.length ? rows : [emptyKeyValue()])
        });
        return;
      }

      if (bodyType === 'multipart') {
        const parsed = parseMultipartRaw(text);
        update({
          body_raw: text,
          body: serializeFormParts(parsed.parts)
        });
      }
    },
    [bodyType, update]
  );

  /**
   * Toggles the Raw drawer open state on the draft.
   */
  const handleToggleRaw = useCallback((): void => {
    update({ body_raw_open: !bodyRawOpen });
  }, [bodyRawOpen, update]);

  /**
   * Confirms discarding the raw override and restores the structured projection.
   */
  const handleResetFromRows = useCallback(async (): Promise<void> => {
    const confirmed = await confirm({
      title: 'Reset raw body?',
      message:
        'This discards the raw body override and restores the text projected from the structured rows.',
      confirmLabel: 'Reset',
      cancelLabel: 'Cancel'
    });
    if (!confirmed) {
      return;
    }
    if (bodyType === 'multipart') {
      setMultipartBoundary(generateMultipartBoundary());
    }
    update({ body_raw: null });
  }, [bodyType, confirm, update]);

  /**
   * Switches body type and clears raw override state that would not apply.
   */
  const handleBodyTypeChange = useCallback(
    (nextType: BodyType): void => {
      if (nextType === 'multipart') {
        setMultipartBoundary(generateMultipartBoundary());
      }
      update({
        body_type: nextType,
        body_raw: null,
        body_raw_open: nextType === 'multipart' || nextType === 'urlencoded' ? bodyRawOpen : false
      });
    },
    [bodyRawOpen, update]
  );

  /**
   * Opens the AI sidebar and inserts an `@body` reference for the selected body text.
   *
   * @param selection - Selected text and character offsets from the body CodeEditor.
   */
  const handleCopySelectionToChat = useCallback(
    async (selection: CodeEditorTextSelection): Promise<void> => {
      if (selection.from >= selection.to || selection.text.length === 0) {
        return;
      }

      const token = buildRequestBodyReferenceToken(selection.from, selection.to);
      const label = requestBodySelectionLabel(bodyType);
      const sourceText = requestBodySelectionSourceText(bodyType, body, projectedRaw);

      dispatch(
        setRequestBodySelection({
          token,
          snapshot: {
            label,
            selectedText: selection.text,
            startOffset: selection.from,
            endOffset: selection.to,
            startLine: lineNumberAtOffset(sourceText, selection.from),
            endLine: lineNumberAtOffset(sourceText, Math.max(selection.from, selection.to - 1))
          }
        })
      );
      dispatch(setShowAiSidebar(true));
      if (activeChatId == null) {
        await dispatch(createNewChat(aiSettings));
      }
      dispatch(setPendingComposerText(token));
    },
    [activeChatId, aiSettings, body, bodyType, dispatch, projectedRaw]
  );

  /**
   * Selection toolbar actions for body CodeEditors when AI chat is available.
   */
  const copyToChatSelectionActions = useMemo(
    () =>
      aiAvailable
        ? [
            {
              id: 'copy-to-chat',
              ariaLabel: `Copy selection from ${requestBodySelectionLabel(bodyType)} to chat`,
              key: COPY_TO_CHAT_SHORTCUT_CODEMIRROR_KEY,
              onSelect: (selection: CodeEditorTextSelection): void => {
                void handleCopySelectionToChat(selection);
              }
            }
          ]
        : undefined,
    [aiAvailable, bodyType, handleCopySelectionToChat]
  );

  const lockStructuredRows = overrideActive && !rawRepresentable;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="-mx-4 mb-3 flex shrink-0 flex-wrap items-center gap-x-8 gap-y-1 border-b border-separator px-4 pb-3">
        <span className="text-muted ms-4">Body type</span>
        {BODY_TYPE_OPTIONS.map(({ value, label }) => (
          <FormGroup key={value} label={label} layout="radio">
            <Radio
              name={bodyTypeGroupName}
              className="app-no-drag"
              checked={bodyType === value}
              onChange={() => handleBodyTypeChange(value)}
            />
          </FormGroup>
        ))}
      </div>
      {bodyType === 'urlencoded' && (
        <>
          <div
            className={lockStructuredRows ? 'pointer-events-none mb-2 opacity-60' : 'mb-2'}
            aria-disabled={lockStructuredRows || undefined}
          >
            <KeyValueEditor
              rows={urlEncodedRows.length ? urlEncodedRows : [emptyKeyValue()]}
              onChange={handleUrlEncodedRowsChange}
              placeholderKey="key"
              placeholderValue="value"
              variables={variables}
              onEditVariable={onEditVariables}
              keySource={urlencodedKeySource}
              valueSource={urlencodedValueSource}
            />
          </div>
          <RawBodyDrawer
            value={projectedRaw}
            onChange={handleRawChange}
            open={bodyRawOpen}
            onToggle={handleToggleRaw}
            overrideActive={overrideActive}
            nonRepresentable={!rawRepresentable}
            onResetFromRows={() => {
              void handleResetFromRows();
            }}
            variables={variables}
            onEditVariable={onEditVariables}
            selectionActions={copyToChatSelectionActions}
          />
        </>
      )}
      {bodyType === 'multipart' && (
        <>
          <div
            className={lockStructuredRows ? 'pointer-events-none mb-2 opacity-60' : 'mb-2'}
            aria-disabled={lockStructuredRows || undefined}
          >
            <FormDataEditor
              parts={multipartParts}
              onChange={handleMultipartPartsChange}
              variables={variables}
              onSelectFiles={window.api.selectFiles}
              onEditVariable={onEditVariables}
            />
          </div>
          <RawBodyDrawer
            value={projectedRaw}
            onChange={handleRawChange}
            open={bodyRawOpen}
            onToggle={handleToggleRaw}
            overrideActive={overrideActive}
            nonRepresentable={!rawRepresentable}
            onResetFromRows={() => {
              void handleResetFromRows();
            }}
            variables={variables}
            onEditVariable={onEditVariables}
            selectionActions={copyToChatSelectionActions}
          />
        </>
      )}
      {bodyType !== 'none' && bodyType !== 'multipart' && bodyType !== 'urlencoded' && (
        <div className="flex min-h-0 flex-1 flex-col">
          <CodeEditor
            value={body}
            onChange={handleBodyChange}
            language={bodyType === 'json' ? 'json' : 'text'}
            placeholder={bodyType === 'json' ? '{\n  "key": "value"\n}' : 'Request body'}
            variables={variables}
            onEditVariable={onEditVariables}
            minHeight="0"
            className="request-body-editor"
            aria-label={bodyType === 'json' ? 'JSON body' : 'Text body'}
            selectionActions={copyToChatSelectionActions}
            {...(bodyType === 'json' ? { 'data-json-body-editor': '' } : {})}
          />
        </div>
      )}
    </div>
  );
}
