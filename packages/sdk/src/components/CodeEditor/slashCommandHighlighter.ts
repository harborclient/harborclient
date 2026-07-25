import type { Extension } from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  type ViewUpdate
} from '@codemirror/view';

/**
 * Minimal slash-command shape required for line highlighting.
 */
export interface SlashCommandSpec {
  /**
   * Command name without the leading slash (for example `ask`).
   */
  name: string;
}

/**
 * Builds a MatchDecorator regexp that highlights registered slash commands at line start.
 *
 * @param commands - Slash command names to highlight.
 */
function slashCommandHighlightPattern(commands: SlashCommandSpec[]): RegExp {
  const names = commands.map((entry) => entry.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (names.length === 0) {
    return /(?!)/g;
  }
  return new RegExp(`^(\\s*)(/(?:${names.join('|')}))([ \\t]+.*)?$`, 'gm');
}

/**
 * Returns a ViewPlugin extension that accents slash commands at the start of a line.
 *
 * @param commands - Registered slash commands to decorate.
 */
export function createSlashCommandHighlighter(commands: SlashCommandSpec[]): Extension {
  const slashMatcher = new MatchDecorator({
    regexp: slashCommandHighlightPattern(commands),
    /**
     * Applies accent styling to the command token and muted italic styling to args.
     */
    decorate: (add, from, _to, match) => {
      const leading = match[1] ?? '';
      const command = match[2] ?? '';
      const args = match[3];
      const commandFrom = from + leading.length;
      const commandTo = commandFrom + command.length;
      add(commandFrom, commandTo, Decoration.mark({ class: 'cm-slash-command' }));
      if (args) {
        add(
          commandTo,
          commandTo + args.length,
          Decoration.mark({ class: 'cm-slash-command-args' })
        );
      }
    }
  });

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      /**
       * Builds the initial slash-command decoration set for the editor view.
       *
       * @param view - CodeMirror editor view instance.
       */
      constructor(view: EditorView) {
        this.decorations = slashMatcher.createDeco(view);
      }

      /**
       * Recomputes slash-command decorations when document content changes.
       *
       * @param update - View update describing what changed.
       */
      update(update: ViewUpdate): void {
        this.decorations = slashMatcher.updateDeco(update, this.decorations);
      }
    },
    { decorations: (v) => v.decorations }
  );
}
