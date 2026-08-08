import { useEffect, useRef, useState, type ChangeEvent, type JSX } from 'react';
import { FaIcon } from '@harborclient/sdk/components';
import { faPen } from '#/renderer/src/fontawesome';
import {
  teamHubAvatarColorClassFromKey,
  teamHubInitials
} from '#/renderer/src/ui/Sidebars/CollectionSidebar/shell/TeamHubRailAvatars/teamHubInitials';
import { AvatarCropModal } from './AvatarCropModal';

/**
 * Session user fields used to render and upload the current hub avatar.
 */
export interface TeamHubFormSessionUser {
  /**
   * Stable Team Hub user account identifier.
   */
  id: string;

  /**
   * Display name used for initials fallback.
   */
  name: string;

  /**
   * Persisted avatar initials when available.
   */
  avatarInitials?: string;

  /**
   * Persisted avatar color key when available.
   */
  avatarColor?: string;

  /**
   * Relative avatar image URL when the user has uploaded a picture.
   */
  avatarImageUrl?: string;
}

interface Props {
  /**
   * Team hub connection id used to fetch and upload avatar images.
   */
  hubId: string;

  /**
   * Authenticated session user for this hub connection.
   */
  sessionUser: TeamHubFormSessionUser;

  /**
   * Pending cropped JPEG data URL held locally until Save.
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
 * Extracts the cache-busting version query from a relative avatar image URL.
 *
 * @param imageUrl - Relative avatar URL such as `/auth/users/{id}/avatar?v=123`.
 * @returns Version string when present.
 */
function avatarVersionFromUrl(imageUrl: string | undefined): string | undefined {
  if (imageUrl == null || imageUrl.length === 0) {
    return undefined;
  }

  try {
    const parsed = new URL(imageUrl, 'https://team-hub.local');
    return parsed.searchParams.get('v') ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Centered square avatar control for the Edit team hub modal.
 *
 * Shows the current server avatar (or initials fallback) with a centered edit
 * button that opens a file picker for `image/*`. The cropped result is held
 * locally until the parent saves.
 */
export function TeamHubFormAvatar({
  hubId,
  sessionUser,
  pendingImageDataUrl,
  disabled = false,
  onPendingImageChange
}: Props): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [serverImageDataUrl, setServerImageDataUrl] = useState<string | null>(null);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  /**
   * Loads the current uploaded avatar image for preview when the modal opens.
   *
   * Refetches when the session user's image URL or hub connection changes.
   * When no uploaded image exists, the preview falls back to initials without
   * writing empty state inside the effect body.
   */
  useEffect(() => {
    if (sessionUser.avatarImageUrl == null) {
      return;
    }

    let cancelled = false;
    const version = avatarVersionFromUrl(sessionUser.avatarImageUrl);

    void window.api
      .getTeamHubUserAvatar(hubId, sessionUser.id, version)
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
  }, [hubId, sessionUser.id, sessionUser.avatarImageUrl]);

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

  const initials = sessionUser.avatarInitials ?? teamHubInitials(sessionUser.name);
  const colorClass = teamHubAvatarColorClassFromKey(sessionUser.avatarColor, sessionUser.id);
  const previewSrc =
    pendingImageDataUrl ?? (sessionUser.avatarImageUrl != null ? serverImageDataUrl : null);

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
          aria-label="Change avatar"
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
