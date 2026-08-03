import { z } from 'zod';
import type { GeneralSettingsAiPatch } from '../generalSettingsForAi.js';
import type { ITool } from './ITool';

/**
 * Arguments for the update_general_settings tool (partial General Settings patch).
 */
export type UpdateGeneralSettingsToolArgs = GeneralSettingsAiPatch;

/**
 * Shared JSON Schema fragment for a trusted external-domain row.
 */
const TRUSTED_DOMAIN_SCHEMA = {
  type: 'object',
  properties: {
    domain: { type: 'string', description: 'Hostname (for example developer.mozilla.org).' },
    enabled: {
      type: 'boolean',
      description: 'When true, links to this domain skip confirmation.'
    }
  },
  required: ['domain', 'enabled'],
  additionalProperties: false
} as const;

/**
 * Shared JSON Schema fragment for a global variable row.
 */
const GLOBAL_VARIABLE_SCHEMA = {
  type: 'object',
  properties: {
    key: { type: 'string', description: 'Variable name referenced in {{key}} placeholders.' },
    value: { type: 'string', description: 'Value substituted when the variable is resolved.' },
    defaultValue: {
      type: 'string',
      description: 'Fallback value used when value is empty.'
    },
    enabled: {
      type: 'boolean',
      description: 'When false, the row is ignored so a parent scope can pass through.'
    },
    share: {
      type: 'boolean',
      description: 'When true, value is included in collection exports.'
    }
  },
  required: ['key', 'value', 'defaultValue', 'enabled', 'share'],
  additionalProperties: false
} as const;

/**
 * Editor tab identifiers that can appear in dismissedRequestEditorNotices.
 */
const EDITOR_TAB_ENUM = [
  'params',
  'headers',
  'auth',
  'cookies',
  'body',
  'pre',
  'post',
  'comment'
] as const;

/**
 * Live Server panel tab identifiers that can appear in dismissedLiveServerNotices.
 */
const LIVE_SERVER_SETTINGS_TAB_ENUM = [
  'general',
  'proxy',
  'headers',
  'routing',
  'run',
  'ssl',
  'scripts'
] as const;

/**
 * CodeMirror theme identifiers accepted by update_general_settings.
 */
const CODE_EDITOR_THEME_ENUM = [
  'default',
  'dracula',
  'githubLight',
  'githubDark',
  'monokai',
  'nord',
  'solarizedLight',
  'tokyoNight'
] as const;

/**
 * Zod schema for a trusted external-domain row.
 */
const trustedDomainShape = z.object({
  domain: z.string(),
  enabled: z.boolean()
});

/**
 * Zod schema for a global variable row.
 */
const globalVariableShape = z.object({
  key: z.string(),
  value: z.string(),
  defaultValue: z.string(),
  enabled: z.boolean(),
  share: z.boolean()
});

/**
 * Zod schema for a partial proxy patch.
 */
const proxyPatchShape = z.object({
  enabled: z.boolean().optional(),
  protocol: z.enum(['http', 'https']).optional(),
  host: z.string().optional(),
  port: z.number().optional(),
  authEnabled: z.boolean().optional(),
  username: z.string().optional(),
  password: z.string().optional()
});

/**
 * Zod schema for a partial code-editor setup patch.
 */
const codeEditorSetupPatchShape = z.object({
  lineNumbers: z.boolean().optional(),
  foldGutter: z.boolean().optional(),
  highlightActiveLine: z.boolean().optional(),
  highlightActiveLineGutter: z.boolean().optional()
});

/**
 * Updates persisted General Settings with a partial patch.
 *
 * @param {boolean} [verifySsl] - When false, disables TLS certificate verification for HTTPS.
 * @param {boolean} [followRedirects] - When true, 3xx responses are followed automatically.
 * @param {number} [requestTimeoutMs] - Request timeout in milliseconds; 0 disables.
 * @param {object} [proxy] - Partial proxy settings; deep-merged onto the current proxy.
 */
export const updateGeneralSettingsTool = {
  name: 'update_general_settings',
  definition: {
    type: 'function',
    function: {
      name: 'update_general_settings',
      description:
        'Updates persisted General Settings with a partial patch (timeouts, verifySsl / SSL certificate verification, followRedirects, script permissions, proxy, code editor, git author, warnings, global variables, and related prefs). Set verifySsl to false to disable SSL certificate checks. Nested proxy and codeEditorSetup objects are deep-merged. Only call when the user explicitly asks to change settings. Does not modify AI provider API keys. Returns the updated settings (proxy.password redacted) and the list of changed keys.',
      parameters: {
        type: 'object',
        properties: {
          requestTimeoutMs: {
            type: 'number',
            description: 'Request timeout in milliseconds; 0 disables the timeout.'
          },
          scriptTimeoutMs: {
            type: 'number',
            description:
              'Maximum time in milliseconds for each pre- or post-request script run; 0 disables.'
          },
          allowScriptNetworkRequests: {
            type: 'boolean',
            description: 'When true, pre/post scripts may call hc.sendRequest for outbound HTTP.'
          },
          allowedNetworkPlugins: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Plugin manifest ids allowed to call hc.host.sendHttpRequest when script network is off.'
          },
          allowScriptFileRead: {
            type: 'boolean',
            description: 'When true, pre/post scripts may call hc.fs read/exists/stat APIs.'
          },
          allowScriptFileWrite: {
            type: 'boolean',
            description: 'When true, pre/post scripts may call hc.fs write/append APIs.'
          },
          allowScriptWebpage: {
            type: 'boolean',
            description:
              'When true, pre/post scripts may call hc.livePage to open and control browser tabs.'
          },
          scriptFileRoot: {
            type: 'string',
            description:
              'Absolute directory that confines script file access when the request is not git-backed.'
          },
          workflowResultsDirectory: {
            type: 'string',
            description:
              'Absolute directory where completed workflow runs are auto-exported as JSON.'
          },
          maxResponseSizeMb: {
            type: 'number',
            description: 'Maximum response body size in megabytes; 0 disables the limit.'
          },
          verifySsl: {
            type: 'boolean',
            description:
              'When true, TLS certificates are verified for HTTPS. Set false to disable SSL certificate verification / SSL checks.'
          },
          followRedirects: {
            type: 'boolean',
            description: 'When true, 3xx responses are followed automatically.'
          },
          startWebpageUrl: {
            type: 'string',
            description: 'URL opened by File → New → Browser (and used as that tab Home target).'
          },
          userAgent: {
            type: 'string',
            description: 'Default User-Agent header for outbound HTTP.'
          },
          customUserAgents: {
            type: 'array',
            items: { type: 'string' },
            description: 'User-added User-Agent presets.'
          },
          scrollbarAutoHide: {
            type: 'boolean',
            description: 'When true, custom OverlayScrollbars handles fade out when idle.'
          },
          wrapTabs: {
            type: 'boolean',
            description: 'When true, request tabs and AI chat tabs wrap onto multiple rows.'
          },
          closeToTray: {
            type: 'boolean',
            description: 'When true, closing the main window hides the app to the system tray.'
          },
          spellCheckEnabled: {
            type: 'boolean',
            description: 'When true, editable text fields show spellcheck underlines.'
          },
          warnWhenSwitchingThemes: {
            type: 'boolean',
            description: 'When true, switching appearance themes shows a confirmation dialog.'
          },
          warnWhenExitingWithUnsavedChanges: {
            type: 'boolean',
            description:
              'When true, quitting with unsaved request tabs shows a confirmation dialog.'
          },
          warnWhenClosingUnsavedRequests: {
            type: 'boolean',
            description:
              'When true, closing a request tab with unsaved edits shows a confirmation dialog.'
          },
          warnWhenEditingSnippet: {
            type: 'boolean',
            description: 'When true, editing a linked snippet shows a confirmation dialog.'
          },
          warnWhenCloningSnippet: {
            type: 'boolean',
            description: 'When true, cloning a linked snippet shows a confirmation dialog.'
          },
          warnWhenClickingReadonlySnippet: {
            type: 'boolean',
            description:
              'When true, clicking a read-only linked snippet shows an informational dialog.'
          },
          warnWhenCreatingWorkspace: {
            type: 'boolean',
            description:
              'When true, creating a workspace from open tabs shows a confirmation dialog.'
          },
          warnWhenOpeningWorkspace: {
            type: 'boolean',
            description: 'When true, opening a workspace shows a confirmation dialog.'
          },
          warnWhenAgentUsesTerminal: {
            type: 'boolean',
            description: 'When true, the AI agent must confirm before sending terminal commands.'
          },
          trustedExternalDomains: {
            type: 'array',
            items: TRUSTED_DOMAIN_SCHEMA,
            description: 'Hostnames trusted for opening external links without confirmation.'
          },
          allowAllExternalDomains: {
            type: 'boolean',
            description: 'When true, external links open without confirmation for every domain.'
          },
          dismissedRequestEditorNotices: {
            type: 'array',
            items: { type: 'string', enum: [...EDITOR_TAB_ENUM] },
            description: 'Built-in request editor tabs whose inline help notice the user dismissed.'
          },
          dismissedLiveServerNotices: {
            type: 'array',
            items: { type: 'string', enum: [...LIVE_SERVER_SETTINGS_TAB_ENUM] },
            description:
              'Live Server settings panel tabs whose inline help notice the user dismissed.'
          },
          gitAutoAdd: {
            type: 'boolean',
            description:
              'When true, HarborClient auto-tracks files in git-backed collections before commit.'
          },
          externalMergeEditorPath: {
            type: 'string',
            description: 'Absolute path to an external merge-conflict editor executable.'
          },
          gitCommitAuthorName: {
            type: 'string',
            description: 'Display name stamped on commits created through HarborClient.'
          },
          gitCommitAuthorEmail: {
            type: 'string',
            description: 'Email address stamped on commits created through HarborClient.'
          },
          gitCommitAuthorPrompted: {
            type: 'boolean',
            description: 'Whether the first-commit author prompt has been shown.'
          },
          codeEditorTheme: {
            type: 'string',
            enum: [...CODE_EDITOR_THEME_ENUM],
            description: 'CodeMirror syntax theme applied to all editor instances.'
          },
          codeEditorSetup: {
            type: 'object',
            properties: {
              lineNumbers: { type: 'boolean', description: 'Show line numbers in the gutter.' },
              foldGutter: { type: 'boolean', description: 'Show the code-folding gutter.' },
              highlightActiveLine: {
                type: 'boolean',
                description: 'Highlight the line containing the cursor.'
              },
              highlightActiveLineGutter: {
                type: 'boolean',
                description: 'Highlight the active line number in the gutter.'
              }
            },
            additionalProperties: false,
            description: 'Partial CodeMirror basicSetup options; deep-merged onto current setup.'
          },
          codeEditorFontSize: {
            type: 'string',
            description: 'CodeMirror editor font size.'
          },
          proxy: {
            type: 'object',
            properties: {
              enabled: {
                type: 'boolean',
                description: 'When true, outbound requests are routed through the proxy.'
              },
              protocol: {
                type: 'string',
                enum: ['http', 'https'],
                description: 'Protocol used to connect to the proxy server.'
              },
              host: {
                type: 'string',
                description: 'Proxy server hostname or IP address.'
              },
              port: { type: 'number', description: 'Proxy server port.' },
              authEnabled: {
                type: 'boolean',
                description: 'When true, HTTP Basic credentials are sent to the proxy.'
              },
              username: {
                type: 'string',
                description: 'Username for proxy HTTP Basic authentication.'
              },
              password: {
                type: 'string',
                description:
                  'Password for proxy HTTP Basic authentication. Only set when the user provides it.'
              }
            },
            additionalProperties: false,
            description: 'Partial HTTP proxy settings; deep-merged onto the current proxy.'
          },
          globalVariables: {
            type: 'array',
            items: GLOBAL_VARIABLE_SCHEMA,
            description:
              'App-wide variables for {{key}} substitution (replaces the full list when set).'
          },
          logFilePath: {
            type: 'string',
            description: 'Absolute path to a rotating log file; empty disables file logging.'
          }
        },
        additionalProperties: false
      }
    }
  },
  inputShape: {
    requestTimeoutMs: z.number().optional(),
    scriptTimeoutMs: z.number().optional(),
    allowScriptNetworkRequests: z.boolean().optional(),
    allowedNetworkPlugins: z.array(z.string()).optional(),
    allowScriptFileRead: z.boolean().optional(),
    allowScriptFileWrite: z.boolean().optional(),
    allowScriptWebpage: z.boolean().optional(),
    scriptFileRoot: z.string().optional(),
    workflowResultsDirectory: z.string().optional(),
    maxResponseSizeMb: z.number().optional(),
    verifySsl: z.boolean().optional(),
    followRedirects: z.boolean().optional(),
    startWebpageUrl: z.string().optional(),
    userAgent: z.string().optional(),
    customUserAgents: z.array(z.string()).optional(),
    scrollbarAutoHide: z.boolean().optional(),
    wrapTabs: z.boolean().optional(),
    closeToTray: z.boolean().optional(),
    spellCheckEnabled: z.boolean().optional(),
    warnWhenSwitchingThemes: z.boolean().optional(),
    warnWhenExitingWithUnsavedChanges: z.boolean().optional(),
    warnWhenClosingUnsavedRequests: z.boolean().optional(),
    warnWhenEditingSnippet: z.boolean().optional(),
    warnWhenCloningSnippet: z.boolean().optional(),
    warnWhenClickingReadonlySnippet: z.boolean().optional(),
    warnWhenCreatingWorkspace: z.boolean().optional(),
    warnWhenOpeningWorkspace: z.boolean().optional(),
    warnWhenAgentUsesTerminal: z.boolean().optional(),
    trustedExternalDomains: z.array(trustedDomainShape).optional(),
    allowAllExternalDomains: z.boolean().optional(),
    dismissedRequestEditorNotices: z.enum(EDITOR_TAB_ENUM).array().optional(),
    dismissedLiveServerNotices: z.enum(LIVE_SERVER_SETTINGS_TAB_ENUM).array().optional(),
    gitAutoAdd: z.boolean().optional(),
    externalMergeEditorPath: z.string().optional(),
    gitCommitAuthorName: z.string().optional(),
    gitCommitAuthorEmail: z.string().optional(),
    gitCommitAuthorPrompted: z.boolean().optional(),
    codeEditorTheme: z.enum(CODE_EDITOR_THEME_ENUM).optional(),
    codeEditorSetup: codeEditorSetupPatchShape.optional(),
    codeEditorFontSize: z.string().optional(),
    proxy: proxyPatchShape.optional(),
    globalVariables: z.array(globalVariableShape).optional(),
    logFilePath: z.string().optional()
  }
} as const satisfies ITool<'update_general_settings'>;
