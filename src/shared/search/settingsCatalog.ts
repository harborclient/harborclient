import type { SettingsSection } from '#/shared/types';

export type SettingId =
  | 'general.requestTimeoutMs'
  | 'general.scriptTimeoutMs'
  | 'general.allowScriptNetworkRequests'
  | 'general.maxResponseSizeMb'
  | 'general.verifySsl'
  | 'general.followRedirects'
  | 'general.scrollbarAutoHide'
  | 'general.warnWhenSwitchingThemes'
  | 'proxy.enabled'
  | 'proxy.protocol'
  | 'proxy.host'
  | 'proxy.port'
  | 'proxy.authEnabled'
  | 'proxy.username'
  | 'proxy.password'
  | 'syntax.codeEditorTheme'
  | 'syntax.codeEditorFontSize'
  | 'syntax.lineNumbers'
  | 'syntax.foldGutter'
  | 'syntax.highlightActiveLine'
  | 'syntax.highlightActiveLineGutter'
  | 'ai.openaiApiKey'
  | 'ai.claudeApiKey'
  | 'ai.geminiApiKey'
  | 'plugins.addCatalogEndpointUrl'
  | 'plugins.addTrustedEndpointUrl'
  | 'globals'
  | 'storage'
  | 'shortcuts'
  | 'backup-restore';

/**
 * Catalog ids for individual settings fields (excludes management section ids).
 */
export type FieldSettingId = Exclude<
  SettingId,
  'globals' | 'storage' | 'shortcuts' | 'backup-restore'
>;

/**
 * Built-in settings sections rendered by the main Settings layout engine.
 */
export type MainFormSettingsSection = 'general' | 'proxy' | 'syntax' | 'ai';

/**
 * Built-in settings sections that expose individual field entries in the catalog.
 */
export type FormSettingsSection = MainFormSettingsSection | 'plugins';

/**
 * Catalog entry for an individual settings field.
 */
export interface FieldSettingEntry {
  /** Stable setting identifier shown in tooltips and used for search. */
  id: FieldSettingId;
  /** Sidebar section that owns this field in normal navigation. */
  section: FormSettingsSection;
  kind: 'field';
  /** Primary label shown beside the control. */
  label: string;
  /** Helper text rendered below the control and indexed for search. */
  description: string;
  /** Optional search synonyms beyond label and description text. */
  keywords?: string[];
}

/**
 * Catalog entry for a management settings section rendered as a single panel.
 */
export interface SectionSettingEntry {
  /** Stable section identifier. */
  id: SettingId;
  section: SettingsSection;
  kind: 'section';
  /** Sidebar label for the section. */
  label: string;
  /** Page summary shown below the section title. */
  description: string;
  keywords?: string[];
}

/**
 * One row in the settings catalog manifest.
 */
export type SettingEntry = FieldSettingEntry | SectionSettingEntry;

/**
 * Page descriptions for form sections rendered by the layout engine.
 */
export const FORM_SECTION_DESCRIPTIONS: Record<FormSettingsSection, string> = {
  general:
    'Set request and script timeouts, response size limits, SSL verification, redirect following defaults, and scrollbar visibility.',
  proxy: "Route HarborClient's outbound HTTP requests through a proxy server.",
  syntax: 'Choose a CodeMirror theme and editor behavior for request and response editors.',
  ai: 'Store API keys for OpenAI, Claude, and Google Gemini, and configure MCP server and client connections.',
  plugins: 'Configure marketplace catalog and trusted publisher key endpoints for plugin sources.'
};

/**
 * Canonical manifest of searchable settings metadata and layout placement.
 */
export const SETTINGS_CATALOG: SettingEntry[] = [
  {
    id: 'general.requestTimeoutMs',
    section: 'general',
    kind: 'field',
    label: 'Request timeout (ms)',
    description: 'Set to 0 to disable the limit.',
    keywords: ['timeout', 'milliseconds', 'request']
  },
  {
    id: 'general.scriptTimeoutMs',
    section: 'general',
    kind: 'field',
    label: 'Script timeout (ms)',
    description:
      'Maximum time for each pre- or post-request script. Set to 0 to disable. Applies per script in the run order.',
    keywords: ['script', 'timeout', 'pre-request', 'post-request', 'milliseconds']
  },
  {
    id: 'general.allowScriptNetworkRequests',
    section: 'general',
    kind: 'field',
    label: 'Allow script network requests',
    description:
      'When enabled, pre- and post-request scripts may call hc.sendRequest for outbound HTTP.',
    keywords: ['script', 'network', 'sendRequest', 'http', 'permission']
  },
  {
    id: 'general.maxResponseSizeMb',
    section: 'general',
    kind: 'field',
    label: 'Max response size (MB)',
    description: 'Set to 0 for no configurable limit (512 MB hard cap still applies).',
    keywords: ['response', 'size', 'limit', 'megabytes']
  },
  {
    id: 'general.verifySsl',
    section: 'general',
    kind: 'field',
    label: 'SSL certificate verification',
    description: 'When enabled, HTTPS requests reject invalid or untrusted TLS certificates.',
    keywords: ['ssl', 'tls', 'certificate', 'https', 'security']
  },
  {
    id: 'general.followRedirects',
    section: 'general',
    kind: 'field',
    label: 'Follow redirects',
    description: 'When disabled, 3xx responses are returned without following Location.',
    keywords: ['redirect', '3xx', 'location']
  },
  {
    id: 'general.scrollbarAutoHide',
    section: 'general',
    kind: 'field',
    label: 'Auto-hide scrollbars',
    description:
      'When enabled, custom scrollbars fade out when you are not scrolling. When disabled, they stay visible while content overflows.',
    keywords: ['scrollbar', 'scroll', 'overlay', 'auto-hide', 'visibility']
  },
  {
    id: 'general.warnWhenSwitchingThemes',
    section: 'general',
    kind: 'field',
    label: 'Warn when switching themes',
    description:
      'When enabled, switching appearance themes from the View menu shows a confirmation dialog.',
    keywords: ['theme', 'appearance', 'confirm', 'warning']
  },
  {
    id: 'proxy.enabled',
    section: 'proxy',
    kind: 'field',
    label: 'Use a proxy',
    description: 'Route outbound HTTP requests through a configured proxy server.',
    keywords: ['proxy', 'network']
  },
  {
    id: 'proxy.protocol',
    section: 'proxy',
    kind: 'field',
    label: 'Protocol',
    description: 'HTTP or HTTPS scheme used to connect to the proxy server.',
    keywords: ['http', 'https']
  },
  {
    id: 'proxy.host',
    section: 'proxy',
    kind: 'field',
    label: 'Host',
    description: 'Hostname or IP address of the proxy server.',
    keywords: ['hostname', 'address', 'server']
  },
  {
    id: 'proxy.port',
    section: 'proxy',
    kind: 'field',
    label: 'Port',
    description: 'Port number the proxy server listens on.',
    keywords: ['port', 'network']
  },
  {
    id: 'proxy.authEnabled',
    section: 'proxy',
    kind: 'field',
    label: 'Use basic authentication',
    description: 'Send a username and password when connecting to the proxy.',
    keywords: ['authentication', 'credentials', 'basic auth']
  },
  {
    id: 'proxy.username',
    section: 'proxy',
    kind: 'field',
    label: 'Username',
    description: 'Username sent for proxy basic authentication.',
    keywords: ['user', 'login', 'credentials']
  },
  {
    id: 'proxy.password',
    section: 'proxy',
    kind: 'field',
    label: 'Password',
    description: 'Password sent for proxy basic authentication.',
    keywords: ['secret', 'credentials']
  },
  {
    id: 'syntax.codeEditorTheme',
    section: 'syntax',
    kind: 'field',
    label: 'Theme',
    description: 'CodeMirror color theme applied to request and response editors.',
    keywords: ['syntax', 'highlighting', 'codemirror', 'colors']
  },
  {
    id: 'syntax.codeEditorFontSize',
    section: 'syntax',
    kind: 'field',
    label: 'Font size',
    description: 'Font size applied to request and response editors.',
    keywords: ['syntax', 'highlighting', 'codemirror', 'font', 'text size']
  },
  {
    id: 'syntax.lineNumbers',
    section: 'syntax',
    kind: 'field',
    label: 'Line numbers',
    description: 'Show line numbers in the editor gutter.',
    keywords: ['gutter', 'numbers']
  },
  {
    id: 'syntax.foldGutter',
    section: 'syntax',
    kind: 'field',
    label: 'Code folding gutter',
    description: 'Show fold controls in the gutter for collapsible code blocks.',
    keywords: ['fold', 'collapse', 'gutter']
  },
  {
    id: 'syntax.highlightActiveLine',
    section: 'syntax',
    kind: 'field',
    label: 'Highlight active line',
    description: 'Highlight the line containing the text cursor.',
    keywords: ['cursor', 'current line']
  },
  {
    id: 'syntax.highlightActiveLineGutter',
    section: 'syntax',
    kind: 'field',
    label: 'Highlight active line gutter',
    description: 'Highlight the gutter marker for the active line.',
    keywords: ['gutter', 'current line']
  },
  {
    id: 'ai.openaiApiKey',
    section: 'ai',
    kind: 'field',
    label: 'OpenAI API key',
    description: 'API key used for OpenAI models in the AI sidebar.',
    keywords: ['openai', 'gpt', 'chatgpt', 'api']
  },
  {
    id: 'ai.claudeApiKey',
    section: 'ai',
    kind: 'field',
    label: 'Claude API key',
    description: 'API key used for Anthropic Claude models in the AI sidebar.',
    keywords: ['anthropic', 'claude', 'api']
  },
  {
    id: 'ai.geminiApiKey',
    section: 'ai',
    kind: 'field',
    label: 'Google Gemini API key',
    description: 'API key used for Google Gemini models in the AI sidebar.',
    keywords: ['google', 'gemini', 'api']
  },
  {
    id: 'plugins.addCatalogEndpointUrl',
    section: 'plugins',
    kind: 'field',
    label: 'Add endpoint URL',
    description: 'Add a new endpoint URL to the list.',
    keywords: ['endpoint', 'catalog', 'url', 'plugin sources', 'marketplace']
  },
  {
    id: 'plugins.addTrustedEndpointUrl',
    section: 'plugins',
    kind: 'field',
    label: 'Add endpoint URL',
    description: 'Add a new endpoint URL to the list.',
    keywords: ['endpoint', 'trusted', 'url', 'plugin sources', 'publisher', 'signing']
  },
  {
    id: 'globals',
    section: 'globals',
    kind: 'section',
    label: 'Globals',
    description: 'App-wide variables substituted into request URLs and bodies.',
    keywords: ['variables']
  },
  {
    id: 'storage',
    section: 'storage',
    kind: 'section',
    label: 'Storage Locations',
    description: 'Configure local, Git, and remote database connections for collections.',
    keywords: ['connections', 'database']
  },
  {
    id: 'shortcuts',
    section: 'shortcuts',
    kind: 'section',
    label: 'Shortcuts',
    description: 'Customize keyboard shortcuts for menus and common actions.',
    keywords: ['keyboard', 'keybindings']
  },
  {
    id: 'backup-restore',
    section: 'backup-restore',
    kind: 'section',
    label: 'Backup & Restore',
    description:
      'Export everything HarborClient stores locally into a backup file, or restore from a backup.',
    keywords: ['export', 'import']
  }
];

const CATALOG_BY_ID = new Map<SettingId, SettingEntry>(
  SETTINGS_CATALOG.map((entry) => [entry.id, entry])
);

/**
 * Returns the catalog entry for a setting id.
 *
 * @param id - Stable setting identifier.
 * @returns Matching catalog entry.
 * @throws When the id is unknown.
 */
export function entryById(id: SettingId): SettingEntry {
  const entry = CATALOG_BY_ID.get(id);
  if (!entry) {
    throw new Error(`Unknown setting id: ${id}`);
  }
  return entry;
}

/**
 * Returns field catalog entries belonging to a form section in manifest order.
 *
 * @param section - Form settings section id.
 * @returns Field entries for the section.
 */
export function fieldEntriesForSection(section: FormSettingsSection): FieldSettingEntry[] {
  return SETTINGS_CATALOG.filter(
    (entry): entry is FieldSettingEntry => entry.kind === 'field' && entry.section === section
  );
}

/**
 * Returns all field catalog entries in manifest order.
 *
 * @returns Every field entry in the catalog.
 */
export function allFieldEntries(): FieldSettingEntry[] {
  return SETTINGS_CATALOG.filter((entry): entry is FieldSettingEntry => entry.kind === 'field');
}

/**
 * Returns the section-level catalog entry for a management section.
 *
 * @param section - Built-in settings section id.
 * @returns Matching section entry.
 * @throws When the section is not a catalogued management section.
 */
export function sectionEntryBySection(section: SettingsSection): SectionSettingEntry {
  const entry = SETTINGS_CATALOG.find(
    (candidate): candidate is SectionSettingEntry =>
      candidate.kind === 'section' && candidate.section === section
  );
  if (!entry) {
    throw new Error(`No section catalog entry for: ${section}`);
  }
  return entry;
}

/**
 * Returns true when the section is rendered from individual field components.
 *
 * @param section - Settings section id.
 */
export function isFormSettingsSection(
  section: SettingsSection
): section is MainFormSettingsSection {
  return section === 'general' || section === 'proxy' || section === 'syntax' || section === 'ai';
}
