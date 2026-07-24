import type { ThemeSource } from './types';
/**
 * One appearance theme entry shown in the View menu.
 */
export interface ThemeMenuOption {
  /** Persisted theme preference value. */
  value: ThemeSource;
  /** Human-readable label shown in the menu. */
  label: string;
}
/**
 * Built-in appearance themes always available without plugins.
 */
export declare const BUILTIN_THEME_OPTIONS: ThemeMenuOption[];
/**
 * Payload sent when the user selects an appearance theme from the View menu.
 */
export interface MenuSelectThemePayload {
  /** Persisted theme preference value the user selected. */
  theme: ThemeSource;
  /** Human-readable theme label for confirmation copy. */
  label: string;
}
//# sourceMappingURL=themes.d.ts.map
