import { z } from 'zod';
import type { AuthConfig } from '../auth';
import type { KeyValue, Variable } from './common';
import type { ScriptRef } from './script';

/**
 * Page-load points at which a saved website injection script may run.
 */
export type WebsiteScriptRunAt = 'document-start' | 'dom-ready' | 'did-finish-load';

/**
 * One plain JavaScript injection script persisted with a website.
 */
export interface WebsiteInjectionScript {
  /**
   * Stable id within the website's script list.
   */
  id: string;

  /**
   * Display name shown in browser settings.
   */
  name: string;

  /**
   * When false, the script is skipped at injection time.
   */
  enabled: boolean;

  /**
   * Guest lifecycle hook that triggers this script.
   */
  runAt: WebsiteScriptRunAt;

  /**
   * JavaScript source executed in the page main world.
   */
  source: string;
}

/**
 * A saved embedded-browser website in the local registry.
 */
export interface Website {
  /**
   * Database primary key.
   */
  id: number;

  /**
   * Stable portable identifier for export/import.
   */
  uuid: string;

  /**
   * Display name shown in the sidebar (last page title).
   */
  name: string;

  /**
   * Last committed URL when the website was saved.
   */
  url: string;

  /**
   * Home URL for the browser Home button.
   */
  homeUrl: string;

  /**
   * Favicon as a data URL when available.
   */
  faviconDataUrl: string | null;

  /**
   * Applied injection scripts.
   */
  scripts: WebsiteInjectionScript[];

  /**
   * Applied pre-request hc.* scripts.
   */
  preRequestScripts: ScriptRef[];

  /**
   * Applied post-request hc.* scripts.
   */
  postRequestScripts: ScriptRef[];

  /**
   * Website-scoped variables for address-bar and script substitution.
   */
  variables: Variable[];

  /**
   * Headers sent with chrome-driven guest navigations.
   */
  headers: KeyValue[];

  /**
   * User-Agent override for chrome-driven navigations; empty uses Chromium default.
   */
  userAgent: string;

  /**
   * Authorization applied to chrome-driven guest navigations (Basic/Bearer).
   */
  auth: AuthConfig;

  /**
   * Creation timestamp in milliseconds since epoch.
   */
  createdAt: number;

  /**
   * Last update timestamp in milliseconds since epoch.
   */
  updatedAt: number;
}

/**
 * Input for creating a website in the local registry.
 */
export interface CreateWebsiteInput {
  /**
   * Display name for the website.
   */
  name: string;

  /**
   * Optional portable uuid; generated when omitted.
   */
  uuid?: string;

  /**
   * Last committed URL.
   */
  url: string;

  /**
   * Home URL for the browser Home button.
   */
  homeUrl: string;

  /**
   * Optional favicon data URL.
   */
  faviconDataUrl?: string | null;

  /**
   * Injection scripts to persist.
   */
  scripts?: WebsiteInjectionScript[];

  /**
   * Pre-request hc.* scripts to persist.
   */
  preRequestScripts?: ScriptRef[];

  /**
   * Post-request hc.* scripts to persist.
   */
  postRequestScripts?: ScriptRef[];

  /**
   * Website-scoped variables to persist.
   */
  variables?: Variable[];

  /**
   * Headers to persist for chrome-driven navigations.
   */
  headers?: KeyValue[];

  /**
   * User-Agent override to persist; empty uses Chromium default.
   */
  userAgent?: string;

  /**
   * Authorization settings to persist.
   */
  auth?: AuthConfig;
}

/**
 * Input for updating a website in the local registry.
 */
export interface UpdateWebsiteInput {
  /**
   * Database primary key of the website to update.
   */
  id: number;

  /**
   * Display name for the website.
   */
  name: string;

  /**
   * Last committed URL.
   */
  url: string;

  /**
   * Home URL for the browser Home button.
   */
  homeUrl: string;

  /**
   * Optional favicon data URL.
   */
  faviconDataUrl?: string | null;

  /**
   * Injection scripts to persist.
   */
  scripts: WebsiteInjectionScript[];

  /**
   * Pre-request hc.* scripts to persist.
   */
  preRequestScripts: ScriptRef[];

  /**
   * Post-request hc.* scripts to persist.
   */
  postRequestScripts: ScriptRef[];

  /**
   * Website-scoped variables to persist.
   */
  variables: Variable[];

  /**
   * Headers to persist for chrome-driven navigations.
   */
  headers: KeyValue[];

  /**
   * User-Agent override to persist; empty uses Chromium default.
   */
  userAgent: string;

  /**
   * Authorization settings to persist.
   */
  auth: AuthConfig;
}

/**
 * Portable HarborClient website export envelope.
 */
export interface WebsiteExport {
  /**
   * HarborClient export schema version.
   */
  harborclientVersion: 1;

  /**
   * Discriminator identifying this file as a website export.
   */
  harborclientExport: 'website';

  /**
   * Stable portable identifier.
   */
  uuid: string;

  /**
   * Display name for the website.
   */
  name: string;

  /**
   * Last committed URL.
   */
  url: string;

  /**
   * Home URL for the browser Home button.
   */
  homeUrl: string;

  /**
   * Favicon as a data URL when available.
   */
  faviconDataUrl?: string | null;

  /**
   * Injection scripts.
   */
  scripts?: WebsiteInjectionScript[];

  /**
   * Pre-request hc.* scripts.
   */
  pre_request_scripts?: ScriptRef[];

  /**
   * Post-request hc.* scripts.
   */
  post_request_scripts?: ScriptRef[];

  /**
   * Website-scoped variables.
   */
  variables?: Variable[];

  /**
   * Headers for chrome-driven navigations.
   */
  headers?: KeyValue[];

  /**
   * User-Agent override; empty uses Chromium default.
   */
  userAgent?: string;

  /**
   * Authorization settings (Basic/Bearer applied on guest navigations).
   */
  auth?: AuthConfig;
}

const websiteScriptRunAtSchema = z.enum(['document-start', 'dom-ready', 'did-finish-load']);

const websiteInjectionScriptSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string(),
  enabled: z.boolean(),
  runAt: websiteScriptRunAtSchema,
  source: z.string()
}) satisfies z.ZodType<WebsiteInjectionScript>;

const scriptStageSchema = z.enum(['before-all', 'before-each', 'main', 'after-each', 'after-all']);

const scriptRefSchema = z.discriminatedUnion('kind', [
  z.object({
    id: z.string().min(1),
    enabled: z.boolean(),
    kind: z.literal('inline'),
    name: z.string().optional(),
    code: z.string().optional(),
    expanded: z.boolean().optional(),
    stage: scriptStageSchema.optional()
  }),
  z.object({
    id: z.string().min(1),
    enabled: z.boolean(),
    kind: z.literal('snippet'),
    name: z.string().optional(),
    snippetUuid: z.string().min(1),
    expanded: z.boolean().optional(),
    stage: scriptStageSchema.optional()
  })
]) satisfies z.ZodType<ScriptRef>;

const variableSchema = z.object({
  key: z.string(),
  value: z.string(),
  defaultValue: z.string(),
  enabled: z.boolean(),
  share: z.boolean()
}) satisfies z.ZodType<Variable>;

const keyValueSchema = z.object({
  key: z.string(),
  value: z.string(),
  enabled: z.boolean()
}) satisfies z.ZodType<KeyValue>;

const authConfigSchema = z.object({
  type: z.enum(['none', 'basic', 'bearer', 'oauth2']),
  basic: z.object({
    username: z.string(),
    password: z.string()
  }),
  bearer: z.object({
    token: z.string()
  }),
  oauth2: z.object({
    tokenUrl: z.string(),
    clientId: z.string(),
    clientSecret: z.string(),
    scope: z.string(),
    audience: z.string(),
    clientAuth: z.enum(['body', 'header'])
  })
}) satisfies z.ZodType<AuthConfig>;

/**
 * Zod schema for validating website export files.
 */
export const websiteExportSchema = z.object({
  harborclientVersion: z.literal(1),
  harborclientExport: z.literal('website'),
  uuid: z.string().trim().min(1),
  name: z.string().trim().min(1),
  url: z.string(),
  homeUrl: z.string(),
  faviconDataUrl: z.union([z.string(), z.null()]).optional(),
  scripts: z.array(websiteInjectionScriptSchema).optional(),
  pre_request_scripts: z.array(scriptRefSchema).optional(),
  post_request_scripts: z.array(scriptRefSchema).optional(),
  variables: z.array(variableSchema).optional(),
  headers: z.array(keyValueSchema).optional(),
  userAgent: z.string().optional(),
  auth: authConfigSchema.optional()
}) satisfies z.ZodType<WebsiteExport>;

/**
 * Validates a parsed website export payload.
 *
 * @param data - Unknown parsed JSON.
 * @returns Normalized website export.
 * @throws When validation fails.
 */
export function validateWebsiteExport(data: unknown): WebsiteExport {
  return websiteExportSchema.parse(data);
}

/**
 * Builds a portable website export envelope.
 *
 * @param input - Website fields to serialize.
 * @returns Website export object.
 */
export function buildWebsiteExport(input: {
  uuid: string;
  name: string;
  url: string;
  homeUrl: string;
  faviconDataUrl?: string | null;
  scripts?: WebsiteInjectionScript[];
  preRequestScripts?: ScriptRef[];
  postRequestScripts?: ScriptRef[];
  variables?: Variable[];
  headers?: KeyValue[];
  userAgent?: string;
  auth?: AuthConfig;
}): WebsiteExport {
  return {
    harborclientVersion: 1,
    harborclientExport: 'website',
    uuid: input.uuid,
    name: input.name,
    url: input.url,
    homeUrl: input.homeUrl,
    ...(input.faviconDataUrl != null && input.faviconDataUrl !== ''
      ? { faviconDataUrl: input.faviconDataUrl }
      : { faviconDataUrl: null }),
    ...(input.scripts != null && input.scripts.length > 0 ? { scripts: input.scripts } : {}),
    ...(input.preRequestScripts != null && input.preRequestScripts.length > 0
      ? { pre_request_scripts: input.preRequestScripts }
      : {}),
    ...(input.postRequestScripts != null && input.postRequestScripts.length > 0
      ? { post_request_scripts: input.postRequestScripts }
      : {}),
    ...(input.variables != null && input.variables.length > 0
      ? { variables: input.variables }
      : {}),
    ...(input.headers != null && input.headers.length > 0 ? { headers: input.headers } : {}),
    ...(input.userAgent != null && input.userAgent.trim() !== ''
      ? { userAgent: input.userAgent }
      : {}),
    ...(input.auth != null && input.auth.type !== 'none' ? { auth: input.auth } : {})
  };
}
