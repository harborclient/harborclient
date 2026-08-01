import type { JSX, MouseEvent } from 'react';
import type { LogMatchOptions } from './logMatchOptions';

interface Props {
  /**
   * Current match-case / whole-word / regex toggles.
   */
  options: LogMatchOptions;

  /**
   * Called when any toggle changes.
   */
  onChange: (options: LogMatchOptions) => void;
}

interface ToggleSpec {
  /**
   * Field on {@link LogMatchOptions} this button controls.
   */
  key: keyof LogMatchOptions;

  /**
   * Accessible name for the toggle.
   */
  label: string;

  /**
   * Compact glyph shown inside the button.
   */
  glyph: string;

  /**
   * Extra classes for glyph styling (e.g. whole-word underline).
   */
  glyphClassName?: string;
}

const TOGGLES: ToggleSpec[] = [
  { key: 'matchCase', label: 'Match Case', glyph: 'Aa' },
  {
    key: 'matchWholeWord',
    label: 'Match Whole Word',
    glyph: 'ab',
    glyphClassName: 'underline decoration-1 underline-offset-2'
  },
  { key: 'useRegex', label: 'Use Regular Expression', glyph: '.*' }
];

/**
 * VS Code-style match toggles nested inside a log filter input.
 *
 * @param props - Current options and change handler.
 * @returns Row of compact aria-pressed toggle buttons.
 */
export function LogSearchToggles({ options, onChange }: Props): JSX.Element {
  /**
   * Keeps focus in the filter input when the user clicks a toggle.
   *
   * @param event - Mouse down on a toggle button.
   */
  const preserveInputFocus = (event: MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
  };

  return (
    <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-0.5">
      {TOGGLES.map((toggle) => {
        const pressed = options[toggle.key];
        return (
          <button
            key={toggle.key}
            type="button"
            aria-label={toggle.label}
            aria-pressed={pressed}
            title={toggle.label}
            className={`flex h-6 min-w-6 items-center justify-center rounded-sm border px-1 font-mono text-[14px] leading-none ${
              pressed
                ? 'border-accent bg-selection text-text'
                : 'border-transparent text-muted hover:border-separator hover:text-text'
            }`}
            onMouseDown={preserveInputFocus}
            onClick={() => {
              onChange({ ...options, [toggle.key]: !pressed });
            }}
          >
            <span className={toggle.glyphClassName} aria-hidden>
              {toggle.glyph}
            </span>
          </button>
        );
      })}
    </div>
  );
}
