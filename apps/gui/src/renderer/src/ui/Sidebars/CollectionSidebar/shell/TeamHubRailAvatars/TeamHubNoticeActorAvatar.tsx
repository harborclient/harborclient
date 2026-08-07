import type { CSSProperties, JSX } from 'react';
import type { TeamHubNoticeActor } from '@harborclient/core/types';
import { teamHubAvatarColorClassFromKey, teamHubInitials } from './teamHubInitials';

interface Props {
  /**
   * Actor metadata from a Team Hub notice row.
   */
  actor: TeamHubNoticeActor;
}

/**
 * Resolves Tailwind background class or inline accent color for a notice actor.
 *
 * @param actor - Notice actor metadata from the Team Hub API.
 * @returns Background class when a palette key is present, otherwise inline accent style.
 */
function resolveNoticeAvatarPresentation(actor: TeamHubNoticeActor): {
  className: string;
  style?: CSSProperties;
} {
  const baseClass =
    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold text-white';

  if (actor.avatar?.color) {
    return {
      className: `${baseClass} ${teamHubAvatarColorClassFromKey(actor.avatar.color, actor.id)}`
    };
  }

  return {
    className: baseClass,
    style: { backgroundColor: 'var(--mac-accent)' }
  };
}

/**
 * Renders a notice actor avatar using nested Team Hub avatar metadata with fallbacks.
 */
export function TeamHubNoticeActorAvatar({ actor }: Props): JSX.Element {
  const initials = actor.avatar?.initials ?? teamHubInitials(actor.name);
  const presentation = resolveNoticeAvatarPresentation(actor);

  return (
    <span className={presentation.className} style={presentation.style} aria-hidden>
      {initials}
    </span>
  );
}
