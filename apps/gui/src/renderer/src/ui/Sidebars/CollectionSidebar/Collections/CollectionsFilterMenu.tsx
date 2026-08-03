import type { HttpMethod } from '@harborclient/core/types';
import {
  Button,
  FormGroup,
  Select,
  clampMenuPosition,
  getTriggerAnchoredMenuPosition,
  portalToBody,
  type MenuPosition
} from '@harborclient/sdk/components';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
  type ReactPortal
} from 'react';
import { useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectCollections,
  selectDocumentsByCollection,
  selectFoldersByCollection,
  selectRequestsByCollection
} from '#/renderer/src/store/selectors';
import { useSidebarExpansion } from '../expansion/useSidebarExpansion';
import { useSidebarProviders } from '../providers/sidebarProvidersContext';
import {
  collectCollectionsTreeMarkers,
  collectCollectionsTreeStorageLocations,
  EMPTY_COLLECTIONS_FILTER,
  type CollectionsFilterCriteria,
  type CollectionsFilterDocumentType
} from './collectionsFilter';
import { FilterMarkerSelect } from './FilterMarkerSelect';

/** Width of the collections filter form popover. */
const MENU_WIDTH_PX = 280;

/** Estimated height before the panel is measured. */
const MENU_HEIGHT_PX = 360;

/** HTTP methods and SSE offered in the method filter select. */
const FILTER_METHODS: Array<HttpMethod | 'SSE'> = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
  'SSE'
];

interface Props {
  /**
   * Filter toolbar button used to anchor the portaled form.
   */
  anchorRef: RefObject<HTMLElement | null>;

  /**
   * Currently applied collections filter criteria.
   */
  appliedFilter: CollectionsFilterCriteria;

  /**
   * Persists draft criteria as the applied filter and closes the menu.
   */
  onApply: (criteria: CollectionsFilterCriteria) => void;

  /**
   * Clears applied criteria and closes the menu.
   */
  onClear: () => void;

  /**
   * Closes the menu without applying draft changes.
   */
  onClose: () => void;
}

/**
 * Portaled form popover for filtering the Collections sidebar section by
 * storage location, HTTP method, document type, and marker.
 *
 * @param anchorRef - Filter toolbar button used for positioning.
 * @param appliedFilter - Currently applied criteria (seeds the draft on open).
 * @param onApply - Called when the user clicks Filter.
 * @param onClear - Called when the user clicks Clear.
 * @param onClose - Closes without applying when the user dismisses the dialog.
 */
export function CollectionsFilterMenu({
  anchorRef,
  appliedFilter,
  onApply,
  onClear,
  onClose
}: Props): ReactPortal | null {
  const reactId = useId();
  const titleId = `collections-filter-title-${reactId}`;
  const storageId = `collections-filter-storage-${reactId}`;
  const methodId = `collections-filter-method-${reactId}`;
  const documentTypeId = `collections-filter-doctype-${reactId}`;
  const colorId = `collections-filter-marker-${reactId}`;
  const panelRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLSelectElement>(null);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const [draft, setDraft] = useState<CollectionsFilterCriteria>(appliedFilter);

  const collections = useAppSelector(selectCollections);
  const foldersByCollection = useAppSelector(selectFoldersByCollection);
  const requestsByCollection = useAppSelector(selectRequestsByCollection);
  const documentsByCollection = useAppSelector(selectDocumentsByCollection);
  const { primaryConnectionId, connectionNamesById } = useSidebarProviders();
  const { showMarkers } = useSidebarExpansion();

  /**
   * Distinct storage locations used by collections currently in the sidebar tree.
   */
  const storageLocations = useMemo(
    () =>
      collectCollectionsTreeStorageLocations(collections, primaryConnectionId, connectionNamesById),
    [collections, connectionNamesById, primaryConnectionId]
  );

  /**
   * Distinct markers currently assigned in the collections tree.
   */
  const markers = useMemo(
    () =>
      collectCollectionsTreeMarkers({
        collections,
        foldersByCollection,
        requestsByCollection,
        documentsByCollection,
        primaryConnectionId
      }),
    [
      collections,
      documentsByCollection,
      foldersByCollection,
      primaryConnectionId,
      requestsByCollection
    ]
  );

  /**
   * Repositions the dialog under the filter toolbar button.
   */
  const updatePosition = useCallback((): void => {
    const anchor = anchorRef.current;
    if (!anchor) {
      setPosition(null);
      return;
    }
    const triggerRect = anchor.getBoundingClientRect();
    const menuSize = {
      width: MENU_WIDTH_PX,
      height: panelRef.current?.offsetHeight ?? MENU_HEIGHT_PX
    };
    const requested = getTriggerAnchoredMenuPosition(triggerRect, menuSize, 'down');
    setPosition(clampMenuPosition(requested, menuSize));
  }, [anchorRef]);

  /**
   * Anchors the dialog when it mounts and after layout changes.
   */
  useLayoutEffect(() => {
    updatePosition();
  }, [updatePosition, markers.length]);

  /**
   * Keeps fixed coordinates aligned when the sidebar or viewport moves.
   */
  useEffect(() => {
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [updatePosition]);

  /**
   * Moves focus onto the first field when the dialog mounts.
   */
  useEffect(() => {
    requestAnimationFrame(() => {
      firstFieldRef.current?.focus();
    });
  }, []);

  /**
   * Closes the dialog and returns focus to the filter toolbar button.
   */
  const closeMenu = useCallback((): void => {
    onClose();
    requestAnimationFrame(() => {
      anchorRef.current?.focus();
    });
  }, [anchorRef, onClose]);

  /**
   * Closes on outside pointer interaction or Escape.
   */
  useEffect(() => {
    /**
     * Closes when the user activates outside the anchor and portaled dialog.
     */
    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      const anchor = anchorRef.current;
      const menu = panelRef.current;
      if (anchor?.contains(target) || menu?.contains(target)) {
        return;
      }

      // Marker listbox is portaled beside the dialog; ignore clicks inside it.
      if (target instanceof Element && target.closest('.hc-collections-filter-marker-listbox')) {
        return;
      }

      closeMenu();
    };

    /**
     * Closes the dialog when the user presses Escape (unless a nested listbox handled it).
     */
    const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [anchorRef, closeMenu]);

  /**
   * Applies the draft criteria and closes the dialog.
   */
  const handleApply = useCallback((): void => {
    onApply(draft);
    requestAnimationFrame(() => {
      anchorRef.current?.focus();
    });
  }, [anchorRef, draft, onApply]);

  /**
   * Clears draft and applied criteria, then closes the dialog.
   */
  const handleClear = useCallback((): void => {
    setDraft(EMPTY_COLLECTIONS_FILTER);
    onClear();
    requestAnimationFrame(() => {
      anchorRef.current?.focus();
    });
  }, [anchorRef, onClear]);

  if (position == null) {
    return null;
  }

  return portalToBody(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="hc-collections-filter-menu app-no-drag fixed z-50 rounded-md border border-separator bg-surface p-3 shadow-md"
      style={{ top: position.y, left: position.x, width: MENU_WIDTH_PX }}
    >
      <h2 id={titleId} className="m-0 mb-3 text-[15px] font-medium text-text">
        Filter collections
      </h2>

      <div className="flex flex-col gap-2.5">
        <FormGroup label="Storage location" htmlFor={storageId} bordered={false} labelTone="muted">
          <Select
            ref={firstFieldRef}
            id={storageId}
            value={draft.storageLocationId ?? ''}
            onChange={(event) => {
              const next = event.target.value;
              setDraft((current) => ({
                ...current,
                storageLocationId: next === '' ? null : next
              }));
            }}
          >
            <option value="">All locations</option>
            {storageLocations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </Select>
        </FormGroup>

        <FormGroup label="Method" htmlFor={methodId} bordered={false} labelTone="muted">
          <Select
            id={methodId}
            value={draft.method ?? ''}
            onChange={(event) => {
              const next = event.target.value;
              setDraft((current) => ({
                ...current,
                method: next === '' ? null : (next as HttpMethod | 'SSE')
              }));
            }}
          >
            <option value="">All methods</option>
            {FILTER_METHODS.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </Select>
        </FormGroup>

        <FormGroup
          label="Document type"
          htmlFor={documentTypeId}
          bordered={false}
          labelTone="muted"
        >
          <Select
            id={documentTypeId}
            value={draft.documentType ?? ''}
            onChange={(event) => {
              const next = event.target.value;
              setDraft((current) => ({
                ...current,
                documentType: next === '' ? null : (next as CollectionsFilterDocumentType)
              }));
            }}
          >
            <option value="">All types</option>
            <option value="request">Request</option>
            <option value="document">Markdown</option>
          </Select>
        </FormGroup>

        {showMarkers && markers.length > 0 ? (
          <FormGroup label="Color marker" htmlFor={colorId} bordered={false} labelTone="muted">
            <FilterMarkerSelect
              id={colorId}
              value={draft.marker}
              markers={markers}
              onChange={(marker) => {
                setDraft((current) => ({ ...current, marker }));
              }}
            />
          </FormGroup>
        ) : null}
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <Button variant="secondary" onClick={handleClear}>
          Clear
        </Button>
        <Button variant="primary" onClick={handleApply}>
          Filter
        </Button>
      </div>
    </div>
  );
}
