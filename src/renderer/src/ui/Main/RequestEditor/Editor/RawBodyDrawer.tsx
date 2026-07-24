import { Button, CodeEditor, FaIcon } from '@harborclient/sdk/components';
import type { CodeEditorSelectionAction } from '@harborclient/sdk/components';
import { useId, type JSX } from 'react';
import type { Variable } from '#/shared/types';
import { faChevronDown, faChevronRight } from '#/renderer/src/fontawesome';
import { AnimatedCollapse } from '#/renderer/src/ui/Shared/Animated/AnimatedCollapse';

interface Props {
  /**
   * Text shown in the Raw CodeEditor (override text or rendered projection).
   */
  value: string;

  /**
   * Called when the user edits the raw text (activates the override).
   */
  onChange: (value: string) => void;

  /**
   * Whether the drawer panel is expanded.
   */
  open: boolean;

  /**
   * Toggles drawer open/closed.
   */
  onToggle: () => void;

  /**
   * True when a verbatim raw override is active for sending.
   */
  overrideActive: boolean;

  /**
   * True when the override cannot cleanly map back to structured rows.
   */
  nonRepresentable: boolean;

  /**
   * Clears the raw override and restores the structured projection.
   */
  onResetFromRows: () => void;

  /**
   * Collection-scoped variables for highlighting and tooltips.
   */
  variables: Variable[];

  /**
   * Opens collection settings to edit a hovered variable.
   */
  onEditVariable?: (key: string) => void;

  /**
   * Optional CodeEditor selection toolbar actions (for example Copy to chat).
   */
  selectionActions?: CodeEditorSelectionAction[];
}

/**
 * Collapsible Raw body drawer with an editable CodeEditor under form/urlencoded rows.
 *
 * When a raw override is active and non-representable, shows a status notice and a
 * Reset control so intentionally invalid bodies can still be sent and discarded later.
 */
export function RawBodyDrawer({
  value,
  onChange,
  open,
  onToggle,
  overrideActive,
  nonRepresentable,
  onResetFromRows,
  variables,
  onEditVariable,
  selectionActions
}: Props): JSX.Element {
  const panelId = useId();
  const editorId = useId();

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-separator">
      <div className="flex shrink-0 items-center gap-2 border-b border-separator px-3 py-2">
        <button
          type="button"
          className="app-no-drag inline-flex items-center gap-2 text-left text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <FaIcon
            icon={open ? faChevronDown : faChevronRight}
            className="h-3.5 w-3.5 shrink-0"
            aria-hidden
          />
          <span>Raw body</span>
        </button>
        {overrideActive && (
          <Button type="button" variant="secondary" className="ml-auto" onClick={onResetFromRows}>
            Reset from rows
          </Button>
        )}
      </div>
      <AnimatedCollapse open={open}>
        <div id={panelId} className="flex min-h-0 flex-col gap-2 p-3">
          {overrideActive && nonRepresentable && (
            <p className="m-0 text-muted" role="status">
              Raw body is authoritative — structured rows may not match what will be sent.
            </p>
          )}
          <div className="flex min-h-[160px] flex-col overflow-hidden rounded-lg border border-separator">
            <CodeEditor
              id={editorId}
              value={value}
              onChange={onChange}
              language="text"
              placeholder="Raw request body"
              variables={variables}
              onEditVariable={onEditVariable}
              selectionActions={selectionActions}
              minHeight="160px"
              className="request-body-editor"
              aria-label="Raw request body"
            />
          </div>
        </div>
      </AnimatedCollapse>
    </div>
  );
}
