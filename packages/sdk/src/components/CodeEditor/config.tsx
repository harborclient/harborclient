import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useSyncExternalStore
} from '@harborclient/sdk/react';
import type { JSX, ReactNode } from 'react';
import { createExternalStore } from '../../runtime/store.js';
import type { CodeEditorSetup, CodeEditorTheme } from '../../types.js';
import {
  DEFAULT_CODE_EDITOR_FONT_SIZE,
  DEFAULT_CODE_EDITOR_SETUP
} from '../../ui/codeEditorSettings.js';

/**
 * Persisted CodeMirror theme and basicSetup options shared by all CodeEditor instances.
 */
export interface CodeEditorConfig {
  /**
   * CodeMirror syntax theme applied to editor instances.
   */
  theme: CodeEditorTheme;

  /**
   * CodeMirror basicSetup options for editable editor instances.
   */
  setup: CodeEditorSetup;

  /**
   * Editor font size applied to CodeMirror content and in-editor tooltips.
   */
  fontSize: string;
}

/**
 * Default CodeEditor configuration when no provider or store snapshot is available.
 */
export const DEFAULT_CODE_EDITOR_CONFIG: CodeEditorConfig = {
  theme: 'default',
  setup: DEFAULT_CODE_EDITOR_SETUP,
  fontSize: DEFAULT_CODE_EDITOR_FONT_SIZE
};

const GLOBAL_STORE_KEY = '__hc_codeEditorConfigStore';

type GlobalWithStore = typeof globalThis & {
  [GLOBAL_STORE_KEY]?: ReturnType<typeof createExternalStore<CodeEditorConfig>>;
};

/**
 * Returns the shared CodeEditor config store, creating it on first access.
 *
 * Stored on globalThis so host and plugin bundles share one store instance.
 */
export function getCodeEditorConfigStore(): ReturnType<
  typeof createExternalStore<CodeEditorConfig>
> {
  const globalRef = globalThis as GlobalWithStore;
  if (globalRef[GLOBAL_STORE_KEY] == null) {
    globalRef[GLOBAL_STORE_KEY] = createExternalStore(DEFAULT_CODE_EDITOR_CONFIG);
  }
  return globalRef[GLOBAL_STORE_KEY]!;
}

/**
 * Returns the CodeEditor React context, creating it on first access.
 *
 * Deferred so importing CodeEditor in a plugin bundle does not call requireHostReact()
 * before activate() runs installReact(hc.react).
 */
function getCodeEditorContext() {
  if (codeEditorContext == null) {
    codeEditorContext = createContext<CodeEditorConfig | null>(null);
  }
  return codeEditorContext;
}

/** Lazily initialized; use {@link getCodeEditorContext} instead of reading directly. */
let codeEditorContext: ReturnType<typeof createContext<CodeEditorConfig | null>> | null = null;

interface ProviderProps {
  /**
   * Theme and setup values to publish to context and the global store.
   */
  value: CodeEditorConfig;

  /**
   * Child components that may render CodeEditor instances.
   */
  children: ReactNode;
}

/**
 * Publishes CodeEditor theme/setup to React context and the cross-bundle global store.
 *
 * Wrap the HarborClient renderer root so host CodeEditor instances read settings from
 * context. Plugin bundles fall back to the global store snapshot published here.
 */
export function CodeEditorConfigProvider({ value, children }: ProviderProps): JSX.Element {
  const store = getCodeEditorConfigStore();

  /**
   * Mirrors the latest config into the global store for plugin bundle consumers.
   */
  useEffect(() => {
    store.setState(value);
  }, [store, value]);

  return createElement(getCodeEditorContext().Provider, { value }, children);
}

/**
 * Resolves CodeEditor theme/setup from React context, then the global store, then defaults.
 *
 * @returns Active CodeEditor configuration.
 */
export function useCodeEditorConfig(): CodeEditorConfig {
  const contextValue = useContext(getCodeEditorContext());
  const store = getCodeEditorConfigStore();
  const storeValue = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return contextValue ?? storeValue;
}
