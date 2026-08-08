import { useEffect, useRef, useState, type ChangeEvent, type JSX } from 'react';
import { FaIcon } from '@harborclient/sdk/components';
import { faPen } from '#/renderer/src/fontawesome';
import {
  teamHubAvatarColorClassFromKey,
  teamHubInitials
} from '#/renderer/src/ui/Sidebars/CollectionSidebar/shell/TeamHubRailAvatars/teamHubInitials';
import { AvatarCropModal } from './AvatarCropModal';

/**
 * User fields used to render and upload an avatar preview.
 */
export interface TeamHubFormAvatarUser {
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
   * User whose avatar is being previewed and edited.
   */
  user: TeamHubFormAvatarUser;

  /**
   * Pending cropped JPEG data URL held locally until Save.
   */
  pendingImageDataUrl: string | null;

  /**
   * Whether the control is disabled while the parent form is saving.
   */
  disabled?: boolean;

  /**
   * Visual size of the square avatar tile.
   *
   * Defaults to `lg` for the Edit team hub modal; use `md` in denser dialogs.
   */
  size?: 'lg' | 'md';

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
 * Square avatar control for Team Hub profile and admin user forms.
 *
 * Shows the current server avatar (or initials fallback) with a centered edit
 * button that opens a file picker for `image/*`. The cropped result is held
 * locally until the parent saves.
 */
export function TeamHubFormAvatar({
  hubId,
  user,
  pendingImageDataUrl,
  disabled = false,
  size = 'lg',
  onPendingImageChange
}: Props): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [serverImageDataUrl, setServerImageDataUrl] = useState<string | null>(null);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const isLarge = size === 'lg';

  /**
   * Loads the current uploaded avatar image for preview when the modal opens.
   *
   * Refetches when the user's image URL or hub connection changes.
   * When no uploaded image exists, the preview falls back to initials without
   * writing empty state inside the effect body.
   */
  useEffect(() => {
    if (user.avatarImageUrl == null) {
      return;
    }

    let cancelled = false;
    const version = avatarVersionFromUrl(user.avatarImageUrl);

    void window.api
      .getTeamHubUserAvatar(hubId, user.id, version)
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
  }, [hubId, user.id, user.avatarImageUrl]);

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

  const initials = user.avatarInitials ?? teamHubInitials(user.name);
  const colorClass = teamHubAvatarColorClassFromKey(user.avatarColor, user.id);
  const previewSrc =
    pendingImageDataUrl ?? (user.avatarImageUrl != null ? serverImageDataUrl : null);

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
        className={`relative flex items-center justify-center overflow-hidden rounded-md text-white ${
          isLarge ? 'h-48 w-48' : 'h-24 w-24'
        } ${previewSrc ? 'bg-muted' : colorClass} ${disabled ? 'opacity-60' : ''}`}
      >
        {previewSrc ? (
          <img src={previewSrc} alt="" className="h-full w-full object-cover" aria-hidden />
        ) : (
          <span
            className={`font-semibold leading-none ${isLarge ? 'text-[72px]' : 'text-[28px]'}`}
            aria-hidden
          >
            {initials}
          </span>
        )}
        <button
          type="button"
          className={`absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/55 text-white opacity-70 shadow-sm transition-opacity hover:opacity-90 focus-visible:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed ${
            isLarge ? 'h-9 w-9 text-[16px]' : 'h-8 w-8 text-[14px]'
          }`}
          aria-label="Change avatar"
          disabled={disabled}
          onClick={handleOpenPicker}
        >
          <FaIcon icon={faPen} className={isLarge ? 'h-4 w-4' : 'h-3.5 w-3.5'} aria-hidden />
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
