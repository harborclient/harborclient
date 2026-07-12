import {
  EmptyState,
  FooterPanel,
  ResizeHandle,
  RoundButton,
  useResizable
} from '@harborclient/sdk/components';
import { useCallback, useEffect, useId, useState, type JSX, type KeyboardEvent } from 'react';
import { faPlus, faTrash } from '#/renderer/src/fontawesome';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  addTerminal,
  removeTerminal,
  renameTerminal,
  selectActiveTerminalId,
  selectTerminals,
  selectTerminalsHydrated,
  setActiveTerminal
} from '#/renderer/src/store/slices/terminalsSlice';
import { TerminalTabButton } from './TerminalTabButton';
import { XtermView } from './XtermView';

interface Props {
  /**
   * Whether the panel is visible (slides up when true).
   */
  open: boolean;

  /**
   * Closes the terminal panel.
   */
  onClose: () => void;
}

/**
 * Slide-up footer panel hosting one or more interactive terminal tabs.
 */
export function TerminalPanel({ open, onClose }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const terminals = useAppSelector(selectTerminals);
  const activeTerminalId = useAppSelector(selectActiveTerminalId);
  const terminalsHydrated = useAppSelector(selectTerminalsHydrated);
  const tablistId = useId();
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');

  /**
   * Drives the draggable width of the terminal tab switcher, persisting the
   * chosen width across sessions.
   */
  const {
    size: tabListWidth,
    minSize: tabListMinSize,
    maxSize: tabListMaxSize,
    onResizeStart: onTabListResizeStart,
    onKeyboardResize: onTabListKeyboardResize
  } = useResizable({
    axis: 'x',
    direction: 1,
    defaultSize: 176,
    minSize: 120,
    getMaxSize: () => 400,
    storageKey: 'hc.terminalTabListWidth'
  });

  /**
   * Ensures at least one terminal exists once persisted layout has loaded and the panel is open.
   */
  useEffect(() => {
    if (!open || !terminalsHydrated || terminals.length > 0) {
      return;
    }

    dispatch(addTerminal());
  }, [dispatch, open, terminals.length, terminalsHydrated]);

  /**
   * Selects a terminal tab from the vertical switcher.
   *
   * @param terminalId - Terminal tab id to activate.
   */
  const handleSelectTerminal = (terminalId: string): void => {
    dispatch(setActiveTerminal(terminalId));
  };

  /**
   * Adds a new terminal tab and selects it.
   */
  const handleAddTerminal = (): void => {
    dispatch(addTerminal());
  };

  /**
   * Removes the active terminal tab.
   */
  const handleRemoveActiveTerminal = (): void => {
    if (activeTerminalId == null) {
      return;
    }

    if (editingTabId === activeTerminalId) {
      setEditingTabId(null);
      setDraftTitle('');
    }

    dispatch(removeTerminal(activeTerminalId));
  };

  /**
   * Enters inline rename mode for one terminal tab.
   *
   * @param terminalId - Terminal tab id to rename.
   * @param title - Current tab title used as the initial draft.
   */
  const handleStartEdit = (terminalId: string, title: string): void => {
    dispatch(setActiveTerminal(terminalId));
    setEditingTabId(terminalId);
    setDraftTitle(title);
  };

  /**
   * Commits the draft title for the tab currently being renamed.
   */
  const handleCommitEdit = useCallback((): void => {
    if (editingTabId == null) {
      return;
    }

    dispatch(renameTerminal({ id: editingTabId, title: draftTitle }));
    setEditingTabId(null);
    setDraftTitle('');
  }, [dispatch, draftTitle, editingTabId]);

  /**
   * Cancels inline rename without saving the draft title.
   */
  const handleCancelEdit = (): void => {
    setEditingTabId(null);
    setDraftTitle('');
  };

  /**
   * Moves keyboard focus between terminal tabs with arrow keys.
   *
   * @param event - Native keydown event from within the footer bar.
   * @param index - Index of the focused terminal tab.
   */
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    if (terminals.length === 0) {
      return;
    }

    let nextIndex: number | null = null;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      nextIndex = (index + 1) % terminals.length;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      nextIndex = (index - 1 + terminals.length) % terminals.length;
    } else if (event.key === 'Home') {
      event.preventDefault();
      nextIndex = 0;
    } else if (event.key === 'End') {
      event.preventDefault();
      nextIndex = terminals.length - 1;
    }

    if (nextIndex == null) {
      return;
    }

    const nextTerminal = terminals[nextIndex];
    if (!nextTerminal) {
      return;
    }

    dispatch(setActiveTerminal(nextTerminal.id));
    event.currentTarget.parentElement
      ?.querySelectorAll<HTMLElement>('[role="tab"]')
      [nextIndex]?.focus();
  };

  const addButton = (
    <RoundButton
      key="add-terminal"
      icon={faPlus}
      ariaLabel="Add terminal"
      title="Add terminal"
      onClick={handleAddTerminal}
    />
  );

  const trashButton = (
    <RoundButton
      key="remove-terminal"
      icon={faTrash}
      ariaLabel="Delete terminal"
      title="Delete terminal"
      disabled={activeTerminalId == null}
      onClick={handleRemoveActiveTerminal}
    />
  );

  return (
    <FooterPanel
      id="footer-terminal-panel"
      open={open}
      onClose={onClose}
      closeLabel="terminal"
      storageKey="hc.terminalPanelHeight"
      title="Terminal"
      buttons={[addButton, trashButton]}
    >
      <div className="flex h-full min-h-0 w-full">
        <div
          id={tablistId}
          role="tablist"
          aria-orientation="vertical"
          aria-label="Terminal tabs"
          className="flex h-full shrink-0 flex-col gap-1 overflow-auto bg-sidebar-toolbar p-2"
          style={{ width: tabListWidth }}
        >
          {terminals.map((terminal, index) => (
            <TerminalTabButton
              key={terminal.id}
              terminal={terminal}
              selected={terminal.id === activeTerminalId}
              index={index}
              editing={editingTabId === terminal.id}
              draftTitle={draftTitle}
              onSelect={() => handleSelectTerminal(terminal.id)}
              onStartEdit={() => handleStartEdit(terminal.id, terminal.title)}
              onDraftChange={setDraftTitle}
              onCommit={handleCommitEdit}
              onCancel={handleCancelEdit}
              onKeyDown={handleTabKeyDown}
            />
          ))}
        </div>

        <ResizeHandle
          orientation="vertical"
          value={tabListWidth}
          min={tabListMinSize}
          max={tabListMaxSize}
          onResizeStart={onTabListResizeStart}
          onKeyboardResize={onTabListKeyboardResize}
          ariaLabel="Resize terminal tabs list"
        />

        <div className="relative h-full min-h-0 min-w-0 flex-1">
          {terminals.length === 0 ? (
            <EmptyState variant="centered" className="h-full">
              No terminals yet. Use the add button to open a shell session.
            </EmptyState>
          ) : (
            terminals.map((terminal, index) => (
              <XtermView
                key={terminal.id}
                id={terminal.id}
                index={index + 1}
                title={terminal.title}
                cwd={terminal.cwd}
                active={terminal.id === activeTerminalId}
                panelOpen={open}
              />
            ))
          )}
        </div>
      </div>
    </FooterPanel>
  );
}
