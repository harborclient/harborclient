import {
  EmptyState,
  FooterPanel,
  ResizeHandle,
  RoundButton,
  useResizable
} from '@harborclient/sdk/components';
import { useCallback, useEffect, useId, useState, type JSX, type KeyboardEvent } from 'react';
import { faGear, faMagnifyingGlass, faPlus, faTrash } from '#/renderer/src/fontawesome';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { openPageTab } from '#/renderer/src/store/slices/tabsSlice';
import {
  addTerminal,
  removeTerminal,
  renameTerminal,
  selectActiveTerminalId,
  selectTerminals,
  selectTerminalsHydrated,
  setActiveTerminal
} from '#/renderer/src/store/slices/terminalsSlice';
import { AnimatedCollapse } from '#/renderer/src/ui/Shared/Animated/AnimatedCollapse';
import { registerTerminalFindToggle, TERMINAL_PANEL_ID } from './terminalFindShortcut';
import { getTerminalInstance } from './terminalRegistry';
import { TerminalSearchBar } from './TerminalSearchBar';
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchOpenForPanel, setSearchOpenForPanel] = useState(open);

  // Close search when the terminal panel closes (adjust state during render).
  if (searchOpenForPanel !== open) {
    setSearchOpenForPanel(open);
    if (!open) {
      setSearchOpen(false);
    }
  }

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
   * Returns focus to the active xterm instance after the search bar closes.
   */
  const focusActiveTerminal = useCallback((): void => {
    if (activeTerminalId == null) {
      return;
    }

    const terminalId = activeTerminalId;
    requestAnimationFrame(() => {
      getTerminalInstance(terminalId)?.focus();
    });
  }, [activeTerminalId]);

  /**
   * Registers the find-shortcut toggle while the terminal panel is open so
   * CmdOrCtrl+F (or the configured accelerator) slides search down/up instead
   * of focusing sidebar search.
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    return registerTerminalFindToggle(() => {
      setSearchOpen((current) => {
        const next = !current;
        if (!next) {
          focusActiveTerminal();
        }
        return next;
      });
    });
  }, [focusActiveTerminal, open]);

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
   * Removes one terminal tab by id.
   *
   * @param terminalId - Terminal tab id to close.
   */
  const handleRemoveTerminal = (terminalId: string): void => {
    if (editingTabId === terminalId) {
      setEditingTabId(null);
      setDraftTitle('');
    }

    dispatch(removeTerminal(terminalId));
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
  const handleTabKeyDown = (event: KeyboardEvent<HTMLElement>, index: number): void => {
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

  /**
   * Opens the Settings tab focused on the Terminal section.
   */
  const handleOpenTerminalSettings = (): void => {
    dispatch(openPageTab({ type: 'settings', section: 'terminal' }));
  };

  /**
   * Toggles the slide-down terminal search bar and restores terminal focus when closing.
   */
  const handleToggleSearch = (): void => {
    setSearchOpen((current) => {
      const next = !current;
      if (!next) {
        focusActiveTerminal();
      }
      return next;
    });
  };

  /**
   * Closes the slide-down terminal search bar and returns focus to the active terminal.
   */
  const handleCloseSearch = (): void => {
    setSearchOpen(false);
    focusActiveTerminal();
  };

  const settingsButton = (
    <RoundButton
      key="terminal-settings"
      icon={faGear}
      ariaLabel="Terminal settings"
      title="Terminal settings"
      onClick={handleOpenTerminalSettings}
    />
  );

  const searchButton = (
    <RoundButton
      key="terminal-search"
      icon={faMagnifyingGlass}
      ariaLabel="Search terminal"
      title="Search terminal"
      aria-pressed={searchOpen}
      onClick={handleToggleSearch}
    />
  );

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
      onClick={() => {
        if (activeTerminalId != null) {
          handleRemoveTerminal(activeTerminalId);
        }
      }}
    />
  );

  return (
    <FooterPanel
      id={TERMINAL_PANEL_ID}
      open={open}
      onClose={onClose}
      closeLabel="terminal"
      storageKey="hc.terminalPanelHeight"
      title="Terminal"
      buttons={[settingsButton, searchButton, addButton, trashButton]}
    >
      <div className="relative h-full min-h-0 w-full min-w-0">
        <div className="absolute inset-x-0 top-0 z-20">
          <AnimatedCollapse open={searchOpen}>
            <div className="bg-sidebar shadow-sm">
              <TerminalSearchBar activeTerminalId={activeTerminalId} onClose={handleCloseSearch} />
            </div>
          </AnimatedCollapse>
        </div>
        <div className="flex h-full min-h-0 min-w-0">
          <div
            id={tablistId}
            role="tablist"
            aria-orientation="vertical"
            aria-label="Terminal tabs"
            className="flex h-full shrink-0 flex-col gap-1 overflow-y-auto overflow-x-hidden bg-sidebar-toolbar p-2"
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
                onClose={() => handleRemoveTerminal(terminal.id)}
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
      </div>
    </FooterPanel>
  );
}
