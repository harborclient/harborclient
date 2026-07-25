import { useEffect, useId, useMemo, useRef, useState } from '@harborclient/sdk/react';
import type { ComponentPropsWithoutRef, JSX, KeyboardEvent, MouseEvent } from 'react';
import type { Variable } from '../../types.js';
import {
  getDynamicVariableDescription,
  getVariableTokenAtOffset,
  getVariableTooltipContent,
  resolveVariable,
  tokenizeVariables
} from '../../variables/index.js';
import { SuggestionList } from '../Autocomplete/SuggestionList.js';
import type { AutocompleteSource } from '../Autocomplete/types.js';
import { useAutocomplete } from '../Autocomplete/useAutocomplete.js';
import { Button } from '../Button/index.js';
import { VariableTooltipValue } from '../VariableTooltip/index.js';
import { Input } from '../forms/index.js';
import { getFocusableElements } from '../useDialogFocus.js';
import { cn } from '../utils.js';

interface TooltipState {
  key: string;
  value: string | undefined;
  dynamicDescription?: string;
  top: number;
  left: number;
}

type TooltipSource = 'hover' | 'focus';

/** Delay after the pointer stops moving before a hover tooltip is shown. */
const TOOLTIP_SHOW_DELAY_MS = 500;

/** Grace period before hiding so the pointer can reach the tooltip. */
const TOOLTIP_HIDE_DELAY_MS = 400;

export interface Props extends Omit<
  ComponentPropsWithoutRef<'div'>,
  'children' | 'className' | 'id' | 'aria-label' | 'aria-labelledby' | 'onKeyDown' | 'onChange'
> {
  /**
   * Current input value.
   */
  value: string;

  /**
   * Called when the value changes.
   */
  onChange: (value: string) => void;

  /**
   * Collection-scoped variables for highlighting and tooltips.
   */
  variables: Variable[];

  /**
   * Placeholder shown when value is empty.
   */
  placeholder?: string;

  /**
   * Optional keyboard handler (e.g. Enter to submit).
   */
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;

  /**
   * Additional classes applied to the input element.
   */
  className?: string;

  /**
   * Classes applied to the outer wrapper (e.g. field border and tint for table cells).
   */
  wrapperClassName?: string;

  /**
   * Opens settings to edit the hovered variable.
   *
   * @param key - Variable name from the hovered {{key}} token.
   */
  onEditVariable?: (key: string) => void;

  /**
   * DOM id forwarded to the underlying input for label association.
   */
  id?: string;

  /**
   * Accessible name when no visible label is associated via `htmlFor`.
   */
  'aria-label'?: string;

  /**
   * Id of the element that labels this input when using `aria-labelledby`.
   */
  'aria-labelledby'?: string;

  /**
   * Optional async source for value autocomplete suggestions.
   */
  source?: AutocompleteSource;
}

/**
 * Text input that highlights {{variable}} tokens and shows resolved values on hover.
 *
 * Token highlight color (`text-[#32D2E2]`) and the tooltip `app-no-drag` class rely on
 * host styling in HarborClient `styles.css`.
 */
export function VariableInput({
  value,
  onChange,
  variables,
  placeholder,
  onKeyDown,
  className = '',
  wrapperClassName,
  onEditVariable,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  source,
  ...props
}: Props): JSX.Element {
  const safeValue = value ?? '';
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const tokenButtonRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | null>(null);
  const showTimer = useRef<number | null>(null);
  const suppressReopen = useRef(false);
  const pendingEnterFocus = useRef(false);
  const tooltipEntered = useRef(false);
  const tooltipSourceRef = useRef<TooltipSource | null>(null);
  const activeTokenIndexRef = useRef<number | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [tooltipSource, setTooltipSource] = useState<TooltipSource | null>(null);
  const [activeTokenIndex, setActiveTokenIndex] = useState<number | null>(null);
  const tooltipId = useId();

  const {
    open: autocompleteOpen,
    items: autocompleteItems,
    activeIndex: autocompleteActiveIndex,
    listboxId,
    onFocus: openAutocomplete,
    onBlur: closeAutocomplete,
    onInputKeyDown,
    selectItem,
    setActiveIndex,
    closeSuggestions
  } = useAutocomplete({
    source,
    value: safeValue,
    onSelect: onChange,
    anchorRef: inputRef
  });

  /**
   * Splits the input value into plain text and {{variable}} token spans for highlighting.
   */
  const tokens = useMemo(() => tokenizeVariables(safeValue), [safeValue]);

  /**
   * Keeps tooltip refs aligned with React state for timer and document handlers.
   */
  useEffect(() => {
    tooltipSourceRef.current = tooltipSource;
    activeTokenIndexRef.current = activeTokenIndex;
  }, [tooltipSource, activeTokenIndex]);

  /**
   * Clears any pending tooltip hide timer.
   */
  const cancelHide = (): void => {
    if (hideTimer.current != null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  /**
   * Clears tooltip state regardless of source.
   */
  const dismissTooltip = (): void => {
    pendingEnterFocus.current = false;
    tooltipEntered.current = false;
    setTooltip(null);
    setTooltipSource(null);
    setActiveTokenIndex(null);
  };

  /**
   * Clears tooltip state and optionally refocuses the triggering token.
   *
   * @param refocusToken - When true, moves focus back to the active token without reopening.
   */
  const dismissFocusTooltip = (refocusToken = false): void => {
    const index = activeTokenIndexRef.current;
    dismissTooltip();

    if (refocusToken && index != null) {
      suppressReopen.current = true;
      tokenButtonRefs.current.get(index)?.focus();
    }
  };

  /**
   * Moves focus to the first control inside the open focus tooltip.
   */
  const focusFirstTooltipControl = (): void => {
    const tooltipEl = tooltipRef.current;
    if (!tooltipEl) {
      return;
    }

    getFocusableElements(tooltipEl)[0]?.focus();
    tooltipEntered.current = true;
  };

  /**
   * Hides the tooltip after a short grace period so the pointer can reach it.
   */
  const scheduleHide = (): void => {
    if (tooltipSourceRef.current === 'focus') {
      return;
    }

    cancelHide();
    hideTimer.current = window.setTimeout(() => {
      hideTimer.current = null;
      if (tooltipSourceRef.current === 'focus') {
        return;
      }
      dismissTooltip();
    }, TOOLTIP_HIDE_DELAY_MS);
  };

  /**
   * Clears any pending tooltip show timer.
   */
  const cancelShow = (): void => {
    if (showTimer.current != null) {
      window.clearTimeout(showTimer.current);
      showTimer.current = null;
    }
  };

  /**
   * Shows a tooltip for a variable token at the given screen position.
   */
  const showTooltipForKey = (
    key: string,
    top: number,
    left: number,
    source: TooltipSource,
    tokenIndex: number | null = null
  ): void => {
    setTooltip({
      key,
      value: resolveVariable(key, variables),
      dynamicDescription: getDynamicVariableDescription(key),
      top,
      left
    });
    setTooltipSource(source);
    setActiveTokenIndex(tokenIndex);
  };

  /**
   * Shows the tooltip once the pointer has stopped moving for {@link TOOLTIP_SHOW_DELAY_MS}.
   *
   * @param key - Variable name from the hovered {{key}} token.
   * @param top - Screen Y coordinate for tooltip placement.
   * @param left - Screen X coordinate for tooltip placement.
   */
  const scheduleShow = (key: string, top: number, left: number): void => {
    cancelShow();
    showTimer.current = window.setTimeout(() => {
      showTimer.current = null;
      showTooltipForKey(key, top, left, 'hover', null);
    }, TOOLTIP_SHOW_DELAY_MS);
  };

  /**
   * Clears pending tooltip timers when the component unmounts.
   */
  useEffect(
    () => () => {
      cancelHide();
      cancelShow();
    },
    []
  );

  /**
   * Traps Tab within the tooltip controls once focus has entered the tooltip.
   *
   * While focus is still on the token (tooltip open but not entered), Tab is left
   * alone so it moves naturally between variable tokens; only pressing Enter moves
   * focus into the tooltip and engages this trap.
   */
  useEffect(() => {
    if (tooltipSource !== 'focus' || activeTokenIndex == null || !tooltip) {
      return;
    }

    /**
     * Cycles Tab and Shift+Tab within the tooltip controls while focus is inside it.
     *
     * @param event - Document keydown event.
     */
    const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        dismissFocusTooltip(true);
        return;
      }

      if (event.key !== 'Tab' || !tooltipEntered.current) {
        return;
      }

      const tooltipEl = tooltipRef.current;
      if (!tooltipEl) {
        return;
      }

      const controls = getFocusableElements(tooltipEl);
      if (controls.length === 0) {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      const active = document.activeElement as HTMLElement | null;
      const index = active ? controls.indexOf(active) : -1;
      if (index === -1) {
        controls[0].focus();
        return;
      }

      const nextIndex = event.shiftKey
        ? (index - 1 + controls.length) % controls.length
        : (index + 1) % controls.length;
      controls[nextIndex]?.focus();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [tooltipSource, activeTokenIndex, tooltip]);

  /**
   * Moves focus into the tooltip after Enter opens it.
   */
  useEffect(() => {
    if (!pendingEnterFocus.current || tooltipSource !== 'focus' || !tooltip) {
      return;
    }

    pendingEnterFocus.current = false;
    focusFirstTooltipControl();
  }, [tooltip, tooltipSource]);

  /**
   * Keeps the colored backdrop aligned with horizontal scroll in the input.
   */
  const syncScroll = (): void => {
    const input = inputRef.current;
    const backdrop = backdropRef.current;
    if (input && backdrop) {
      backdrop.scrollLeft = input.scrollLeft;
    }
  };

  /**
   * Updates the tooltip based on the current text caret position.
   */
  const updateTooltipFromCaret = (): void => {
    if (tooltipSourceRef.current === 'focus') {
      return;
    }

    const input = inputRef.current;
    if (!input) return;

    const selectionStart = input.selectionStart ?? 0;
    const selectionEnd = input.selectionEnd ?? 0;
    if (selectionStart !== selectionEnd) {
      dismissTooltip();
      return;
    }

    const offset = selectionStart;
    const match = getVariableTokenAtOffset(safeValue, offset);
    if (!match) {
      dismissTooltip();
      return;
    }

    let tokenIndex = -1;
    let position = 0;
    for (const [index, token] of tokens.entries()) {
      if (token.key && position === match.start) {
        tokenIndex = index;
        break;
      }
      position += token.text.length;
    }

    const tokenButton = tokenIndex >= 0 ? tokenButtonRefs.current.get(tokenIndex) : undefined;
    if (tokenButton) {
      const rect = tokenButton.getBoundingClientRect();
      showTooltipForKey(match.key, rect.top, rect.left + rect.width / 2, 'hover', null);
      return;
    }

    const rect = input.getBoundingClientRect();
    showTooltipForKey(match.key, rect.top, rect.left + rect.width / 2, 'hover', null);
  };

  /**
   * Opens a focus-trapped tooltip for a keyboard-focused variable token.
   *
   * @param index - Token index within the rendered token list.
   * @param key - Variable name from the {{key}} token.
   * @param button - Focused token button element.
   */
  const handleTokenFocus = (index: number, key: string, button: HTMLButtonElement): void => {
    if (suppressReopen.current) {
      suppressReopen.current = false;
      return;
    }

    cancelHide();
    cancelShow();
    tooltipEntered.current = false;
    const rect = button.getBoundingClientRect();
    showTooltipForKey(key, rect.top, rect.left + rect.width / 2, 'focus', index);
  };

  /**
   * Handles keyboard interaction on a variable token button.
   */
  const handleTokenKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
    key: string
  ): void => {
    if (event.key === 'Escape' && tooltipSource === 'focus' && activeTokenIndex != null) {
      event.preventDefault();
      event.stopPropagation();
      dismissFocusTooltip(false);
      return;
    }

    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();

    if (tooltipSource === 'focus' && activeTokenIndex === index && tooltipRef.current) {
      focusFirstTooltipControl();
      return;
    }

    pendingEnterFocus.current = true;
    const button = tokenButtonRefs.current.get(index);
    if (!button) {
      pendingEnterFocus.current = false;
      return;
    }

    cancelHide();
    cancelShow();
    const rect = button.getBoundingClientRect();
    showTooltipForKey(key, rect.top, rect.left + rect.width / 2, 'focus', index);
  };

  /**
   * Shows a tooltip when the pointer rests over a variable token span.
   */
  const handleMouseMove = (e: MouseEvent<HTMLInputElement>): void => {
    if (tooltipSourceRef.current === 'focus') {
      return;
    }

    cancelHide();

    for (const [index, token] of tokens.entries()) {
      if (!token.key) continue;

      const tokenButton = tokenButtonRefs.current.get(index);
      if (!tokenButton) continue;

      const rect = tokenButton.getBoundingClientRect();
      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        scheduleShow(token.key, rect.top, rect.left + rect.width / 2);
        return;
      }
    }

    cancelShow();
    scheduleHide();
  };

  /**
   * Cancels a pending show and hides the tooltip when the pointer leaves the input.
   */
  const handleMouseLeave = (): void => {
    if (tooltipSourceRef.current === 'focus') {
      return;
    }

    cancelShow();
    scheduleHide();
  };

  /**
   * Closes any open tooltip when focus leaves the field.
   */
  const handleWrapperBlur = (): void => {
    const wrapper = wrapperRef.current;
    if (!wrapper) {
      return;
    }

    queueMicrotask(() => {
      if (!wrapper.contains(document.activeElement)) {
        cancelHide();
        cancelShow();
        dismissTooltip();
      }
    });
  };

  /**
   * Handles keyboard events on the input, including tooltip dismissal.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (onInputKeyDown(event)) {
      return;
    }

    if (event.key === 'Escape' && tooltip && tooltipSource !== 'focus') {
      event.preventDefault();
      dismissTooltip();
      return;
    }

    onKeyDown?.(event);
  };

  /**
   * Updates the tooltip after keyboard navigation moves the caret.
   */
  const handleKeyUp = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (
      event.key === 'ArrowLeft' ||
      event.key === 'ArrowRight' ||
      event.key === 'ArrowUp' ||
      event.key === 'ArrowDown' ||
      event.key === 'Home' ||
      event.key === 'End'
    ) {
      updateTooltipFromCaret();
    }
  };

  const tooltipContent = tooltip ? getVariableTooltipContent(tooltip.key, variables) : null;
  const focusTooltipOpen = tooltipSource === 'focus' && tooltip != null;

  return (
    <div
      {...props}
      ref={wrapperRef}
      className={cn('hc-variable-input relative min-w-0', wrapperClassName ?? 'flex-1')}
      onBlurCapture={handleWrapperBlur}
    >
      <div
        ref={backdropRef}
        className="hc-variable-input-backdrop pointer-events-none absolute inset-0 overflow-hidden px-2.5 py-1.5 whitespace-nowrap text-inherit"
      >
        {safeValue ? (
          tokens.map((token, index) =>
            token.key ? (
              <button
                key={`${index}-${token.text}`}
                type="button"
                ref={(el) => {
                  if (el) tokenButtonRefs.current.set(index, el);
                  else tokenButtonRefs.current.delete(index);
                }}
                tabIndex={0}
                aria-label={`Variable ${token.key}`}
                aria-expanded={focusTooltipOpen && activeTokenIndex === index ? true : undefined}
                aria-describedby={
                  focusTooltipOpen && activeTokenIndex === index ? tooltipId : undefined
                }
                className={cn(
                  'hc-variable-input-token hc-variable-input-token-variable font-inherit inline border-none bg-transparent p-0 text-[#32D2E2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent'
                )}
                onFocus={(event) => handleTokenFocus(index, token.key!, event.currentTarget)}
                onKeyDown={(event) => handleTokenKeyDown(event, index, token.key!)}
              >
                {token.text}
              </button>
            ) : (
              <span key={`${index}-${token.text}`} aria-hidden className="hc-variable-input-token">
                {token.text}
              </span>
            )
          )
        ) : (
          <span aria-hidden className="hc-variable-input-placeholder text-muted">
            {placeholder}
          </span>
        )}
      </div>

      <Input
        ref={inputRef}
        id={id}
        variant="plain"
        role={source ? 'combobox' : undefined}
        aria-autocomplete={source ? 'list' : undefined}
        aria-expanded={source ? autocompleteOpen : undefined}
        aria-controls={source && autocompleteOpen ? listboxId : undefined}
        aria-activedescendant={
          source && autocompleteOpen && autocompleteActiveIndex >= 0
            ? `${listboxId}-option-${autocompleteActiveIndex}`
            : undefined
        }
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={tooltip && tooltipSource !== 'focus' ? tooltipId : undefined}
        className={cn(
          'hc-variable-input-field relative w-full min-w-0 border-none bg-transparent px-2.5 py-1.5 text-transparent caret-text focus-visible:shadow-none',
          className
        )}
        type="text"
        placeholder={placeholder}
        value={safeValue}
        onChange={(e) => {
          onChange(e.target.value);
          queueMicrotask(updateTooltipFromCaret);
        }}
        onFocus={() => {
          if (tooltipSourceRef.current === 'focus') {
            dismissTooltip();
          }
          openAutocomplete();
        }}
        onBlur={closeAutocomplete}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onSelect={updateTooltipFromCaret}
        onClick={updateTooltipFromCaret}
        onScroll={syncScroll}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />

      {source && (
        <SuggestionList
          open={autocompleteOpen}
          items={autocompleteItems}
          activeIndex={autocompleteActiveIndex}
          anchorRef={inputRef}
          listboxId={listboxId}
          onSelect={selectItem}
          onActiveIndexChange={setActiveIndex}
          onClose={closeSuggestions}
        />
      )}

      {tooltip && tooltipContent && (
        <div
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          className="hc-variable-input-tooltip pointer-events-auto fixed z-50 flex max-w-sm -translate-x-1/2 -translate-y-full flex-col gap-2 rounded-lg border border-separator bg-surface px-4 py-3 text-text shadow-md after:pointer-events-auto after:absolute after:right-0 after:-bottom-2 after:left-0 after:h-2 after:content-['']"
          style={{ position: 'fixed', top: tooltip.top - 4, left: tooltip.left }}
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
        >
          <VariableTooltipValue
            value={tooltipContent.text}
            variableKey={tooltip.key}
            muted={tooltipContent.muted}
            onClose={() => {
              if (tooltipSource === 'focus') {
                dismissFocusTooltip(true);
              } else {
                dismissTooltip();
              }
            }}
          />
          {onEditVariable && (
            <Button
              variant="secondary"
              className="hc-variable-input-tooltip-edit self-start"
              aria-label={`Edit value for ${tooltip.key}`}
              onClick={() => {
                onEditVariable(tooltip.key);
                if (tooltipSource === 'focus') {
                  dismissFocusTooltip(true);
                } else {
                  dismissTooltip();
                }
              }}
            >
              Edit value
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
