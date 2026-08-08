import type { CSSProperties, JSX } from 'react';
import type { TeamHubNoticeActor } from '@harborclient/core/types';
import { useTeamHubAvatarImage } from '#/renderer/src/ui/Shared/TeamHubAvatarImage/useTeamHubAvatarImage';
import { teamHubAvatarColorClassFromKey, teamHubInitials } from './teamHubInitials';

interface Props {
  /**
   * Actor metadata from a Team Hub notice row.
   */
  actor: TeamHubNoticeActor;

  /**
   * Team hub connection id used to fetch uploaded avatar images.
   */
  hubId?: string;
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
    'inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-[14px] font-semibold text-white';

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
export function TeamHubNoticeActorAvatar({ actor, hubId }: Props): JSX.Element {
  const initials = actor.avatar?.initials ?? teamHubInitials(actor.name);
  const presentation = resolveNoticeAvatarPresentation(actor);
  const imageDataUrl = useTeamHubAvatarImage(hubId, actor.id, actor.avatar?.imageUrl);

  return (
    <span className={presentation.className} style={presentation.style} aria-hidden>
      {imageDataUrl ? (
        <img src={imageDataUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );
}
