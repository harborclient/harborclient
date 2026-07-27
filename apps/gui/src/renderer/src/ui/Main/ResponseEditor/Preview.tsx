import type { JSX } from 'react';
import type { SendResult } from '@harborclient/core/types';
import { isHtmlResponse, responseContentType } from '#/renderer/src/ui/Shared/responseFormatUtils';
import { HtmlPreview } from './HtmlPreview';
import { ImagePreview } from './ImagePreview';

interface Props {
  /**
   * HTTP send result to preview as HTML or an image.
   */
  response: SendResult;

  /**
   * URL of the active request, used to resolve relative assets in HTML preview.
   */
  requestUrl: string;
}

/**
 * HTML or image preview for the Preview viewer tab.
 */
export function Preview({ response, requestUrl }: Props): JSX.Element {
  if (isHtmlResponse(response.body, response.headers)) {
    return <HtmlPreview body={response.body} requestUrl={requestUrl} />;
  }

  return (
    <ImagePreview
      bodyBase64={response.bodyBase64}
      contentType={responseContentType(response.headers)}
    />
  );
}
