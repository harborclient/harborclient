import { Select } from '@harborclient/sdk/components';
import { TERMINAL_CURSOR_STYLES } from '@harborclient/core/generalSettings';
import type { TerminalCursorStyle } from '@harborclient/core/types';
import type { JSX } from 'react';

import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectDraftGeneral,
  selectSettingsDraftDisabled,
  setDraftTerminalField
} from '#/renderer/src/store/slices/settingsDraftSlice';
import { SettingField } from '../components/SettingField';

/**
 * Human-readable labels for xterm.js cursor styles.
 */
const CURSOR_STYLE_LABELS: Record<TerminalCursorStyle, string> = {
  block: 'Block',
  underline: 'Underline',
  bar: 'Bar'
};

/**
 * Terminal cursor style select backed by the shared settings draft.
 */
export function TerminalCursorStyleField(): JSX.Element {
  const dispatch = useAppDispatch();
  const general = useAppSelector(selectDraftGeneral);
  const disabled = useAppSelector(selectSettingsDraftDisabled);

  return (
    <SettingField settingId="terminal.cursorStyle">
      <Select
        id="setting-terminal-cursorStyle"
        value={general.terminal.cursorStyle}
        disabled={disabled}
        onChange={(event) =>
          dispatch(
            setDraftTerminalField({
              key: 'cursorStyle',
              value: event.target.value as TerminalCursorStyle
            })
          )
        }
      >
        {TERMINAL_CURSOR_STYLES.map((style) => (
          <option key={style} value={style}>
            {CURSOR_STYLE_LABELS[style]}
          </option>
        ))}
      </Select>
    </SettingField>
  );
}
