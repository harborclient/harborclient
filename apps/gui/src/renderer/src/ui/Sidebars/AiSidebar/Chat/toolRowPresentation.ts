import type { AiChatStreamToolOwner } from '@harborclient/core/types';
import type { AiChatToolRowStatus } from '#/renderer/src/store/slices/aiChatSlice';

/**
 * Returns a short UI label for the runtime that owns a tool call.
 *
 * @param owner - Normalized tool owner from the stream contract.
 * @returns Human-readable owner label for compact tool rows.
 */
export function toolRowOwnerLabel(owner: AiChatStreamToolOwner): string {
  switch (owner) {
    case 'harbor':
      return 'Desktop';
    case 'hub':
      return 'Team Hub';
    case 'renderer':
      return 'App';
    default:
      return 'Tool';
  }
}

/**
 * Returns accessible status text for a compact tool progress row.
 *
 * @param status - Running, done, or error progress state.
 * @returns Status label paired with decorative row icons in the UI.
 */
export function toolRowStatusLabel(status: AiChatToolRowStatus): string {
  switch (status) {
    case 'running':
      return 'Running';
    case 'done':
      return 'Done';
    case 'error':
      return 'Error';
    default:
      return 'Unknown';
  }
}
