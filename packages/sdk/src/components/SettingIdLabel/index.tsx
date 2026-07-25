import type { JSX, ReactNode } from 'react';

export interface Props {
  /**
   * Visible setting label text.
   */
  children: ReactNode;

  /**
   * Stable setting id shown on hover and keyboard focus.
   */
  settingId: string;
}

/**
 * Setting label with a VS Code-style id affordance revealed on hover and focus.
 */
export function SettingIdLabel({ children, settingId }: Props): JSX.Element {
  return (
    <span className="group/setting-label inline-flex items-baseline gap-2">
      <span>{children}</span>
      <span
        className="pointer-events-none font-mono text-[14px] text-muted opacity-0 transition-opacity select-none group-focus-within/setting-label:opacity-100 group-hover/setting-label:opacity-100"
        title={settingId}
        aria-label={`Setting id: ${settingId}`}
      >
        {settingId}
      </span>
    </span>
  );
}
