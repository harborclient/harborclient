import { Button, Checkbox, Input, Modal, ModalFooter } from '@harborclient/sdk/components';
import { useCallback, useId, useState, type JSX } from 'react';
import type { OpenExternalLinkModalState } from '#/renderer/src/store/slices/modalsSlice';
import type { AppDispatch } from '#/renderer/src/store/redux';
import { resolveOpenExternalLinkConfirm } from './openExternalLinkHelpers';

interface Props {
  /**
   * Active open-external-link dialog state.
   */
  modal: OpenExternalLinkModalState;

  /**
   * Redux dispatch for modal resolution.
   */
  dispatch: AppDispatch;
}

/**
 * Confirmation UI before opening an external URL in the system browser.
 */
export function OpenExternalLinkModalContent({ modal, dispatch }: Props): JSX.Element {
  const urlInputId = useId();
  const trustDomainId = useId();
  const allowAllId = useId();
  const [trustDomain, setTrustDomain] = useState(false);
  const [allowAll, setAllowAll] = useState(false);

  /**
   * Dismisses the dialog without opening the link.
   */
  const handleCancel = useCallback((): void => {
    resolveOpenExternalLinkConfirm(dispatch, {
      confirmed: false,
      trustDomain: false,
      allowAll: false
    });
  }, [dispatch]);

  /**
   * Confirms opening the link and reports the selected trust options.
   */
  const handleConfirm = useCallback((): void => {
    resolveOpenExternalLinkConfirm(dispatch, {
      confirmed: true,
      trustDomain,
      allowAll
    });
  }, [allowAll, dispatch, trustDomain]);

  return (
    <Modal
      onClose={handleCancel}
      labelledBy="open-external-link-modal-title"
      title="Open external link?"
      className="w-[42rem]"
    >
      <div className="mb-4">
        <label htmlFor={urlInputId} className="mb-1 block text-muted">
          URL
        </label>
        <Input id={urlInputId} value={modal.url} className="w-full" readOnly />
      </div>
      <div className="mb-3 flex items-center gap-2">
        <Checkbox
          id={trustDomainId}
          checked={trustDomain}
          onChange={(event) => {
            const checked = event.target.checked;
            setTrustDomain(checked);
            if (checked) {
              setAllowAll(false);
            }
          }}
        />
        <label htmlFor={trustDomainId} className="text-muted">
          {"Don't show again for this domain"}
        </label>
      </div>
      <div className="mb-4 flex items-center gap-2">
        <Checkbox
          id={allowAllId}
          checked={allowAll}
          onChange={(event) => {
            const checked = event.target.checked;
            setAllowAll(checked);
            if (checked) {
              setTrustDomain(false);
            }
          }}
        />
        <label htmlFor={allowAllId} className="text-muted">
          {"Don't show for any domain"}
        </label>
      </div>
      <ModalFooter>
        <Button variant="primary" onClick={handleConfirm}>
          Open link
        </Button>
      </ModalFooter>
    </Modal>
  );
}
