import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import type { ShortcutBinding } from '#/shared/types';
import { formatAcceleratorDisplay } from '#/shared/shortcuts';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  closeShortcutsReferenceModal,
  selectShortcutsReferenceModal
} from '#/renderer/src/store/slices/modalsSlice';
import { openPageTab } from '#/renderer/src/store/slices/tabsSlice';
import { filterShortcutBindings } from '#/renderer/src/ui/Settings/ShortcutsSection/filterShortcutBindings';
import { Button, FormGroup, Input, Modal, ModalFooter } from '@harborclient/sdk/components';

/** Element id referenced by the footer Shortcuts button via `aria-controls`. */
export const SHORTCUTS_REFERENCE_MODAL_ID = 'shortcuts-reference-modal';

const SEARCH_INPUT_ID = 'shortcuts-reference-search';

interface ModalBodyProps {
  /** Dismisses the shortcuts reference modal. */
  onClose: () => void;
}

/**
 * Modal body that loads bindings on mount and renders the searchable shortcuts table.
 */
function ShortcutsReferenceModalBody({ onClose }: ModalBodyProps): JSX.Element {
  const dispatch = useAppDispatch();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [bindings, setBindings] = useState<ShortcutBinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  /**
   * Opens shortcut settings and closes the reference modal.
   */
  const handleCustomize = useCallback((): void => {
    dispatch(closeShortcutsReferenceModal());
    dispatch(openPageTab({ type: 'settings', section: 'shortcuts' }));
  }, [dispatch]);

  /**
   * Filters bindings by the current search query.
   */
  const filteredBindings = useMemo(
    () => filterShortcutBindings(bindings, query),
    [bindings, query]
  );

  /**
   * Loads resolved shortcut bindings when the modal body mounts.
   */
  useEffect(() => {
    let cancelled = false;

    void window.api.getShortcuts().then((value) => {
      if (!cancelled) {
        setBindings(value);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Focuses the search field once bindings have loaded.
   */
  useEffect(() => {
    if (loading) {
      return;
    }

    searchInputRef.current?.focus();
  }, [loading]);

  return (
    <Modal
      onClose={onClose}
      labelledBy="shortcuts-reference-title"
      title="Keyboard shortcuts"
      description="Search shortcuts by action name or key combination."
      className="w-[min(42rem,calc(100vw-2rem))]"
      overlayClassName="bg-black/35"
    >
      <div id={SHORTCUTS_REFERENCE_MODAL_ID} className="mb-4">
        <FormGroup
          label="Search shortcuts"
          htmlFor={SEARCH_INPUT_ID}
          srOnly
          className="mb-4 w-full"
        >
          <Input
            ref={searchInputRef}
            id={SEARCH_INPUT_ID}
            type="search"
            placeholder="Search shortcuts"
            value={query}
            className="w-full"
            onChange={(event) => setQuery(event.target.value)}
          />
        </FormGroup>

        {loading ? (
          <p className="text-muted" role="status">
            Loading shortcuts…
          </p>
        ) : (
          <>
            <div className="max-h-[min(24rem,50vh)] overflow-x-auto overflow-y-auto rounded-md border border-separator">
              <table className="w-full border-collapse text-[14px]">
                <caption className="sr-only">Keyboard shortcuts</caption>
                <thead className="sticky top-0 z-10 bg-surface">
                  <tr className="border-b border-separator bg-sidebar/40 text-left">
                    <th scope="col" className="px-3 py-2 font-medium text-text">
                      Shortcut
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium text-text text-right">
                      Key combination
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBindings.map((binding) => (
                    <tr key={binding.id} className="border-b border-separator last:border-b-0">
                      <td className="px-3 py-2 text-text">{binding.label}</td>
                      <td className="px-3 py-2 text-right">
                        <kbd className="font-normal text-text">
                          {formatAcceleratorDisplay(binding.accelerator)}
                        </kbd>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {query.trim().length > 0 && filteredBindings.length === 0 ? (
              <p className="mt-3 text-muted" role="status">
                No shortcuts match your search.
              </p>
            ) : null}
          </>
        )}
      </div>

      <ModalFooter>
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button type="button" variant="primary" onClick={handleCustomize}>
          Customize shortcuts
        </Button>
      </ModalFooter>
    </Modal>
  );
}

/**
 * Read-only keyboard shortcuts reference with search and a link to shortcut settings.
 */
export function ShortcutsReferenceModal(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const shortcutsReference = useAppSelector(selectShortcutsReferenceModal);

  /**
   * Closes the shortcuts reference modal.
   */
  const handleClose = useCallback((): void => {
    dispatch(closeShortcutsReferenceModal());
  }, [dispatch]);

  if (shortcutsReference?.open !== true) {
    return null;
  }

  return <ShortcutsReferenceModalBody key="shortcuts-reference" onClose={handleClose} />;
}
