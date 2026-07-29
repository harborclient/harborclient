/**
 * Chat-pointer registry public surface.
 */

export * from './types.js';
export * from './registry.js';
export * from './shared.js';
export * from './pluginToken.js';
export {
  registerBuiltinChatPointers,
  reinstallBuiltinChatPointersForTests,
  bindBuiltinChatPointerHandlers
} from './builtins/index.js';
