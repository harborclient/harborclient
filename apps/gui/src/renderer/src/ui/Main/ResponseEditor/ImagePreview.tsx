import { useMemo, type JSX } from 'react';

interface Props {
  /**
   * Base64-encoded image bytes from the main process.
   */
  bodyBase64?: string;

  /**
   * Response Content-Type header used for the data URL MIME type.
   */
  contentType: string;
}

/**
 * Renders an image response body inline using a data URL built from base64 bytes.
 */
export function ImagePreview({ bodyBase64, contentType }: Props): JSX.Element {
  /**
   * Builds a data URL for the image when base64 payload is available.
   */
  const src = useMemo(() => {
    if (!bodyBase64) return undefined;
    const mime = contentType.split(';')[0]?.trim() || 'image/*';
    return `data:${mime};base64,${bodyBase64}`;
  }, [bodyBase64, contentType]);

  if (!src) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md bg-control shadow-[inset_0_0.5px_1px_rgba(0,0,0,0.06)]">
        <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-[14px] text-muted">
          Image preview is unavailable for this response.
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md bg-control shadow-[inset_0_0.5px_1px_rgba(0,0,0,0.06)]">
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
        <img
          src={src}
          alt="Image response preview"
          className="max-h-full max-w-full object-contain"
        />
      </div>
    </div>
  );
}
