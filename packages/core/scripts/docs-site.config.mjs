/**
 * Site-level docs configuration used by link rewriting and CI comments.
 *
 * Edit these values when installing the vitepress-docs skill.
 */

/** @type {string} Public GitHub repository URL (no trailing slash). */
export const repoUrl = 'https://github.com/harborclient/harborclient';

/** @type {string} Default git branch for blob links. */
export const defaultBranch = 'main';

/**
 * Monorepo path of this package (no trailing slash).
 * Relative README links under the package are prefixed so blob URLs land on
 * `packages/core/...` instead of the repository root.
 */
export const packagePath = 'packages/core';

/** @type {string} GitHub blob URL prefix for source file links. */
export const repoBlobUrl = `${repoUrl}/blob/${defaultBranch}`;
