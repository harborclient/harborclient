import { type JSX } from 'react';
import type { TeamHubServiceFlags } from '#/shared/types';
import { Badge, type BadgeVariant } from '#/renderer/src/components/Badge';

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
 * @returns Badge color preset for the service label.
 */
function badgeVariant(active: boolean, scanning: boolean): BadgeVariant {
  if (scanning || !active) {
    return 'muted';
  }

  return 'success';
}

/**
 * Renders Team Hub service badges for one hub row.
 */
export function TeamHubServiceBadges({ services, scanning }: Props): JSX.Element {
  const badges: ServiceBadge[] = [
    { label: 'Storage', active: services.storage },
    { label: 'LLM', active: services.llm },
    { label: 'Plugins', active: services.pluginCatalog }
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
      {badges.map((badge) => (
        <span
          key={badge.label}
          aria-label={
            scanning
              ? `${badge.label}: scanning`
              : `${badge.label}: ${badge.active ? 'available' : 'not available'}`
          }
        >
          <Badge variant={badgeVariant(badge.active, scanning)}>{badge.label}</Badge>
        </span>
      ))}
    </div>
  );
}
