import type { Variable } from '../../types.js';
import { getVariableTooltipContent } from '../../variables/index.js';

const COPY_ICON_PATH =
  'M208 0H332.1c12.7 0 24.9 5.1 33.9 14.1l67.9 67.9c9 9 14.1 21.2 14.1 33.9V336c0 26.5-21.5 48-48 48H208c-26.5 0-48-21.5-48-48V48c0-26.5 21.5-48 48-48zM48 128h80v64H64v256h192v-32h64v48c0 26.5-21.5 48-48 48H48c-26.5 0-48-21.5-48-48V176c0-26.5 21.5-48 48-48z';

const CHECK_ICON_PATH =
  'M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z';

/**
 * Creates an inline SVG icon for imperative tooltip controls.
 *
 * @param path - SVG path data for the icon glyph.
 */
function createTooltipIcon(path: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 448 512');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('hc-variable-tooltip-copy-icon');

  const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  pathEl.setAttribute('fill', 'currentColor');
  pathEl.setAttribute('d', path);
  svg.appendChild(pathEl);

  return svg;
}

/**
 * Appends a readonly value field and copy button row to a variable tooltip container.
 *
 * @param parent - Tooltip root element receiving the value row.
 * @param value - Resolved value text to display and copy.
 * @param key - Variable name from the hovered token.
 * @param muted - Whether the value should use muted styling.
 */
export function appendVariableTooltipValueRow(
  parent: HTMLElement,
  value: string,
  key: string,
  muted: boolean
): void {
  const row = document.createElement('div');
  row.className = 'cm-variable-tooltip-value-row';

  const input = document.createElement('input');
  input.type = 'text';
  input.readOnly = true;
  input.value = value;
  input.className = 'cm-variable-tooltip-value';
  input.setAttribute('aria-label', `Resolved value for ${key}`);
  if (muted) {
    input.classList.add('cm-variable-tooltip-value-muted');
  }

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'cm-variable-tooltip-copy app-no-drag';
  copyBtn.setAttribute('aria-label', `Copy value for ${key}`);
  copyBtn.appendChild(createTooltipIcon(COPY_ICON_PATH));

  /**
   * Copies the resolved value and briefly swaps the icon to a check mark.
   */
  const handleCopy = (): void => {
    void navigator.clipboard.writeText(value).then(() => {
      copyBtn.replaceChildren(createTooltipIcon(CHECK_ICON_PATH));
      copyBtn.setAttribute('aria-label', `Copied value for ${key}`);
      window.setTimeout(() => {
        copyBtn.replaceChildren(createTooltipIcon(COPY_ICON_PATH));
        copyBtn.setAttribute('aria-label', `Copy value for ${key}`);
      }, 2000);
    });
  };

  copyBtn.addEventListener('mousedown', (event) => {
    event.preventDefault();
  });
  copyBtn.addEventListener('click', handleCopy);

  row.appendChild(input);
  row.appendChild(copyBtn);
  parent.appendChild(row);
}

/**
 * Builds DOM content for a CodeMirror variable hover tooltip.
 *
 * @param key - Variable name from the hovered {{key}} token.
 * @param variables - Variables used to resolve tooltip text.
 * @param onEditVariable - Optional callback to open variable settings.
 */
export function buildVariableTooltipDom(
  key: string,
  variables: Variable[],
  onEditVariable?: (key: string) => void
): HTMLDivElement {
  const content = getVariableTooltipContent(key, variables);
  const dom = document.createElement('div');
  dom.className = 'cm-variable-tooltip';

  appendVariableTooltipValueRow(dom, content.text, key, content.muted);

  if (onEditVariable) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Edit value';
    btn.className = 'cm-variable-tooltip-edit app-no-drag';
    btn.setAttribute('aria-label', `Edit value for ${key}`);
    btn.addEventListener('mousedown', (event) => {
      event.preventDefault();
      onEditVariable(key);
    });
    dom.appendChild(btn);
  }

  return dom;
}
