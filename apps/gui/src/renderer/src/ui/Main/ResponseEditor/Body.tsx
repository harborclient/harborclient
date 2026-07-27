import type { JSX } from 'react';
import { CodeEditor } from '@harborclient/sdk/components';
import type { SendResult } from '@harborclient/core/types';
import { bodyLanguage, formatBody } from '#/renderer/src/ui/Shared/responseFormatUtils';

interface Props {
  /**
   * HTTP send result whose body is shown in the read-only editor.
   */
  response: SendResult;

  /**
   * When true, stretches the editor to fill remaining height in a flex column
   * (full-page response viewer). Leave false in the embedded response pane.
   */
  fillHeight?: boolean;
}

/**
 * Read-only pretty-printed response body for the Body viewer tab.
 */
export function Body({ response, fillHeight = false }: Props): JSX.Element {
  const formatted = formatBody(response.body);
  const language = bodyLanguage(response.body, response.headers);

  return (
    <CodeEditor
      readOnly
      value={formatted || '(empty body)'}
      language={language}
      minHeight={fillHeight ? '0' : undefined}
      className={fillHeight ? 'response-body-editor' : undefined}
    />
  );
}
