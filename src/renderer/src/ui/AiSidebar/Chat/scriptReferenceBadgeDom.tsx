import { FaIcon } from '@harborclient/sdk/components';
import { renderToStaticMarkup } from 'react-dom/server';
import { faCode } from '#/renderer/src/fontawesome';

/** Shared Tailwind classes for script reference badges in chat UI. */
export const SCRIPT_REFERENCE_BADGE_CLASS =
  'hc-script-reference-badge inline-flex max-w-full items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 align-middle font-medium text-accent';

/**
 * Builds the same badge markup used in React for CodeMirror widget decorations.
 *
 * @param label - Resolved script display name.
 */
export function createScriptReferenceBadgeElement(label: string): HTMLSpanElement {
  const badge = document.createElement('span');
  badge.className = SCRIPT_REFERENCE_BADGE_CLASS;
  badge.setAttribute('aria-hidden', 'true');

  const icon = document.createElement('span');
  icon.className = 'inline-flex shrink-0';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = renderToStaticMarkup(
    <FaIcon icon={faCode} className="h-3.5 w-3.5 shrink-0" aria-hidden />
  );

  const text = document.createElement('span');
  text.className = 'truncate';
  text.textContent = label;

  badge.append(icon, text);
  return badge;
}
