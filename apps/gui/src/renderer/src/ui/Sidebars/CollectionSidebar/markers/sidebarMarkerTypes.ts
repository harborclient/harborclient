/**
 * Sidebar entity kinds that support optional marker coding.
 */
export type SidebarMarkerTarget =
  | { kind: 'collection'; id: number; marker: string | null }
  | { kind: 'folder'; collectionId: number; id: number; marker: string | null }
  | { kind: 'request'; collectionId: number; id: number; marker: string | null }
  | { kind: 'document'; collectionId: number; id: number; marker: string | null }
  | { kind: 'environment'; id: number; marker: string | null }
  | { kind: 'workspace'; id: number; marker: string | null };
