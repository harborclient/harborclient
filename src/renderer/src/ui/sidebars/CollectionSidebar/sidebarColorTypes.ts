/**
 * Sidebar entity kinds that support optional color coding.
 */
export type SidebarColorTarget =
  | { kind: 'collection'; id: number; color: string | null }
  | { kind: 'folder'; collectionId: number; id: number; color: string | null }
  | { kind: 'request'; collectionId: number; id: number; color: string | null }
  | { kind: 'document'; collectionId: number; id: number; color: string | null }
  | { kind: 'environment'; id: number; color: string | null }
  | { kind: 'tabGroup'; id: number; color: string | null };
