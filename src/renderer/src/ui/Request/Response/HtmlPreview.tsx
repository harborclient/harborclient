import { useMemo, type JSX } from 'react';
import {
  buildHtmlPreviewSrcdoc,
  resolveHtmlPreviewBaseUrl
} from '#/renderer/src/ui/shared/responseFormatUtils';

interface Props {
  /**
   * Raw HTML response body to render in a sandboxed preview frame.
   */
  body: string;

  /**
   * URL of the active request, used to resolve relative stylesheets and images.
   */
  requestUrl: string;
}

/**
 * Renders an HTML response body in a sandboxed iframe that blocks scripts but
 * allows external stylesheets and images.
 */
export function HtmlPreview({ body, requestUrl }: Props): JSX.Element {
  /**
   * Builds srcdoc with a request base URL and script-blocking CSP so relative
   * assets resolve against the API host.
   */
  const srcDoc = useMemo(() => {
    const baseUrl = resolveHtmlPreviewBaseUrl(requestUrl);
    return buildHtmlPreviewSrcdoc(body, baseUrl);
  }, [body, requestUrl]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md bg-control shadow-[inset_0_0.5px_1px_rgba(0,0,0,0.06)]">
      <iframe
        title="HTML response preview"
        sandbox=""
        srcDoc={srcDoc}
        className="min-h-0 flex-1 w-full border-0 bg-white"
      />
    </div>
  );
}
