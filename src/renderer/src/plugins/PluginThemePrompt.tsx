import { useEffect, type JSX } from 'react';
import toast from 'react-hot-toast';
import { usePluginThemes } from '#/renderer/src/plugins/pluginHooks';
import { applyPluginThemePreference } from '#/renderer/src/plugins/applyPluginTheme';
import { clearPendingThemePrompt, isPendingThemePrompt } from '#/renderer/src/plugins/pluginLoader';
import {
  isActivePluginTheme,
  markThemePrompted,
  selectThemePromptCandidates,
  themePromptKey
} from '#/renderer/src/plugins/pluginThemePromptLogic';
import { THEME_PROMPT_TOAST_LIVE_PROPS } from '#/renderer/src/ui/Shared/toastA11y';

/** Theme keys currently being offered so overlapping effect runs do not duplicate toasts. */
const inFlightThemePromptKeys = new Set<string>();

interface ThemePromptToastProps {
  /** Human-readable theme title shown in the offer. */
  title: string;

  /** Plugin manifest id for the theme being offered. */
  pluginId: string;

  /** Theme id within the plugin manifest. */
  themeId: string;

  /** react-hot-toast id used to dismiss this offer. */
  toastId: string;

  /** Dedupe key persisted when the user accepts or dismisses the offer. */
  promptKey: string;
}

/**
 * Non-blocking toast content offering to switch to a newly registered plugin theme.
 */
function ThemePromptToast({
  title,
  pluginId,
  themeId,
  toastId,
  promptKey
}: ThemePromptToastProps): JSX.Element {
  /**
   * Applies the offered theme and closes the toast.
   */
  const handleUseTheme = (): void => {
    void (async () => {
      try {
        await applyPluginThemePreference(pluginId, themeId);
        toast.success(`${title} applied.`);
      } catch (error) {
        console.error('Failed to apply plugin theme:', error);
      } finally {
        markThemePrompted(promptKey);
        toast.dismiss(toastId);
      }
    })();
  };

  /**
   * Dismisses the theme offer without changing the active theme.
   */
  const handleDismiss = (): void => {
    markThemePrompted(promptKey);
    toast.dismiss(toastId);
  };

  return (
    <div
      {...THEME_PROMPT_TOAST_LIVE_PROPS}
      className="flex max-w-sm flex-col gap-2 rounded-lg border border-separator bg-surface px-3 py-2 shadow-md"
    >
      <p className="text-[14px] text-text">Switch to {title}?</p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="rounded-md px-2 py-1 text-[14px] text-muted hover:text-text"
          aria-label={`Dismiss ${title} theme offer`}
          onClick={handleDismiss}
        >
          Not now
        </button>
        <button
          type="button"
          className="rounded-md bg-accent px-2 py-1 text-[14px] text-white hover:opacity-90"
          aria-label={`Use ${title} theme`}
          onClick={handleUseTheme}
        >
          Use theme
        </button>
      </div>
    </div>
  );
}

/**
 * Watches registered plugin themes and offers to switch when the user enables a plugin
 * that contributes themes.
 */
export function PluginThemePrompt(): null {
  const pluginThemes = usePluginThemes();

  /**
   * Offers to switch when user-enabled plugins register themes that have not been prompted.
   */
  useEffect(() => {
    let cancelled = false;

    const candidates = selectThemePromptCandidates(
      pluginThemes,
      isPendingThemePrompt,
      inFlightThemePromptKeys
    );

    if (candidates.length === 0) {
      return;
    }

    for (const theme of candidates) {
      inFlightThemePromptKeys.add(themePromptKey(theme.pluginId, theme.id));
    }

    void (async () => {
      const processedPluginIds = new Set<string>();

      try {
        const activeTheme = await window.api.getTheme();

        for (const theme of candidates) {
          if (cancelled) {
            return;
          }

          processedPluginIds.add(theme.pluginId);

          const key = themePromptKey(theme.pluginId, theme.id);
          if (isActivePluginTheme(activeTheme, theme.pluginId, theme.id)) {
            continue;
          }

          toast.custom(
            (toastInstance) => (
              <ThemePromptToast
                title={theme.title}
                pluginId={theme.pluginId}
                themeId={theme.id}
                toastId={toastInstance.id}
                promptKey={key}
              />
            ),
            { duration: Infinity, id: key }
          );
        }
      } finally {
        for (const theme of candidates) {
          inFlightThemePromptKeys.delete(themePromptKey(theme.pluginId, theme.id));
        }
        for (const pluginId of processedPluginIds) {
          clearPendingThemePrompt(pluginId);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pluginThemes]);

  return null;
}
