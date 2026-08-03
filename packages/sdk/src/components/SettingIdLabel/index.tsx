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

  /**
   * Optional content between the label and the setting id (e.g. a cog actions menu).
   */
  afterLabel?: ReactNode;
}

/**
 * Setting label with a VS Code-style id affordance revealed on hover and focus.
 *
 * Renders as `<label> [afterLabel] <setting id>` so actions sit after the title
 * and before the hover-revealed id.
 */
export function SettingIdLabel({ children, settingId, afterLabel }: Props): JSX.Element {
  return (
    <span className="group/setting-label inline-flex min-w-0 items-center gap-2">
      <span>{children}</span>
      {afterLabel}
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
