import { type BinaryLike, type CipherKey } from 'crypto';

/**
 * Type bridges between Node `Buffer` and strict `@types/node` crypto signatures.
 *
 * At runtime `Buffer` is a `Uint8Array` subclass and interoperates with crypto APIs.
 * Under strict TypeScript, parameters typed as `BinaryLike`, `CipherKey`, and
 * `readonly Uint8Array[]` do not structurally assign from `Buffer`. Centralize the
 * load-bearing double casts here so call sites stay clean and one file can be
 * audited when Node typings change.
 */

/**
 * Adapts a Node buffer for crypto APIs expecting `BinaryLike`.
 *
 * @param buffer - Buffer passed to a crypto API (IV, hash input, etc.).
 */
export function asBinaryLike(buffer: Buffer): BinaryLike {
  return buffer as unknown as BinaryLike;
}

/**
 * Adapts a Node buffer for crypto APIs expecting a symmetric `CipherKey`.
 *
 * @param buffer - Buffer used as an AES key or similar.
 */
export function asCipherKey(buffer: Buffer): CipherKey {
  return buffer as unknown as CipherKey;
}

/**
 * Adapts a Node buffer for crypto APIs expecting `ArrayBufferView`.
 *
 * @param buffer - Buffer passed to decipher update, auth tag, or RSA encrypt APIs.
 */
export function asArrayBufferView(buffer: Buffer): NodeJS.ArrayBufferView {
  return buffer as unknown as NodeJS.ArrayBufferView;
}

/**
 * Concatenates buffers via `Buffer.concat` with typings satisfied for strict mode.
 *
 * @param parts - Buffers to concatenate in order.
 */
export function concatBuffers(...parts: Buffer[]): Buffer {
  return Buffer.concat(parts as unknown as readonly Uint8Array[]);
}
