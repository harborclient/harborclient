import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';

/** Visible button and menu label for Copy to chat. */
export const COPY_TO_CHAT_LABEL = 'Copy to chat';

/** Display text for the copy-to-chat keyboard shortcut shown next to the label. */
export const COPY_TO_CHAT_SHORTCUT_HINT = 'Ctrl+Shift+O';

/** CodeMirror keymap binding for the copy-to-chat selection action. */
export const COPY_TO_CHAT_SHORTCUT_CODEMIRROR_KEY = 'Ctrl-Shift-o';

/** Lowercase letter key used by custom key handlers for copy-to-chat. */
export const COPY_TO_CHAT_SHORTCUT_LETTER = 'o';

/** Icon shown on Copy to chat buttons. */
export const COPY_TO_CHAT_ICON: IconDefinition = faWandMagicSparkles;

/**
 * Builds the lint-tooltip / diagnostic action name that includes the shortcut hint.
 *
 * @returns Label such as `Copy to chat (Ctrl+Shift+O)`.
 */
export function copyToChatActionLabel(): string {
  return `${COPY_TO_CHAT_LABEL} (${COPY_TO_CHAT_SHORTCUT_HINT})`;
}
