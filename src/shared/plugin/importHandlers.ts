/**
 * File selected through **File → Import** and forwarded to plugin import handlers.
 *
 * Mirrors {@link ImportFile} from `@harborclient/sdk` until HarborClient depends on
 * a release that exports the symbol.
 */
export interface ImportFile {
  /**
   * Base file name including extension.
   */
  name: string;

  /**
   * Absolute path to the selected file.
   */
  path: string;

  /**
   * Normalized extension with a leading dot (for example `.json`).
   */
  extension: string;

  /**
   * Raw UTF-8 file contents.
   */
  contents: string;
}

/**
 * Callbacks registered for one import format.
 */
export interface ImportHandler {
  /**
   * Returns whether this handler should process the file.
   *
   * @param file - Selected import file from the host.
   */
  canImport: (file: ImportFile) => boolean | Promise<boolean>;

  /**
   * Performs the import workflow for a matched file.
   *
   * @param file - Selected import file from the host.
   */
  import: (file: ImportFile) => void | Promise<void>;
}

/**
 * **File → Import** handler registration on {@link PluginContext.imports}.
 */
export interface PluginImports {
  /**
   * Registers a handler for one or more file extensions.
   *
   * @param extensions - File extensions such as `.json` or `yaml`.
   * @param handler - Import detection and execution callbacks.
   */
  registerHandler: (
    extensions: string | string[],
    handler: ImportHandler
  ) => import('@harborclient/sdk').Disposable;
}

declare module '@harborclient/sdk' {
  /**
   * Renderer plugin API surface extended by HarborClient for import handlers.
   */
  interface PluginContext {
    /**
     * **File → Import** handler registration. Requires the `ui` permission.
     */
    imports: PluginImports;
  }
}
