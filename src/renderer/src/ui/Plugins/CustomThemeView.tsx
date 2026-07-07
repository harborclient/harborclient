import { Button, FormGroup, Input, Page, Select } from '@harborclient/sdk/components';
import { useEffect, type JSX } from 'react';
import type { CustomTheme } from '#/shared/types/customTheme';
import { faWandMagicSparkles } from '#/renderer/src/fontawesome';
import { ColorTokenGrid } from '#/renderer/src/ui/Plugins/ColorTokenGrid';
import { SaveRenamedThemeModal } from '#/renderer/src/ui/Plugins/SaveRenamedThemeModal';
import { useCustomTheme } from '#/renderer/src/ui/Plugins/hooks/useCustomTheme';

interface Props {
  /**
   * Existing custom theme id to edit, if any.
   */
  editingId?: string | null;

  /**
   * Called after a theme is saved so Installed cards can refresh.
   */
  onSaved?: (theme: CustomTheme) => void;
}

/**
 * Creator form for building and previewing custom themes.
 */
export function CustomThemeView({ editingId, onSaved }: Props): JSX.Element {
  const {
    draft,
    loading,
    busy,
    error,
    canSave,
    canUndo,
    canRedo,
    renamePrompt,
    handleColorChange,
    handleTitleChange,
    handleTitleBlur,
    handleTypeChange,
    handleDiscard,
    handleSave,
    handleRenameSaveExisting,
    handleRenameSaveAsNew,
    handleRenameCancel,
    handleExport,
    handleImport,
    undo,
    redo
  } = useCustomTheme({ editingId, onSaved });

  /**
   * Routes Edit menu undo/redo actions to the Creator history while this view is mounted.
   */
  useEffect(() => {
    const unsubscribe = window.api.onMenuAction((action) => {
      if (action === 'undo') {
        undo();
        return;
      }
      if (action === 'redo') {
        redo();
      }
    });
    return unsubscribe;
  }, [undo, redo]);

  /**
   * Keeps the main-process Edit menu undo/redo items aligned with Creator history availability.
   */
  useEffect(() => {
    void window.api.setMenuCreatorUndoRedo(true, canUndo, canRedo);
    return () => {
      void window.api.setMenuCreatorUndoRedo(false, false, false);
    };
  }, [canUndo, canRedo]);

  return (
    <>
      {renamePrompt ? (
        <SaveRenamedThemeModal
          originalTitle={renamePrompt.originalTitle}
          newTitle={renamePrompt.newTitle}
          busy={busy}
          onCancel={handleRenameCancel}
          onUpdateExisting={() => void handleRenameSaveExisting()}
          onSaveAsNew={() => void handleRenameSaveAsNew()}
        />
      ) : null}
      <Page
        embedded
        title="Creator"
        icon={faWandMagicSparkles}
        description="Design a custom appearance theme with live preview across HarborClient."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="toolbar"
              disabled={busy || loading || !canUndo}
              aria-label="Undo theme change"
              onClick={() => undo()}
            >
              Undo
            </Button>
            <Button
              type="button"
              variant="toolbar"
              disabled={busy || loading || !canRedo}
              aria-label="Redo theme change"
              onClick={() => redo()}
            >
              Redo
            </Button>
            <Button
              type="button"
              variant="toolbar"
              disabled={busy || loading}
              onClick={() => void handleExport()}
            >
              Export
            </Button>
            <Button
              type="button"
              variant="toolbar"
              disabled={busy || loading}
              onClick={() => void handleImport()}
            >
              Import
            </Button>
          </div>
        }
      >
        {error ? (
          <p className="text-danger" role="alert">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="text-muted" role="status">
            Loading theme…
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormGroup label="Theme title" htmlFor="creator-theme-title">
                <Input
                  id="creator-theme-title"
                  value={draft.title}
                  disabled={busy}
                  onChange={(event) => handleTitleChange(event.target.value)}
                  onBlur={() => handleTitleBlur()}
                />
              </FormGroup>
              <FormGroup label="Appearance" htmlFor="creator-theme-type">
                <Select
                  id="creator-theme-type"
                  value={draft.type}
                  disabled={busy}
                  onChange={(event) => handleTypeChange(event.target.value as typeof draft.type)}
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="high-contrast">High contrast</option>
                </Select>
              </FormGroup>
            </div>

            <ColorTokenGrid colors={draft.colors} onChange={handleColorChange} />

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="toolbar"
                disabled={busy}
                onClick={() => handleDiscard()}
              >
                Discard
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={busy || !canSave}
                onClick={() => void handleSave()}
              >
                {busy ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        )}
      </Page>
    </>
  );
}
