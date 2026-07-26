import { useAppDispatch } from '#/renderer/src/store/hooks';
import {
  setDocumentSidebarMarker,
  setFolderSidebarMarker,
  setSidebarItemMarker
} from '#/renderer/src/store/thunks/collections';
import { setRequestSidebarMarker } from '#/renderer/src/store/thunks/requests';
import { setEnvironmentSidebarMarker } from '#/renderer/src/store/thunks/environments';
import { setTabGroupSidebarMarker } from '#/renderer/src/store/thunks/tabGroups';
import type { SidebarMarkerTarget } from './sidebarMarkerTypes';

/**
 * Dispatches the appropriate thunk to persist a sidebar item marker.
 *
 * @param dispatch - Redux dispatch function.
 * @param target - Entity receiving the new marker.
 * @param marker - CSS marker string or null to clear.
 */
export function dispatchSidebarMarker(
  dispatch: ReturnType<typeof useAppDispatch>,
  target: SidebarMarkerTarget,
  marker: string | null
): void {
  switch (target.kind) {
    case 'collection':
      void dispatch(setSidebarItemMarker({ kind: 'collection', id: target.id, marker }));
      break;
    case 'folder':
      void dispatch(
        setFolderSidebarMarker({ collectionId: target.collectionId, id: target.id, marker })
      );
      break;
    case 'request':
      void dispatch(
        setRequestSidebarMarker({ collectionId: target.collectionId, id: target.id, marker })
      );
      break;
    case 'document':
      void dispatch(
        setDocumentSidebarMarker({ collectionId: target.collectionId, id: target.id, marker })
      );
      break;
    case 'environment':
      void dispatch(setEnvironmentSidebarMarker({ id: target.id, marker }));
      break;
    case 'tabGroup':
      void dispatch(setTabGroupSidebarMarker({ id: target.id, marker }));
      break;
    default:
      break;
  }
}
