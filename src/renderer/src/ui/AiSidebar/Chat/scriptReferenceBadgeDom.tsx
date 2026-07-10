import { FaIcon } from '@harborclient/sdk/components';
import { renderToStaticMarkup } from 'react-dom/server';
import { faCode, faXmark } from '#/renderer/src/fontawesome';

/** Shared Tailwind classes for script reference badges on neutral backgrounds. */
export const SCRIPT_REFERENCE_BADGE_CLASS =
  'hc-script-reference-badge inline-flex max-w-full items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 align-middle font-medium text-accent';

/** Badge styling for user message bubbles that use a solid accent background. */
export const SCRIPT_REFERENCE_BADGE_ON_ACCENT_CLASS =
  'hc-script-reference-badge inline-flex max-w-full items-center gap-1 rounded-full border border-white/30 bg-white/20 px-2 py-0.5 align-middle font-medium text-white';

export type ScriptReferenceBadgeVariant = 'default' | 'onAccent';

/**
 * Returns Tailwind classes for a script reference badge variant.
 *
 * @param variant - Default accent chip or white-on-accent chip for user bubbles.
 */
export function getScriptReferenceBadgeClass(variant: ScriptReferenceBadgeVariant): string {
  return variant === 'onAccent'
    ? SCRIPT_REFERENCE_BADGE_ON_ACCENT_CLASS
    : SCRIPT_REFERENCE_BADGE_CLASS;
}

/** Attribute marking the composer badge remove control for CodeMirror event handling. */
export const SCRIPT_REFERENCE_REMOVE_ATTR = 'data-script-reference-remove';

interface CreateScriptReferenceBadgeOptions {
  /**
   * When set, renders a dismiss button that removes the underlying `@` reference from the draft.
   */
  onRemove?: () => void;
}

/**
 * Builds the same badge markup used in React for CodeMirror widget decorations.
 *
 * @param label - Resolved script display name.
 * @param options - Optional composer-only controls such as a remove button.
 */
export function createScriptReferenceBadgeElement(
  label: string,
  options?: CreateScriptReferenceBadgeOptions
): HTMLSpanElement {
  const badge = document.createElement('span');
  badge.className = SCRIPT_REFERENCE_BADGE_CLASS;
  if (options?.onRemove == null) {
    badge.setAttribute('aria-hidden', 'true');
  }

  const icon = document.createElement('span');
  icon.className = 'inline-flex shrink-0';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = renderToStaticMarkup(
    <FaIcon icon={faCode} className="h-3.5 w-3.5 shrink-0" aria-hidden />
  );

  const text = document.createElement('span');
  text.className = 'truncate';
  text.setAttribute('aria-hidden', 'true');
  text.textContent = label;

  badge.append(icon, text);

  if (options?.onRemove != null) {
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className =
      'inline-flex shrink-0 rounded-sm text-muted hover:text-text focus-visible:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent';
    removeButton.setAttribute(SCRIPT_REFERENCE_REMOVE_ATTR, 'true');
    removeButton.setAttribute('aria-label', `Remove ${label}`);
    removeButton.innerHTML = renderToStaticMarkup(
      <FaIcon icon={faXmark} className="h-3 w-3" aria-hidden />
    );
    removeButton.addEventListener('mousedown', (event) => {
      event.preventDefault();
    });
    removeButton.addEventListener('click', (event) => {
      event.preventDefault();
      options.onRemove?.();
    });
    badge.append(removeButton);
  }

  return badge;
}
