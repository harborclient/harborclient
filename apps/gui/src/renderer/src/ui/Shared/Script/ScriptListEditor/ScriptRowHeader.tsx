import { FaIcon, Input } from '@harborclient/sdk/components';
import { useEffect, useRef, useState, type JSX } from 'react';
import type { ScriptRef, Snippet } from '#/shared/types';
import { readScriptRefStage, scriptRowStageSuffix } from '#/shared/scriptStage';
import { faCode } from '#/renderer/src/fontawesome';
import {
  SCRIPT_ROW_SNIPPET_LINK_ICON_CLASS,
  SCRIPT_ROW_TITLE_CLASS,
  SNIPPET_LIBRARY_LABEL
} from './constants';
import { scriptRowLabel, scriptRowPlaceholder, stopDragPointerDown } from './helpers';

interface Props {
  /**
   * Script reference rendered in the row header.
   */
  script: ScriptRef;

  /**
   * Snippet library used for default snippet labels.
   */
  snippets: Snippet[];

  /**
   * Called when the enable checkbox toggles.
   */
  onEnabledChange: (enabled: boolean) => void;

  /**
   * Called when the optional display name changes.
   */
  onNameChange: (name: string) => void;
}

/**
 * Enable checkbox and inline-editable script label for one script row.
 */
export function ScriptRowHeader({
  script,
  snippets,
  onEnabledChange,
  onNameChange
}: Props): JSX.Element {
  const [editingLabel, setEditingLabel] = useState(false);
  const labelInputRef = useRef<HTMLInputElement>(null);
  const accessibleLabel = scriptRowLabel(script, snippets);
  const placeholderLabel = scriptRowPlaceholder(script, snippets);
  const stageSuffix = scriptRowStageSuffix(readScriptRefStage(script));
  const isSnippetLinked = script.kind === 'snippet';
  const ariaLabelSuffix = isSnippetLinked ? ' (linked to snippet)' : '';
  const snippetLinkIcon = isSnippetLinked ? (
    <span
      role="img"
      aria-label={SNIPPET_LIBRARY_LABEL}
      title={SNIPPET_LIBRARY_LABEL}
      className="inline-flex shrink-0"
    >
      <FaIcon icon={faCode} className={SCRIPT_ROW_SNIPPET_LINK_ICON_CLASS} aria-hidden />
    </span>
  ) : null;

  /**
   * Focuses and selects the label input when inline edit mode opens.
   */
  useEffect(() => {
    if (editingLabel) {
      labelInputRef.current?.focus();
      labelInputRef.current?.select();
    }
  }, [editingLabel]);

  const titleControl = editingLabel ? (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <Input
        ref={labelInputRef}
        variant="plain"
        className={`min-w-0 flex-1 border-none bg-transparent p-0 ${SCRIPT_ROW_TITLE_CLASS} outline-none app-no-drag`}
        type="text"
        value={script.name ?? ''}
        onChange={(event) => onNameChange(event.target.value)}
        onBlur={() => setEditingLabel(false)}
        onPointerDown={stopDragPointerDown}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === 'Escape') {
            event.preventDefault();
            setEditingLabel(false);
          }
        }}
        aria-label={`Rename ${accessibleLabel}${ariaLabelSuffix}`}
        placeholder={placeholderLabel}
      />
      {stageSuffix ? (
        <span className="shrink-0" aria-hidden>
          {stageSuffix}
        </span>
      ) : null}
      {snippetLinkIcon}
    </div>
  ) : (
    <button
      type="button"
      className={`flex min-w-0 flex-1 cursor-text items-center gap-1 border-none bg-transparent p-0 text-left ${SCRIPT_ROW_TITLE_CLASS} hover:opacity-80 app-no-drag`}
      aria-label={`Rename ${accessibleLabel}${ariaLabelSuffix}`}
      onClick={() => setEditingLabel(true)}
      onPointerDown={stopDragPointerDown}
    >
      {script.name?.trim() ? (
        <span className="min-w-0 truncate">
          {script.name.trim()}
          {stageSuffix}
        </span>
      ) : (
        <span className="min-w-0 truncate text-muted">
          {placeholderLabel}
          {stageSuffix}
        </span>
      )}
      {snippetLinkIcon}
    </button>
  );

  return (
    <div className={`flex min-w-0 flex-1 items-center gap-2 ${SCRIPT_ROW_TITLE_CLASS}`}>
      <input
        type="checkbox"
        checked={script.enabled}
        onChange={(event) => onEnabledChange(event.target.checked)}
        onPointerDown={stopDragPointerDown}
        aria-label={`Enable ${accessibleLabel}${ariaLabelSuffix}`}
        className="shrink-0"
      />
      <div className="min-w-0 flex-1">{titleControl}</div>
    </div>
  );
}
