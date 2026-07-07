import { Badge } from '@harborclient/sdk/components';
import type { BadgeVariant } from '@harborclient/sdk/components';
import { type JSX } from 'react';
import type { TeamHubServiceFlags } from '#/shared/types';

interface Props {
  /**
   * Hub server service flags for one connection.
   */
  services: TeamHubServiceFlags;

  /**
   * When true, renders badges in a muted scanning state.
   */
  scanning: boolean;
}

/**
 * One service badge label and availability flag.
 */
interface ServiceBadge {
  /**
   * Visible badge label.
   */
  label: string;

  /**
   * When true, the hub server provides this service.
   */
  active: boolean;
}

/**
 * Returns the badge variant for a service availability state.
 *
 * @param active - Whether the service is available on the hub server.
 * @param scanning - Whether the service scan is still running.
 * @param needsAttention - When true, storage works but this core service is missing.
 * @returns Badge color preset for the service label.
 */
function badgeVariant(active: boolean, scanning: boolean, needsAttention = false): BadgeVariant {
  if (scanning) {
    return 'muted';
  }

  if (needsAttention) {
    return 'muted';
  }

  if (!active) {
    return 'muted';
  }

  return 'success';
}

/**
 * Returns an accessible label for one service badge.
 *
 * @param badge - Service badge metadata.
 * @param scanning - Whether the service scan is still running.
 * @param needsAttention - When true, storage works but this core service is missing.
 */
function serviceBadgeAriaLabel(
  badge: ServiceBadge,
  scanning: boolean,
  needsAttention: boolean
): string {
  if (scanning) {
    return `${badge.label}: scanning`;
  }

  if (needsAttention) {
    return `${badge.label}: action required — hub server missing snippet storage routes`;
  }

  return `${badge.label}: ${badge.active ? 'available' : 'not available'}`;
}

/**
 * Renders Team Hub service badges for one hub row.
 */
export function TeamHubServiceBadges({ services, scanning }: Props): JSX.Element {
  const badges: ServiceBadge[] = [
    { label: 'Storage', active: services.storage },
    { label: 'LLM', active: services.llm },
    { label: 'Plugins', active: services.pluginCatalog },
    { label: 'Snippets', active: services.snippets }
  ];

  if (services.admin) {
    badges.push({ label: 'Admin', active: true });
  }

  return (
    <div
      className="mt-1 flex flex-wrap gap-1"
      aria-busy={scanning}
      aria-label={scanning ? 'Scanning hub services' : 'Hub services'}
    >
      {badges.map((badge) => {
        const snippetsNeedsAttention =
          badge.label === 'Snippets' && services.storage && !badge.active && !scanning;

        return (
          <span
            key={badge.label}
            aria-label={serviceBadgeAriaLabel(badge, scanning, snippetsNeedsAttention)}
          >
            <Badge variant={badgeVariant(badge.active, scanning, snippetsNeedsAttention)}>
              {badge.label}
            </Badge>
          </span>
        );
      })}
    </div>
  );
}
