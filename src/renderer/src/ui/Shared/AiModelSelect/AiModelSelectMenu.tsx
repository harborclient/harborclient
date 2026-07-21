import { useEffect, useLayoutEffect, useMemo, useRef, useState, type JSX } from 'react';
import { portalToBody } from '@harborclient/sdk/components';
import { groupAvailableModels, type AiModelOption } from '#/shared/ai/models';
import {
  computeAiModelSelectMenuPosition,
  type AiModelSelectMenuPosition
} from './aiModelSelectMenuPosition';

interface Props {
  /**
   * Stable DOM id for the listbox, referenced by the trigger `aria-controls`.
   */
  'menuId': string;

  /**
   * Models available for selection, grouped for display.
   */
  'models': AiModelOption[];

  /**
   * Currently selected model selection key.
   */
  'value': string;

  /**
   * Accessible name for the listbox.
   */
  'aria-label': string;

  /**
   * Trigger element used to anchor and size the menu.
   */
  'triggerElement': HTMLElement;

  /**
   * Called when the user picks a model.
   *
   * @param nextValue - Selection key of the chosen model.
   */
  'onSelect': (nextValue: string) => void;

  /**
   * Called when the menu should close without changing selection.
   */
  'onClose': () => void;
}

/**
 * Portaled listbox of AI models with themed section headers.
 */
export function AiModelSelectMenu({
  menuId,
  models,
  value,
  'aria-label': ariaLabel,
  triggerElement,
  onSelect,
  onClose
}: Props): JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null);
  const groups = useMemo(() => groupAvailableModels(models), [models]);
  const flatValues = useMemo(() => models.map((model) => model.value), [models]);
  const optionIndexByValue = useMemo(() => {
    const map = new Map<string, number>();
    models.forEach((model, index) => {
      map.set(model.value, index);
    });
    return map;
  }, [models]);
  const selectedIndex = Math.max(
    0,
    flatValues.findIndex((modelValue) => modelValue === value)
  );
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const [position, setPosition] = useState<AiModelSelectMenuPosition>(() => {
    const rect = triggerElement.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.bottom + 4,
      width: rect.width
    };
  });

  /**
   * Measures the menu after mount and repositions it relative to the trigger.
   */
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (menu == null) {
      return;
    }

    const anchor = triggerElement.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    setPosition(
      computeAiModelSelectMenuPosition(
        {
          left: anchor.left,
          top: anchor.top,
          bottom: anchor.bottom,
          width: anchor.width,
          height: anchor.height
        },
        { width: menuRect.width, height: menuRect.height }
      )
    );
  }, [models, triggerElement]);

  /**
   * Focuses the active option when the active index changes.
   */
  useEffect(() => {
    const option = menuRef.current?.querySelector<HTMLElement>(
      `[data-model-index="${activeIndex}"]`
    );
    option?.focus();
  }, [activeIndex]);

  /**
   * Closes on outside click or Escape while the menu is open.
   */
  useEffect(() => {
    /**
     * Closes the menu when the pointer lands outside the menu and trigger.
     *
     * @param event - Document mousedown event.
     */
    const handleMouseDown = (event: MouseEvent): void => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerElement.contains(target)) {
        return;
      }
      onClose();
    };

    /**
     * Handles Escape and arrow-key navigation for the listbox.
     *
     * @param event - Document keydown event.
     */
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }

      if (flatValues.length === 0) {
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        event.stopPropagation();
        setActiveIndex((index) => (index + 1) % flatValues.length);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        setActiveIndex((index) => (index - 1 + flatValues.length) % flatValues.length);
        return;
      }

      if (event.key === 'Home') {
        event.preventDefault();
        event.stopPropagation();
        setActiveIndex(0);
        return;
      }

      if (event.key === 'End') {
        event.preventDefault();
        event.stopPropagation();
        setActiveIndex(flatValues.length - 1);
        return;
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        const nextValue = flatValues[activeIndex];
        if (nextValue != null) {
          onSelect(nextValue);
        }
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [activeIndex, flatValues, onClose, onSelect, triggerElement]);

  return portalToBody(
    <div
      ref={menuRef}
      id={menuId}
      role="listbox"
      aria-label={ariaLabel}
      className="fixed z-50 max-h-64 overflow-y-auto rounded-md border border-separator bg-surface py-1 shadow-lg app-no-drag"
      style={{ left: position.left, top: position.top, width: position.width, minWidth: 200 }}
    >
      {groups.map((group) => (
        <div key={group.key}>
          <div
            role="presentation"
            className="bg-sidebar-section px-3 py-1.5 font-medium text-muted"
          >
            {group.label}
          </div>
          {group.models.map((model) => {
            const index = optionIndexByValue.get(model.value) ?? 0;
            const selected = model.value === value;
            const active = index === activeIndex;

            return (
              <button
                key={model.value}
                type="button"
                role="option"
                data-model-index={index}
                aria-selected={selected}
                tabIndex={active ? 0 : -1}
                className={`flex w-full cursor-pointer border-none px-3 py-1.5 text-left text-text app-no-drag ${
                  selected || active ? 'bg-selection' : 'bg-transparent hover:bg-selection'
                }`}
                onClick={() => {
                  onSelect(model.value);
                }}
                onMouseEnter={() => {
                  setActiveIndex(index);
                }}
              >
                <span className="min-w-0 flex-1 truncate">{model.label}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
