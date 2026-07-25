import type { ComponentPropsWithoutRef, JSX } from 'react';
import { Input } from '../forms/index.js';
import { cn } from '../utils.js';
import { SuggestionList } from './SuggestionList.js';
import type { AutocompleteSource } from './types.js';
import { useAutocomplete } from './useAutocomplete.js';

export interface Props extends Omit<
  ComponentPropsWithoutRef<'input'>,
  'value' | 'onChange' | 'ref'
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
   * Optional async source for suggestions and persistence.
   */
  source?: AutocompleteSource;
}

/**
 * Text input with optional async autocomplete suggestions.
 */
export function AutocompleteInput({
  value,
  onChange,
  source,
  className,
  onFocus,
  onBlur,
  onKeyDown,
  ...props
}: Props): JSX.Element {
  const safeValue = value ?? '';

  const {
    open,
    items,
    activeIndex,
    anchorRef,
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
    onSelect: onChange
  });

  return (
    <>
      <Input
        {...props}
        ref={anchorRef}
        role={source ? 'combobox' : undefined}
        aria-autocomplete={source ? 'list' : undefined}
        aria-expanded={source ? open : undefined}
        aria-controls={source && open ? listboxId : undefined}
        aria-activedescendant={
          source && open && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
        }
        className={cn('hc-autocomplete-input', className)}
        value={safeValue}
        onChange={(event) => onChange(event.target.value)}
        onFocus={(event) => {
          openAutocomplete();
          onFocus?.(event);
        }}
        onBlur={(event) => {
          closeAutocomplete();
          onBlur?.(event);
        }}
        onKeyDown={(event) => {
          if (onInputKeyDown(event)) {
            return;
          }
          onKeyDown?.(event);
        }}
      />

      {source && (
        <SuggestionList
          open={open}
          items={items}
          activeIndex={activeIndex}
          anchorRef={anchorRef}
          listboxId={listboxId}
          onSelect={selectItem}
          onActiveIndexChange={setActiveIndex}
          onClose={closeSuggestions}
        />
      )}
    </>
  );
}
