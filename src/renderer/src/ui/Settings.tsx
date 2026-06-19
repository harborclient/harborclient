import { useEffect, useState, type JSX } from 'react';
import type { ThemeSource } from '#/shared/types';
import { secondaryButton, segment, segmentGroup } from './classes';

interface Props {
  /**
   * Closes the settings view.
   */
  onClose: () => void;
}

const THEME_OPTIONS: Array<{ value: ThemeSource; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' }
];

/**
 * Full-area application settings: appearance and theme preference.
 */
export function Settings({ onClose }: Props): JSX.Element {
  const [theme, setTheme] = useState<ThemeSource>('system');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    window.api.getTheme().then((value) => {
      if (!cancelled) {
        setTheme(value);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Persists and applies the selected theme.
   *
   * @param next - Theme source to apply.
   */
  const handleThemeChange = async (next: ThemeSource): Promise<void> => {
    setTheme(next);
    await window.api.setTheme(next);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="m-0 text-[15px] font-semibold text-text">Settings</h1>
          <button className={secondaryButton} onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mb-6">
          <h2 className="m-0 mb-1 text-[13px] font-medium text-text">Appearance</h2>
          <p className="mb-3 text-[12px] text-muted">
            Choose light, dark, or match your system preference.
          </p>

          <div className={`${segmentGroup} w-full`}>
            {THEME_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={`${segment(theme === option.value)} flex-1`}
                disabled={loading}
                onClick={() => void handleThemeChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
