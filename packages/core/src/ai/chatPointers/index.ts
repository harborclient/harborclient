/**
 * Chat-pointer registry public surface.
 */

export * from './types.js';
export * from './registry.js';
export * from './shared.js';
export * from './pluginToken.js';
export * from './pluginMatch.js';
export * from './customPluginPointer.js';
export * from './consolePointer.js';
export {
  registerBuiltinChatPointers,
  reinstallBuiltinChatPointersForTests,
  bindBuiltinChatPointerHandlers
} from './builtins/index.js';
