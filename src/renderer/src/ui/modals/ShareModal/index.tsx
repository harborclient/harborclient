import { useCallback, type JSX } from 'react';
import toast from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  closeShareModal,
  selectShareModal,
  setShareRecipientKid
} from '#/renderer/src/store/slices/modalsSlice';
import { generateShareToken } from '#/renderer/src/store/thunks';
import { Button } from '#/renderer/src/components/Button';
import { field } from '#/renderer/src/ui/shared/classes';
import { Modal } from '#/renderer/src/ui/shared/Modal';

/**
 * Modal for generating and copying an encrypted collection share token.
 */
export function ShareModal(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const share = useAppSelector(selectShareModal);

  /**
   * Closes the share modal and clears generated token state.
   */
  const handleClose = useCallback((): void => {
    dispatch(closeShareModal());
  }, [dispatch]);

  if (!share) return null;

  return (
    <Modal onClose={handleClose} className="w-[32rem]" labelledBy="share-modal-title">
      <h2 id="share-modal-title" className="m-0 mb-1 text-[14px] font-semibold text-text">
        Share collection access
      </h2>
      <p className="mb-3 text-[14px] text-muted">
        Create an encrypted share token for &ldquo;{share.collectionName}&rdquo;. Only the selected
        recipient can decrypt it. Share tokens expire after seven days.
      </p>
      {share.trustedKeysLoading ? (
        <p className="text-[14px] text-muted">Loading trusted keys…</p>
      ) : share.trustedKeys.length === 0 ? (
        <p className="text-[14px] text-muted">
          Add the recipient&apos;s public key under File → Sharing Keys → Trusted keys before
          creating a share token.
        </p>
      ) : (
        <>
          <label className="mb-1 block text-[14px] font-medium text-text">Recipient</label>
          <select
            className={`${field} mb-3 w-full`}
            value={share.recipientKid}
            disabled={share.tokenLoading}
            onChange={(event) => dispatch(setShareRecipientKid(event.target.value))}
          >
            <option value="">Select a recipient…</option>
            {share.trustedKeys.map((key) => (
              <option key={key.id} value={key.id}>
                {key.label}
              </option>
            ))}
          </select>
        </>
      )}
      {share.tokenError && <p className="mb-3 text-[14px] text-danger">{share.tokenError}</p>}
      {share.tokenLoading ? (
        <p className="text-[14px] text-muted">Creating share token…</p>
      ) : share.token ? (
        <textarea
          className={`${field} min-h-28 w-full resize-y font-mono text-[14px]`}
          readOnly
          value={share.token}
          onFocus={(e) => e.target.select()}
        />
      ) : null}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={handleClose}>
          Close
        </Button>
        {!share.token && share.trustedKeys.length > 0 && (
          <Button
            disabled={!share.recipientKid || share.tokenLoading || share.trustedKeysLoading}
            onClick={() => void dispatch(generateShareToken())}
          >
            Create share token
          </Button>
        )}
        {share.token && (
          <Button
            disabled={share.tokenLoading}
            onClick={() => {
              void navigator.clipboard.writeText(share.token).then(
                () => toast.success('Share token copied'),
                () => toast.error('Failed to copy share token')
              );
            }}
          >
            Copy
          </Button>
        )}
      </div>
    </Modal>
  );
}
