import { Input } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import { normalizeCodeEditorFontSize } from '#/shared/codeEditorSettings';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectDraftGeneral,
  selectSettingsDraftDisabled,
  setDraftGeneralField
} from '#/renderer/src/store/slices/settingsDraftSlice';
import { SettingField } from '../components/SettingField';

/**
 * Parses the numeric pixel value from a stored editor font size string.
 *
 * @param value - Stored font size such as `16px`.
 * @returns Integer pixel size for the number input.
 */
function parseCodeEditorFontSizePx(value: string | undefined): number {
  const normalized = normalizeCodeEditorFontSize(value);
  return Number(normalized.replace(/px$/i, ''));
}

/**
 * CodeMirror font size field backed by the shared settings draft.
 */
export function SyntaxCodeEditorFontSizeField(): JSX.Element {
  const dispatch = useAppDispatch();
  const general = useAppSelector(selectDraftGeneral);
  const disabled = useAppSelector(selectSettingsDraftDisabled);

  return (
    <SettingField settingId="syntax.codeEditorFontSize">
      <Input
        id="setting-syntax-codeEditorFontSize"
        type="number"
        min={14}
        value={parseCodeEditorFontSizePx(general.codeEditorFontSize)}
        disabled={disabled}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          if (!Number.isFinite(parsed)) {
            return;
          }
          dispatch(
            setDraftGeneralField({
              key: 'codeEditorFontSize',
              value: normalizeCodeEditorFontSize(parsed)
            })
          );
        }}
      />
    </SettingField>
  );
}
