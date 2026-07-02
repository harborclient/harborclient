import { CodeEditor } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectDraftGeneral } from '#/renderer/src/store/slices/settingsDraftSlice';
import { PREVIEW_SAMPLE } from '../SyntaxHighlightingSection/constants';

/**
 * Live CodeMirror preview for syntax highlighting settings.
 */
export function SyntaxPreviewExtra(): JSX.Element {
  const general = useAppSelector(selectDraftGeneral);

  return (
    <div className="flex flex-col gap-2 border border-separator p-4">
      <span className="text-[16px] font-medium text-text">Preview</span>
      <CodeEditor
        value={PREVIEW_SAMPLE}
        readOnly
        language="javascript"
        minHeight="120px"
        themeOverride={general.codeEditorTheme}
        setupOverride={general.codeEditorSetup}
      />
    </div>
  );
}
