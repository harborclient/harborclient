import { Button, CodeEditor, Page } from '@harborclient/sdk/components';
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import type { PageRef } from '#/renderer/src/store/tabs';
import { faCode } from '#/renderer/src/fontawesome';
import { applyCustomThemeColors } from '#/renderer/src/plugins/themeRuntime';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { closeTab } from '#/renderer/src/store/slices/tabsSlice';
import {
  recordImmediate,
  selectThemeDesignerDraft,
  selectThemeDesignerInitialized
} from '#/renderer/src/store/slices/themeDesignerSlice';

interface Props {
  /**
   * Active theme stylesheet page tab identity.
   */
  page: Extract<PageRef, { type: 'theme-stylesheet' }>;

  /**
   * Tab id hosting this page (used to close when the Designer session ends).
   */
  tabId: string;
}

/**
 * Renders a CodeEditor tab for the optional CSS stylesheet on the active Designer draft.
 *
 * Typing updates a local buffer only. Update commits the buffer to the Designer draft
 * and refreshes the live preview; Discard resets the buffer to the last committed value.
 * The theme is persisted only when the user saves from the Designer.
 */
export function CustomThemeStylesheetTab({ page, tabId }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const initialized = useAppSelector(selectThemeDesignerInitialized);
  const draft = useAppSelector(selectThemeDesignerDraft);
  const committedStylesheet = draft.stylesheet ?? '';
  const [localStylesheet, setLocalStylesheet] = useState(committedStylesheet);
  const lastSyncedStylesheetRef = useRef(committedStylesheet);

  /**
   * Whether the local editor buffer differs from the committed Designer draft stylesheet.
   */
  const isLocalDirty = useMemo(
    () => localStylesheet !== committedStylesheet,
    [committedStylesheet, localStylesheet]
  );

  /**
   * Closes this tab when the Designer session is no longer active.
   */
  useEffect(() => {
    if (!initialized) {
      dispatch(closeTab(tabId));
    }
  }, [dispatch, initialized, tabId]);

  /**
   * Applies the committed stylesheet preview when the tab mounts or the committed value
   * changes from outside this editor (Designer discard, import, undo/redo).
   *
   * Also syncs the local buffer when the committed stylesheet changes, but only when
   * the buffer still matches the previously synced value so in-progress typing is not
   * overwritten by unrelated draft updates (e.g. color token edits).
   */
  useEffect(() => {
    if (!initialized) {
      return;
    }

    applyCustomThemeColors(draft.colors, draft.type, draft.stylesheet);

    if (committedStylesheet !== lastSyncedStylesheetRef.current) {
      lastSyncedStylesheetRef.current = committedStylesheet;
      setLocalStylesheet(committedStylesheet);
    }
  }, [committedStylesheet, draft.colors, draft.stylesheet, draft.type, initialized]);

  /**
   * Commits the local stylesheet buffer to the Designer draft and applies live preview.
   */
  const handleUpdate = useCallback((): void => {
    dispatch(
      recordImmediate({
        ...draft,
        stylesheet: localStylesheet
      })
    );
    lastSyncedStylesheetRef.current = localStylesheet;
    applyCustomThemeColors(draft.colors, draft.type, localStylesheet);
  }, [dispatch, draft, localStylesheet]);

  /**
   * Resets the local buffer and live preview to the last committed Designer stylesheet.
   */
  const handleDiscard = useCallback((): void => {
    setLocalStylesheet(committedStylesheet);
    lastSyncedStylesheetRef.current = committedStylesheet;
    applyCustomThemeColors(draft.colors, draft.type, draft.stylesheet);
  }, [committedStylesheet, draft.colors, draft.stylesheet, draft.type]);

  if (!initialized) {
    return <></>;
  }

  return (
    <Page
      embedded
      title={page.label}
      icon={faCode}
      description="Optional CSS appended after color token overrides when this theme is applied."
      className="flex min-h-0 flex-1 flex-col overflow-hidden p-6 pt-0!"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="toolbar"
            disabled={!isLocalDirty}
            aria-label="Discard stylesheet changes"
            onClick={handleDiscard}
          >
            Discard
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!isLocalDirty}
            aria-label="Update theme stylesheet preview"
            onClick={handleUpdate}
          >
            Update
          </Button>
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col border border-separator">
        <CodeEditor
          value={localStylesheet}
          onChange={setLocalStylesheet}
          language="css"
          placeholder={'/* Optional theme CSS */\n:root[data-theme="custom"] {\n  /* … */\n}\n'}
          minHeight="0"
          className="theme-stylesheet-editor"
          aria-label="Theme stylesheet CSS"
        />
      </div>
    </Page>
  );
}
