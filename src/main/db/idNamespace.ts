/** Offset multiplier for namespacing per-backend numeric IDs. */
export const ID_OFFSET = 1_000_000_000;

/**
 * Encodes a backend slot and local id into a global id.
 *
 * @param slot - Backend slot index.
 * @param localId - Id within the backend.
 */
export function encodeGlobalId(slot: number, localId: number): number {
  return slot * ID_OFFSET + localId;
}

/**
 * Decodes a global id into backend slot and local id.
 *
 * @param globalId - Namespaced id exposed to the renderer.
 */
export function decodeGlobalId(globalId: number): { slot: number; localId: number } {
  return {
    slot: Math.floor(globalId / ID_OFFSET),
    localId: globalId % ID_OFFSET
  };
}
