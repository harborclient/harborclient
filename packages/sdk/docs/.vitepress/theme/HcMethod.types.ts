/**
 * Shape of one public `hc.*` API entry in `hc_manifest.json`.
 */
export interface HcMethodParam {
  /**
   * Parameter or field name as shown in docs tables.
   */
  name: string;

  /**
   * TypeScript-ish type string for the docs table.
   */
  type: string;

  /**
   * Human-readable description of the parameter or field.
   */
  description: string;
}

/**
 * Code sample attached to an `hc.*` reference entry.
 */
export interface HcMethodExample {
  /**
   * Optional caption shown above the code block.
   */
  caption?: string;

  /**
   * Highlight language for the fence (default `typescript`).
   */
  lang?: string;

  /**
   * Source code body without surrounding fences.
   */
  code: string;
}

/**
 * One documented `hc.*` method or property keyed without the `hc.` prefix.
 */
export interface HcMethodEntry {
  /**
   * Full heading text used for anchors (for example `hc.ui.registerModal(modal)`).
   */
  title: string;

  /**
   * Default markdown heading level when the page does not override it.
   */
  level: 2 | 3 | 4;

  /**
   * First HarborClient desktop app version that ships this API.
   */
  since: string;

  /**
   * Required plugin permission when applicable (for example `ui`).
   */
  permission?: string;

  /**
   * TypeScript call signature string.
   */
  signature: string;

  /**
   * Matching `manifest.contributes.*` path when registration requires it.
   */
  manifest?: string;

  /**
   * Method arguments (not expanded contribution object fields).
   */
  params?: HcMethodParam[];

  /**
   * Expanded contribution / payload object fields shown in docs tables.
   */
  fields?: HcMethodParam[];

  /**
   * Prose description of the API.
   */
  description: string;

  /**
   * Optional code samples.
   */
  examples?: HcMethodExample[];

  /**
   * Related manifest keys (without `hc.` prefix).
   */
  seeAlso?: string[];
}

/**
 * Root map of `hc_manifest.json` (`ui.registerModal` → entry).
 */
export type HcManifest = Record<string, HcMethodEntry>;
