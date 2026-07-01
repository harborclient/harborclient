import { type BrowserWindow } from 'electron';
import { getShortcutOverrides } from '#/main/settings/shortcutSettings';
import {
  acceleratorMatchesChord,
  resolveAcceleratorMap,
  SHORTCUT_DEFS,
  type KeyChord
} from '#/shared/shortcuts';

/**
 * Dispatches custom menu actions from keyboard input so accelerators work even
 * when they are not bound to a visible application menu item.
 *
 * @param window - Main browser window whose webContents receives key events.
 */
export function attachShortcutDispatch(window: BrowserWindow): void {
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || input.isAutoRepeat) {
      return;
    }

    const chord: KeyChord = {
      key: input.key,
      control: input.control,
      meta: input.meta,
      alt: input.alt,
      shift: input.shift
    };

    const accelerators = resolveAcceleratorMap(getShortcutOverrides());

    for (const def of SHORTCUT_DEFS) {
      if (def.kind !== 'action' || def.actionId == null) {
        continue;
      }

      const accelerator = accelerators.get(def.id);
      if (accelerator == null || accelerator.length === 0) {
        continue;
      }

      if (!acceleratorMatchesChord(accelerator, chord)) {
        continue;
      }

      window.webContents.send('menu:action', def.actionId);
      event.preventDefault();
      return;
    }
  });
}
