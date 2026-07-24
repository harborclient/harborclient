import { buildTeamHubJoinUrl as buildApiTeamHubJoinUrl, summarizeInvitationAccess, type InvitationLinkParams } from '@harborclient/team-hub-api';
/**
 * Custom URL scheme registered by HarborClient for deep links from the web.
 */
export declare const HARBOR_PROTOCOL = "harborclient";
export { buildApiTeamHubJoinUrl as buildTeamHubJoinUrl, summarizeInvitationAccess, type InvitationLinkParams };
/**
 * Parsed HarborClient deep-link action dispatched to the renderer.
 */
export type HarborDeepLink = {
    action: 'install-plugin';
    pluginId: string;
} | {
    action: 'install-theme';
    pluginId: string;
} | {
    action: 'install-snippet';
    pluginId: string;
} | {
    action: 'open-run-results';
    uuid: string;
} | TeamHubJoinDeepLinkPayload;
/**
 * Parsed Team Hub join payload carried by HTTPS invite links and deep links.
 */
export interface TeamHubJoinDeepLinkPayload {
    action: 'join-team-hub';
    baseUrl: string;
    code: string;
    name?: string;
    role?: 'admin' | 'user';
    expiresAt?: string;
    hubName?: string;
    accessSummary?: string;
}
/**
 * Parses an HTTPS or harborclient:// Team Hub invite link into a join payload.
 *
 * @param url - Raw invite link pasted by the user or opened from a browser.
 * @returns Parsed join payload, or null when invalid.
 */
export declare function parseTeamHubInviteLink(url: string): TeamHubJoinDeepLinkPayload | null;
/**
 * Parses a harborclient:// URL into a supported deep-link action.
 *
 * Only plugin ids from the query string are trusted; repository URLs must be
 * resolved from the curated marketplace catalog inside the app.
 *
 * @param url - Raw URL from the OS protocol handler or launch argv.
 * @returns Parsed action, or null when the URL is unsupported or invalid.
 */
export declare function parseHarborDeepLink(url: string): HarborDeepLink | null;
/**
 * Builds a harborclient:// install URL for one marketplace plugin id.
 *
 * @param pluginId - Catalog plugin manifest id.
 * @returns Deep-link URL suitable for docs and external links.
 */
export declare function buildPluginInstallDeepLink(pluginId: string): string;
/**
 * Builds a harborclient:// install URL for one marketplace theme id.
 *
 * @param pluginId - Catalog theme manifest id.
 * @returns Deep-link URL suitable for docs and external links.
 */
export declare function buildThemeInstallDeepLink(pluginId: string): string;
/**
 * Builds a harborclient:// install URL for one marketplace snippet bundle id.
 *
 * @param pluginId - Catalog snippet bundle manifest id.
 * @returns Deep-link URL suitable for docs and external links.
 */
export declare function buildSnippetInstallDeepLink(pluginId: string): string;
/**
 * Builds a harborclient:// run-results URL for one saved snapshot UUID.
 *
 * @param uuid - Stable run result UUID from storage or a Team Hub share link.
 * @returns Deep-link URL suitable for clipboard copy and external links.
 */
export declare function buildRunResultsDeepLink(uuid: string): string;
/**
 * Builds a harborclient:// join URL for one Team Hub onboarding invitation.
 *
 * @param params - Invitation link parameters including display metadata.
 * @returns Deep-link URL suitable for launching HarborClient.
 */
export declare function buildTeamHubJoinDeepLink(params: InvitationLinkParams): string;
/**
 * Returns true when a join payload includes enough display metadata to skip preview.
 *
 * @param payload - Parsed join payload from an invite link.
 */
export declare function hasTeamHubJoinDisplayMetadata(payload: {
    name?: string;
    role?: 'admin' | 'user';
    expiresAt?: string;
}): boolean;
//# sourceMappingURL=deepLink.d.ts.map