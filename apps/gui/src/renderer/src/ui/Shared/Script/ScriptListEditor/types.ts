import type { AiSettings, HubLlmModelGroup, ScriptRef, Snippet, Variable } from '#/shared/types';
import type { ScriptStage } from '@harborclient/sdk';
import type { RegisteredScriptEditorAction } from '#/shared/plugin/types';

/**
 * Props for one sortable script row with expandable editor body.
 */
export interface SortableScriptRowProps {
  /**
   * Script reference rendered in this row.
   */
  script: ScriptRef;

  /**
   * Snippet library used for labels and snippet previews.
   */
  snippets: Snippet[];

  /**
   * Accessible label for row actions.
   */
  label: string;

  /**
   * Whether the script editor body is expanded.
   */
  isExpanded: boolean;

  /**
   * Importable module filenames for `./` import path autocomplete.
   */
  importableModuleNames: string[];

  /**
   * Script phase used for hc autocomplete suggestions.
   */
  phase: 'pre' | 'post';

  /**
   * Placeholder shown in empty inline editors.
   */
  placeholder: string;

  /**
   * Collection-scoped variables for editor highlighting.
   */
  variables: Variable[];

  /**
   * Opens collection settings to edit variables.
   */
  onEditVariables?: (key: string) => void;

  /**
   * When false, drag reordering is disabled but the stage border strip stays visible.
   */
  sortable: boolean;

  /**
   * Called when the enable checkbox toggles.
   */
  onEnabledChange: (enabled: boolean) => void;

  /**
   * Called when the optional display name changes.
   */
  onNameChange: (name: string) => void;

  /**
   * Called when the user removes this script row.
   */
  onRemove: () => void;

  /**
   * Toggles expanded editor content for this row.
   */
  onToggleExpanded: () => void;

  /**
   * Persists inline script source edits.
   */
  onPatchCode: (code: string) => void;

  /**
   * Opens the save-snippet modal for this row's current source code.
   */
  onSaveSnippet: (code: string) => void;

  /**
   * Prompts before enabling edit mode on a linked snippet row.
   *
   * @returns Resolves to true when the user may enter edit mode.
   */
  onRequestEditSnippet: () => Promise<boolean>;

  /**
   * Shows an informational dialog when the user clicks a read-only linked snippet editor.
   */
  onReadonlySnippetClick: () => void;

  /**
   * Clones this script row as a new inline entry inserted after the source row.
   */
  onClone: () => void;

  /**
   * Copies this script row into the in-memory clipboard for paste.
   */
  onCopy: () => void;

  /**
   * Whether AI chat is available for this user.
   */
  aiAvailable: boolean;

  /**
   * Opens the AI sidebar with a fresh chat prefilled for this script row.
   */
  onAskAi: () => void;

  /**
   * Copies the selected script range into the AI chat composer as an `@` reference tag.
   *
   * @param selection - Character offsets into the script source.
   */
  onCopySelectionToChat: (selection: { from: number; to: number }) => void;

  /**
   * AI provider settings for inline `/ask` requests.
   */
  aiSettings: AiSettings;

  /**
   * Team Hub model groups for inline `/ask` requests.
   */
  hubModelGroups: HubLlmModelGroup[];

  /**
   * Whether GitHub Models sign-in is active.
   */
  githubConnected: boolean;

  /**
   * Plugin row action buttons registered for this script phase.
   */
  scriptEditorActions: RegisteredScriptEditorAction[];

  /**
   * Whether the row's Stage value may be changed from the script editor.
   */
  stageEditable: boolean;

  /**
   * Applies a new stage to this script row.
   *
   * @param stage - Selected script stage.
   */
  onStageSelect: (stage: ScriptStage) => void;

  /**
   * Id of the currently open row actions menu, or null when all are closed.
   */
  openRowMenuId: string | null;

  /**
   * Called when a row actions menu opens or closes.
   */
  onOpenRowMenuChange: (menuId: string | null) => void;

  /**
   * Opens a live-linked script editor page tab for this row.
   */
  onOpenInTab?: () => void;

  /**
   * When true, hides the draggable stage border strip (decorative strip only).
   */
  hideDragHandle?: boolean;

  /**
   * When true, the code editor grows to fill available vertical space.
   */
  editorFill?: boolean;

  /**
   * When true, keeps the editor expanded and hides the collapse toggle.
   */
  forceExpanded?: boolean;
}
