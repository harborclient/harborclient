import { useAppDispatch } from '#/renderer/src/store/hooks';
import {
  setDocumentSidebarColor,
  setFolderSidebarColor,
  setSidebarItemColor
} from '#/renderer/src/store/thunks/collections';
import { setRequestSidebarColor } from '#/renderer/src/store/thunks/requests';
import { setEnvironmentSidebarColor } from '#/renderer/src/store/thunks/environments';
import { setTabGroupSidebarColor } from '#/renderer/src/store/thunks/tabGroups';
import type { SidebarColorTarget } from './sidebarColorTypes';

/**
 * Dispatches the appropriate thunk to persist a sidebar item color.
 *
 * @param dispatch - Redux dispatch function.
 * @param target - Entity receiving the new color.
 * @param color - CSS color string or null to clear.
 */
export function dispatchSidebarColor(
  dispatch: ReturnType<typeof useAppDispatch>,
  target: SidebarColorTarget,
  color: string | null
): void {
  switch (target.kind) {
    case 'collection':
      void dispatch(setSidebarItemColor({ kind: 'collection', id: target.id, color }));
      break;
    case 'folder':
      void dispatch(
        setFolderSidebarColor({ collectionId: target.collectionId, id: target.id, color })
      );
      break;
    case 'request':
      void dispatch(
        setRequestSidebarColor({ collectionId: target.collectionId, id: target.id, color })
      );
      break;
    case 'document':
      void dispatch(
        setDocumentSidebarColor({ collectionId: target.collectionId, id: target.id, color })
      );
      break;
    case 'environment':
      void dispatch(setEnvironmentSidebarColor({ id: target.id, color }));
      break;
    case 'tabGroup':
      void dispatch(setTabGroupSidebarColor({ id: target.id, color }));
      break;
    default:
      break;
  }
}
