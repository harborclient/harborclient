import { Button, Modal, ModalFooter } from '@harborclient/sdk/components';
import { useCallback, useState, type JSX } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { cropAvatarImageToDataUrl } from './cropAvatarImage';

interface Props {
  /**
   * Object URL or data URL of the image selected for cropping.
   */
  imageSrc: string;

  /**
   * Called when the user cancels cropping without applying changes.
   */
  onCancel: () => void;

  /**
   * Called with the cropped JPEG data URL when the user confirms the crop.
   *
   * @param dataUrl - Cropped avatar image as a JPEG data URL.
   */
  onConfirm: (dataUrl: string) => void;
}

/**
 * Modal that lets the user pan and zoom an uploaded image into a square crop.
 */
export function AvatarCropModal({ imageSrc, onCancel, onConfirm }: Props): JSX.Element {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Stores the latest crop rectangle in source-image pixels for export.
   *
   * @param _croppedArea - Percentage-based crop area unused by export.
   * @param pixels - Pixel-based crop area used by canvas export.
   */
  const handleCropComplete = useCallback((_croppedArea: Area, pixels: Area): void => {
    setCroppedAreaPixels(pixels);
  }, []);

  /**
   * Exports the current crop to a JPEG data URL and forwards it to the parent.
   */
  const handleConfirm = async (): Promise<void> => {
    if (!croppedAreaPixels) {
      setError('Adjust the crop before saving.');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const dataUrl = await cropAvatarImageToDataUrl(imageSrc, croppedAreaPixels);
      onConfirm(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      className="w-[520px]"
      labelledBy="avatar-crop-dialog-title"
      onClose={onCancel}
      title="Crop avatar"
      description="Pan and zoom to choose the square area used for your Team Hub avatar."
      closeDisabled={busy}
      disableEscape={busy}
    >
      <div className="flex flex-col gap-4">
        <div className="relative h-72 w-full overflow-hidden rounded-md bg-muted">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
          />
        </div>

        <label className="flex flex-col gap-2" htmlFor="avatar-crop-zoom">
          <span className="text-muted">Zoom</span>
          <input
            id="avatar-crop-zoom"
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            disabled={busy}
            onChange={(event) => setZoom(Number(event.target.value))}
            aria-valuemin={1}
            aria-valuemax={3}
            aria-valuenow={zoom}
          />
        </label>

        {error ? (
          <p className="text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <ModalFooter>
          <Button type="button" variant="toolbar" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" disabled={busy} onClick={() => void handleConfirm()}>
            {busy ? 'Cropping…' : 'Use photo'}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}
