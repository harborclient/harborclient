import { useEffect, useRef, useState, type ChangeEvent, type JSX } from 'react';
import type { TeamHubAvatar } from '@harborclient/core/types';
import { FaIcon } from '@harborclient/sdk/components';
import { faPen } from '#/renderer/src/fontawesome';
import {
  teamHubAvatarColorClassFromKey,
  teamHubInitials
} from '#/renderer/src/ui/Sidebars/CollectionSidebar/shell/TeamHubRailAvatars/teamHubInitials';
import { avatarVersionFromUrl } from '#/renderer/src/ui/Shared/TeamHubAvatarImage/teamHubAvatarImageCache';
import { AvatarCropModal } from './AvatarCropModal';

interface Props {
  /**
   * Team hub connection id used to fetch the current server avatar image.
   */
  hubId: string;

  /**
   * Local connection display name used for initials fallback.
   */
  hubName: string;

  /**
   * Server-provided hub avatar metadata when available.
   */
  hubAvatar?: TeamHubAvatar | null;

  /**
   * Pending cropped JPEG data URL held locally until the parent saves.
   */
  pendingImageDataUrl: string | null;

  /**
   * Whether the control is disabled while the parent form is saving.
   */
  disabled?: boolean;

  /**
   * Called when the user confirms a new cropped avatar image.
   *
   * @param dataUrl - Cropped JPEG data URL, or null when cleared.
   */
  onPendingImageChange: (dataUrl: string | null) => void;
}

/**
 * Square avatar control for the Team Hub server avatar on the General admin page.
 *
 * Loads the current uploaded image (or initials fallback) and holds a cropped
 * JPEG locally until the parent persists it.
 */
export function TeamHubServerAvatar({
  hubId,
  hubName,
  hubAvatar = null,
  pendingImageDataUrl,
  disabled = false,
  onPendingImageChange
}: Props): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [serverImageDataUrl, setServerImageDataUrl] = useState<string | null>(null);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  /**
   * Loads the current uploaded hub avatar image when metadata includes an image URL.
   *
   * Refetches when the hub connection or image URL version changes. Falls back
   * to initials without writing empty state inside the effect body when no image
   * is present.
   */
  useEffect(() => {
    if (hubAvatar?.imageUrl == null) {
      return;
    }

    let cancelled = false;
    const version = avatarVersionFromUrl(hubAvatar.imageUrl);

    void window.api
      .getTeamHubAvatar(hubId, version)
      .then((image) => {
        if (!cancelled) {
          setServerImageDataUrl(image.dataUrl);
          setLoadError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setServerImageDataUrl(null);
          setLoadError(err instanceof Error ? err.message : String(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hubId, hubAvatar?.imageUrl]);

  /**
   * Revokes the temporary object URL used by the cropper when it is replaced or unmounted.
   */
  useEffect(() => {
    return () => {
      if (cropSource?.startsWith('blob:')) {
        URL.revokeObjectURL(cropSource);
      }
    };
  }, [cropSource]);

  const initials = hubAvatar?.initials ?? teamHubInitials(hubName);
  const colorClass = teamHubAvatarColorClassFromKey(hubAvatar?.color, hubId);
  const previewSrc =
    pendingImageDataUrl ?? (hubAvatar?.imageUrl != null ? serverImageDataUrl : null);

  /**
   * Opens the hidden file input so the user can pick a local image.
   */
  const handleOpenPicker = (): void => {
    if (disabled) {
      return;
    }
    fileInputRef.current?.click();
  };

  /**
   * Reads the selected local image into an object URL and opens the cropper.
   *
   * @param event - Change event from the hidden file input.
   */
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setLoadError('Please choose an image file.');
      return;
    }

    if (cropSource?.startsWith('blob:')) {
      URL.revokeObjectURL(cropSource);
    }

    setLoadError(null);
    setCropSource(URL.createObjectURL(file));
  };

  /**
   * Stores the cropped JPEG data URL in the parent draft and closes the cropper.
   *
   * @param dataUrl - Cropped avatar image as a JPEG data URL.
   */
  const handleCropConfirm = (dataUrl: string): void => {
    if (cropSource?.startsWith('blob:')) {
      URL.revokeObjectURL(cropSource);
    }
    setCropSource(null);
    onPendingImageChange(dataUrl);
  };

  /**
   * Closes the cropper without changing the pending avatar draft.
   */
  const handleCropCancel = (): void => {
    if (cropSource?.startsWith('blob:')) {
      URL.revokeObjectURL(cropSource);
    }
    setCropSource(null);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`relative flex h-48 w-48 items-center justify-center overflow-hidden rounded-md text-white ${
          previewSrc ? 'bg-muted' : colorClass
        } ${disabled ? 'opacity-60' : ''}`}
      >
        {previewSrc ? (
          <img src={previewSrc} alt="" className="h-full w-full object-cover" aria-hidden />
        ) : (
          <span className="text-[72px] font-semibold leading-none" aria-hidden>
            {initials}
          </span>
        )}
        <button
          type="button"
          className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/55 text-[16px] text-white opacity-70 shadow-sm transition-opacity hover:opacity-90 focus-visible:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed"
          aria-label="Change hub avatar"
          disabled={disabled}
          onClick={handleOpenPicker}
        >
          <FaIcon icon={faPen} className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {loadError ? (
        <p className="text-danger" role="status">
          {loadError}
        </p>
      ) : null}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={handleFileChange}
      />
      {cropSource ? (
        <AvatarCropModal
          imageSrc={cropSource}
          onCancel={handleCropCancel}
          onConfirm={handleCropConfirm}
        />
      ) : null}
    </div>
  );
}
