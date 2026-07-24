import { useCallback, useId, useMemo, useRef, useState, type JSX, type KeyboardEvent } from 'react';
import { FaIcon } from '@harborclient/sdk/components';
import type { AiModelOption } from '#/shared/ai/models';
import { faChevronDown } from '#/renderer/src/fontawesome';
import { AiModelSelectMenu } from './AiModelSelectMenu';

interface Props {
  /**
   * Stable id for the trigger button.
   */
  'id': string;

  /**
   * Currently selected model selection key.
   */
  'value': string;

  /**
   * Models available for selection.
   */
  'models': AiModelOption[];

  /**
   * When true, the trigger cannot open the menu.
   */
  'disabled'?: boolean;

  /**
   * Additional classes merged onto the trigger button.
   */
  'className'?: string;

  /**
   * Accessible name for the control and listbox.
   */
  'aria-label': string;

  /**
   * Called when the user selects a model.
   *
   * @param nextValue - Selection key of the chosen model.
   */
  'onChange': (nextValue: string) => void;
}

/**
 * Themed AI model picker with grouped section headers.
 *
 * Uses a portaled listbox instead of a native `<select>` so Team Hub / Personal
 * headings follow HarborClient theme tokens.
 */
export function AiModelSelect({
  id,
  value,
  models,
  disabled = false,
  className,
  'aria-label': ariaLabel,
  onChange
}: Props): JSX.Element {
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null);
  const open = triggerElement != null;
  const selectedModel = useMemo(
    () => models.find((model) => model.value === value) ?? models[0],
    [models, value]
  );
  const selectedLabel = selectedModel?.label ?? 'Select model';
  const isDisabled = disabled || models.length === 0;

  /**
   * Closes the menu and restores focus to the trigger button.
   */
  const closeMenu = useCallback((): void => {
    setTriggerElement(null);
    queueMicrotask(() => {
      triggerRef.current?.focus();
    });
  }, []);

  /**
   * Applies a model selection, closes the menu, and restores trigger focus.
   *
   * @param nextValue - Selection key of the chosen model.
   */
  const handleSelect = useCallback(
    (nextValue: string): void => {
      onChange(nextValue);
      closeMenu();
    },
    [closeMenu, onChange]
  );

  /**
   * Opens the menu when the control is enabled and models are available.
   */
  const openMenu = useCallback((): void => {
    if (isDisabled || triggerRef.current == null) {
      return;
    }
    setTriggerElement(triggerRef.current);
  }, [isDisabled]);

  /**
   * Opens on ArrowDown / ArrowUp from the closed trigger.
   *
   * @param event - Keyboard event from the trigger button.
   */
  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openMenu();
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={isDisabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className={[
          'flex min-w-0 cursor-pointer items-center gap-1.5 border-none bg-transparent py-0 text-left text-muted app-no-drag',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => {
          if (open) {
            closeMenu();
            return;
          }
          openMenu();
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="min-w-0 flex-1 truncate">{selectedLabel}</span>
        <FaIcon icon={faChevronDown} className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
      </button>
      {triggerElement != null ? (
        <AiModelSelectMenu
          menuId={menuId}
          models={models}
          value={selectedModel?.value ?? value}
          aria-label={ariaLabel}
          triggerElement={triggerElement}
          onSelect={handleSelect}
          onClose={closeMenu}
        />
      ) : null}
    </>
  );
}
