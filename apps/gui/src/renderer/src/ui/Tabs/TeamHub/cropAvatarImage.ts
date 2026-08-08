/**
 * Pixel area produced by `react-easy-crop` after the user finishes cropping.
 */
export interface CroppedAreaPixels {
  /**
   * Left edge of the crop rectangle in source-image pixels.
   */
  x: number;

  /**
   * Top edge of the crop rectangle in source-image pixels.
   */
  y: number;

  /**
   * Crop width in source-image pixels.
   */
  width: number;

  /**
   * Crop height in source-image pixels.
   */
  height: number;
}

/**
 * Default exported avatar edge length in pixels.
 */
export const AVATAR_OUTPUT_SIZE = 256;

/**
 * JPEG quality used when encoding the cropped avatar.
 */
export const AVATAR_JPEG_QUALITY = 0.85;

/**
 * Loads an image from a local object URL or data URL.
 *
 * @param src - Image source URL.
 * @returns Decoded HTML image element.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    /**
     * Resolves once the browser finishes decoding the source image.
     */
    image.onload = (): void => {
      resolve(image);
    };
    /**
     * Rejects when the browser cannot decode the source image.
     */
    image.onerror = (): void => {
      reject(new Error('Failed to load the selected image.'));
    };
    image.src = src;
  });
}

/**
 * Crops a source image to a square JPEG data URL suitable for Team Hub upload.
 *
 * Draws the crop rectangle from `react-easy-crop` onto an offscreen canvas and
 * downscales to {@link AVATAR_OUTPUT_SIZE}.
 *
 * @param imageSrc - Object URL or data URL of the source image.
 * @param crop - Crop rectangle in source-image pixels.
 * @param outputSize - Edge length of the exported square image.
 * @param quality - JPEG quality from 0 to 1.
 * @returns JPEG data URL for the cropped avatar.
 * @throws {Error} When the image cannot be loaded or canvas export fails.
 */
export async function cropAvatarImageToDataUrl(
  imageSrc: string,
  crop: CroppedAreaPixels,
  outputSize: number = AVATAR_OUTPUT_SIZE,
  quality: number = AVATAR_JPEG_QUALITY
): Promise<string> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to create a canvas for avatar cropping.');
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, outputSize, outputSize);

  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  if (!dataUrl.startsWith('data:image/jpeg')) {
    throw new Error('Failed to encode the cropped avatar image.');
  }

  return dataUrl;
}
