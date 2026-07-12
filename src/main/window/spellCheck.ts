import { session, type Session } from 'electron';

/**
 * Enables or disables Chromium spellcheck for the given Electron session.
 *
 * @param enabled - Whether editable fields should show spellcheck underlines.
 * @param targetSession - Session to update; defaults to the main app session.
 */
export function applySpellCheckEnabled(
  enabled: boolean,
  targetSession: Session = session.defaultSession
): void {
  targetSession.setSpellCheckerEnabled(enabled);
}
