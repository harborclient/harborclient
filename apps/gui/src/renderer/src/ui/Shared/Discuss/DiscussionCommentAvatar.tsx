import type { JSX } from 'react';
import type { CSSProperties } from 'react';
import type { TeamHubDiscussionAuthor } from '@harborclient/core/types';
import { teamHubAvatarColorClassFromKey } from '../../Sidebars/CollectionSidebar/shell/TeamHubRailAvatars/teamHubInitials';
import { useTeamHubAvatarImage } from '../TeamHubAvatarImage/useTeamHubAvatarImage';

interface Props {
  /**
   * Author metadata returned with a discussion comment.
   */
  author: TeamHubDiscussionAuthor;

  /**
   * Team hub connection id used to fetch uploaded avatar images.
   */
  hubId?: string;
}

/**
 * Derives fallback avatar initials from a display name.
 *
 * @param name - Author display name.
 */
function fallbackInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]!.charAt(0)}${parts[1]!.charAt(0)}`.toUpperCase();
}

/**
 * Resolves Tailwind background class or inline accent color for a discussion author.
 *
 * @param author - Discussion author metadata from the Team Hub API.
 * @returns Background class when a palette key is present, otherwise inline accent style.
 */
function resolveDiscussionAvatarPresentation(author: TeamHubDiscussionAuthor): {
  className: string;
  style?: CSSProperties;
} {
  const baseClass =
    'inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-[14px] font-semibold text-white';

  if (author.avatar?.color) {
    return {
      className: `${baseClass} ${teamHubAvatarColorClassFromKey(author.avatar.color, author.id)}`
    };
  }

  return {
    className: baseClass,
    style: { backgroundColor: 'var(--mac-accent)' }
  };
}

/**
 * Renders a discussion author's avatar badge using hub-provided metadata when available.
 */
export function DiscussionCommentAvatar({ author, hubId }: Props): JSX.Element {
  const initials = author.avatar?.initials ?? fallbackInitials(author.name);
  const presentation = resolveDiscussionAvatarPresentation(author);
  const imageDataUrl = useTeamHubAvatarImage(hubId, author.id, author.avatar?.imageUrl);

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
