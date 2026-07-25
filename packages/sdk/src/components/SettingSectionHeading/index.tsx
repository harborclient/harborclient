import type { JSX, ReactNode } from 'react';
import { SettingIdLabel } from '../SettingIdLabel/index.js';
import { cn } from '../utils.js';

export interface Props {
  /**
   * Stable setting id shown on hover and keyboard focus beside the title.
   */
  settingId: string;

  /**
   * Visible section title text.
   */
  title: ReactNode;

  /**
   * Optional muted helper copy rendered below the title.
   */
  description?: ReactNode;

  /**
   * Extra classes on the outer wrapper.
   */
  className?: string;

  /**
   * Overrides the default title span classes.
   */
  titleClassName?: string;

  /**
   * Overrides the default description paragraph classes.
   */
  descriptionClassName?: string;
}

/**
 * Settings section heading that pairs a titled label with an optional description
 * and a hover-revealed setting id badge.
 */
export function SettingSectionHeading({
  settingId,
  title,
  description,
  className,
  titleClassName,
  descriptionClassName
}: Props): JSX.Element {
  return (
    <div className={className}>
      <span className={cn('text-[18px] font-medium text-text', titleClassName)}>
        <SettingIdLabel settingId={settingId}>{title}</SettingIdLabel>
      </span>
      {description != null && description !== '' ? (
        <p className={cn('m-0 mb-4 text-muted', descriptionClassName)}>{description}</p>
      ) : null}
    </div>
  );
}
