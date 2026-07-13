import { Button, Card } from '@harborclient/sdk/components';
import { useMemo, type JSX } from 'react';
import type { ThemeColorToken } from '@harborclient/sdk';
import { formatCustomThemeValue } from '#/shared/plugin/customThemeExport';
import { CUSTOM_THEME_SWATCH_TOKENS, type CustomTheme } from '#/shared/types/customTheme';
import type { ThemeSource } from '#/shared/types';
import { applyThemePreference } from '#/renderer/src/plugins/themeRuntime';
import { toolbarDangerButtonClass } from '#/renderer/src/ui/shared/classes';
import { getDefaultCustomThemePalette } from '#/renderer/src/ui/Plugins/customThemeDefaults';

interface Props {
  /**
   * Saved custom theme metadata and palette.
   */
  theme: CustomTheme;

  /**
   * Currently active appearance theme preference.
   */
  activeTheme: ThemeSource;

  /**
   * Opens this theme in the Designer for editing.
   */
  onEdit: (id: string) => void;

  /**
   * Uninstalls this theme after confirmation in the parent.
   */
  onDelete: (theme: CustomTheme) => void;

  /**
   * Restores one built-in theme to its packaged canonical palette.
   */
  onRestore?: (theme: CustomTheme) => void;

  /**
   * Refreshes the installed custom theme list after Use or delete fallbacks.
   */
  onThemesChanged: () => void;
}

/**
 * Resolves a swatch color for preview, falling back to the theme type defaults.
 *
 * @param theme - Saved custom theme.
 * @param token - Token key to render in the swatch grid.
 * @returns CSS color string for the swatch cell.
 */
function resolveSwatchColor(theme: CustomTheme, token: ThemeColorToken): string {
  return theme.colors[token] ?? getDefaultCustomThemePalette(theme.type)[token];
}

/**
 * Returns the persisted theme preference value for one installed theme card.
 *
 * @param theme - Saved custom or built-in theme.
 * @returns Theme source stored via theme:get/set.
 */
function resolveThemePreferenceValue(theme: CustomTheme): ThemeSource {
  if (theme.builtin) {
    return theme.id as ThemeSource;
  }

  return formatCustomThemeValue(theme.id);
}

/**
 * Installed custom theme card with a 4x4 swatch preview and Use/Edit/Uninstall actions.
 */
export function CustomThemeCard({
  theme,
  activeTheme,
  onEdit,
  onDelete,
  onRestore,
  onThemesChanged
}: Props): JSX.Element {
  const themeValue = resolveThemePreferenceValue(theme);
  const isActive = activeTheme === themeValue;
  const swatchColors = useMemo(
    () => CUSTOM_THEME_SWATCH_TOKENS.map((token) => resolveSwatchColor(theme, token)),
    [theme]
  );

  /**
   * Applies this theme as the active appearance preference.
   */
  const handleUse = (): void => {
    void (async () => {
      await window.api.setTheme(themeValue);
      await applyThemePreference(themeValue);
      onThemesChanged();
    })();
  };

  return (
    <li className="h-full">
      <Card aria-current={isActive ? 'true' : undefined}>
        <div
          className="grid aspect-video w-full grid-cols-4 grid-rows-4 border-b border-separator"
          aria-label={`${theme.title} color preview`}
        >
          {swatchColors.map((color, index) => (
            <div
              key={`${theme.id}-${CUSTOM_THEME_SWATCH_TOKENS[index]}`}
              className="min-h-0 min-w-0"
              style={{ backgroundColor: color }}
              aria-hidden
            />
          ))}
        </div>

        <Card.Body className="flex flex-1 flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="m-0 min-w-0 truncate text-[14px] font-semibold text-text">
              {theme.title}
            </h3>
            <span className="shrink-0 text-[14px] text-muted capitalize">
              {theme.type === 'high-contrast' ? 'High contrast' : theme.type}
            </span>
          </div>
          {isActive ? (
            <span className="text-[14px] text-accent" role="status">
              Active theme
            </span>
          ) : null}
        </Card.Body>

        <div className="mt-auto flex flex-wrap gap-2 border-t border-separator p-3">
          <Button
            type="button"
            variant="toolbar"
            className="min-w-0 flex-1 justify-center"
            aria-label={`Use ${theme.title}`}
            onClick={handleUse}
          >
            Use
          </Button>
          <Button
            type="button"
            variant="toolbar"
            className="min-w-0 flex-1 justify-center"
            aria-label={`Edit ${theme.title}`}
            onClick={() => onEdit(theme.id)}
          >
            Edit
          </Button>
          {theme.builtin ? (
            <Button
              type="button"
              variant="toolbar"
              className="min-w-0 flex-1 justify-center"
              aria-label={`Restore ${theme.title}`}
              onClick={() => onRestore?.(theme)}
            >
              Restore
            </Button>
          ) : (
            <Button
              type="button"
              variant="toolbar"
              className={`min-w-0 flex-1 justify-center ${toolbarDangerButtonClass}`}
              aria-label={`Uninstall ${theme.title}`}
              onClick={() => onDelete(theme)}
            >
              Uninstall
            </Button>
          )}
        </div>
      </Card>
    </li>
  );
}
