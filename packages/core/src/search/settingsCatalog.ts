import type { SettingsSection } from '../types';

export type SettingId =
  | 'general.requestTimeoutMs'
  | 'general.scriptTimeoutMs'
  | 'general.allowScriptNetworkRequests'
  | 'general.allowScriptFileRead'
  | 'general.allowScriptFileWrite'
  | 'general.allowScriptWebpage'
  | 'general.scriptFileRoot'
  | 'general.workflowResultsDirectory'
  | 'general.maxResponseSizeMb'
  | 'general.verifySsl'
  | 'general.followRedirects'
  | 'general.startWebpageUrl'
  | 'general.userAgent'
  | 'general.scrollbarAutoHide'
  | 'general.wrapTabs'
  | 'general.closeToTray'
  | 'general.spellCheckEnabled'
  | 'general.logFilePath'
  | 'general.trustedDomains'
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
  | 'terminal.screenReaderMode'
  | 'terminal.minimumContrastRatio'
  | 'terminal.scrollback'
  | 'terminal.cursorBlink'
  | 'terminal.blinkIntervalDuration'
  | 'terminal.cursorStyle'
  | 'terminal.fastScrollSensitivity'
  | 'terminal.fontSize'
  | 'terminal.fontFamily'
  | 'terminal.fontWeight'
  | 'ai.enterToSend'
  | 'ai.openaiApiKey'
  | 'ai.claudeApiKey'
  | 'ai.geminiApiKey'
  | 'ai.githubModels'
  | 'appearance.showSidebar'
  | 'appearance.showRail'
  | 'appearance.showAiSidebar'
  | 'appearance.showGitSidebar'
  | 'appearance.showShortcutsSidebar'
  | 'appearance.showRequestEditor'
  | 'appearance.showResponseEditor'
  | 'appearance.showConsole'
  | 'appearance.showVariables'
  | 'appearance.showMcp'
  | 'appearance.showTerminal'
  | 'appearance.showStorageLocationBadges'
  | 'appearance.showMarkers'
  | 'appearance.showMethodColors'
  | 'appearance.showIndicators'
  | 'appearance.showFilters'
  | 'appearance.showSorting'
  | 'plugins.addCatalogEndpointUrl'
  | 'plugins.addTrustedEndpointUrl'
  | 'globals'
  | 'storage'
  | 'git'
  | 'runtimes'
  | 'backup-restore'
  | 'backup-restore.confirmations'
  | 'git.autoTrack'
  | 'git.commitAuthor';

/**
 * Catalog ids for management settings groups within a section panel.
 */
export type GroupSettingId = 'backup-restore.confirmations' | 'git.autoTrack' | 'git.commitAuthor';

/**
 * Catalog ids for individual settings fields (excludes management section and group ids).
 */
export type FieldSettingId = Exclude<
  SettingId,
  'globals' | 'storage' | 'git' | 'runtimes' | 'backup-restore' | GroupSettingId
>;

/**
 * Built-in settings sections rendered by the main Settings layout engine.
 */
export type MainFormSettingsSection =
  | 'general'
  | 'appearance'
  | 'proxy'
  | 'syntax'
  | 'ai'
  | 'terminal';

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
 * Catalog entry for a searchable subgroup within a management settings panel.
 */
export interface GroupSettingEntry {
  /** Stable group identifier shown in tooltips and used for search. */
  id: GroupSettingId;
  /** Management section that owns this group in normal navigation. */
  section: SettingsSection;
  kind: 'group';
  /** Primary label shown above the group content. */
  label: string;
  /** Helper text rendered below the label and indexed for search. */
  description: string;
  /** Optional search synonyms beyond label and description text. */
  keywords?: string[];
}

/**
 * One row in the settings catalog manifest.
 */
export type SettingEntry = FieldSettingEntry | SectionSettingEntry | GroupSettingEntry;

/**
 * Page descriptions for form sections rendered by the layout engine.
 */
export const FORM_SECTION_DESCRIPTIONS: Record<FormSettingsSection, string> = {
  general:
    'Set request and script timeouts, response size limits, SSL verification, redirect following defaults, scrollbar visibility, and optional diagnostic log file output.',
  appearance:
    'Show or hide sidebars, editors, footer panels, and collections sidebar display chrome. Changes apply immediately and match View → Appearance.',
  proxy: "Route HarborClient's outbound HTTP requests through a proxy server.",
  syntax: 'Choose a CodeMirror theme and editor behavior for request and response editors.',
  ai: 'Store API keys for OpenAI, Claude, and Google Gemini, and configure MCP server and client connections.',
  terminal:
    'Configure the footer terminal appearance, cursor behavior, scrollback buffer, and accessibility options.',
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
    description: 'When enabled, pre- and post-request scripts may call hc.fetch for outbound HTTP.',
    keywords: ['script', 'network', 'fetch', 'http', 'permission']
  },
  {
    id: 'general.allowScriptFileRead',
    section: 'general',
    kind: 'field',
    label: 'Allow script file read',
    description:
      'When enabled, pre- and post-request scripts may call hc.fs read, exists, and stat APIs under the script file root.',
    keywords: ['script', 'file', 'read', 'fs', 'permission', 'hc.fs']
  },
  {
    id: 'general.allowScriptFileWrite',
    section: 'general',
    kind: 'field',
    label: 'Allow script file write',
    description:
      'When enabled, pre- and post-request scripts may call hc.fs write and append APIs under the script file root.',
    keywords: ['script', 'file', 'write', 'fs', 'permission', 'hc.fs']
  },
  {
    id: 'general.allowScriptWebpage',
    section: 'general',
    kind: 'field',
    label: 'Allow script live page access',
    description:
      'When enabled, pre- and post-request scripts may call hc.livePage to open, focus, query, and close embedded browser tabs. Page load waits count against the script timeout.',
    keywords: [
      'script',
      'webpage',
      'live page',
      'browser',
      'tab',
      'dom',
      'permission',
      'hc.livePage'
    ]
  },
  {
    id: 'general.scriptFileRoot',
    section: 'general',
    kind: 'field',
    label: 'Script file access root',
    description:
      'Directory that confines hc.fs paths for non-git collections. Leave empty to use your home directory. Git-backed collections are confined to their git repository directory instead.',
    keywords: ['script', 'file', 'root', 'directory', 'path', 'hc.fs', 'sandbox']
  },
  {
    id: 'general.workflowResultsDirectory',
    section: 'general',
    kind: 'field',
    label: 'Workflow results directory',
    description:
      'When set, each completed workflow run is automatically saved as a JSON file in this directory. Leave empty to disable.',
    keywords: ['workflow', 'results', 'export', 'directory', 'path', 'json', 'run']
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
    id: 'general.startWebpageUrl',
    section: 'general',
    kind: 'field',
    label: 'Start webpage',
    description:
      'URL opened by File → New → Browser. Also used as the Home button target for that tab. Defaults to about:blank.',
    keywords: ['homepage', 'start', 'browser', 'url', 'about:blank']
  },
  {
    id: 'general.userAgent',
    section: 'general',
    kind: 'field',
    label: 'User-Agent',
    description:
      'Default User-Agent header for outbound HTTP. Collection, folder, and request overrides take precedence; a key/value User-Agent header wins over all of them.',
    keywords: ['user-agent', 'user agent', 'ua', 'browser', 'client', 'header']
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
    id: 'general.wrapTabs',
    section: 'general',
    kind: 'field',
    label: 'Wrap tabs',
    description:
      'When enabled, request tabs and AI chat tabs wrap onto multiple rows instead of scrolling horizontally.',
    keywords: ['wrap', 'tabs', 'overflow', 'scroll']
  },
  {
    id: 'general.closeToTray',
    section: 'general',
    kind: 'field',
    label: 'Close to tray',
    description:
      'When enabled, closing the main window hides HarborClient to the system tray instead of quitting. Use File → Quit or the tray Quit action to exit completely.',
    keywords: ['tray', 'close', 'minimize', 'background', 'system tray', 'quit', 'hide']
  },
  {
    id: 'general.spellCheckEnabled',
    section: 'general',
    kind: 'field',
    label: 'Spell check',
    description:
      'When enabled, editable text fields show spelling underlines and offer suggestions in the right-click menu.',
    keywords: ['spell', 'spelling', 'dictionary', 'typo', 'autocorrect', 'context menu']
  },
  {
    id: 'general.logFilePath',
    section: 'general',
    kind: 'field',
    label: 'Log file path',
    description:
      'When set, verbose and request diagnostics are written to this rotating log file regardless of -v or -vv flags. Leave empty to disable.',
    keywords: ['log', 'logging', 'file', 'verbose', 'diagnostics', 'debug']
  },
  {
    id: 'general.trustedDomains',
    section: 'general',
    kind: 'field',
    label: 'Trusted domains',
    description:
      'Domains that may open in the system browser without confirmation. Disable a row to prompt again, or remove it entirely.',
    keywords: ['trusted', 'domain', 'external link', 'mdn', 'mozilla', 'browser', 'confirmation']
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
    id: 'terminal.screenReaderMode',
    section: 'terminal',
    kind: 'field',
    label: 'Screen reader mode',
    description: 'Expose DOM elements that support screen readers such as NVDA and VoiceOver.',
    keywords: ['accessibility', 'a11y', 'screen reader', 'nvda', 'voiceover']
  },
  {
    id: 'terminal.minimumContrastRatio',
    section: 'terminal',
    kind: 'field',
    label: 'Minimum contrast ratio',
    description:
      'Minimum contrast ratio for text colors. Use 1 to disable adjustment, 4.5 for WCAG AA, or 7 for AAA.',
    keywords: ['contrast', 'accessibility', 'wcag', 'colors']
  },
  {
    id: 'terminal.scrollback',
    section: 'terminal',
    kind: 'field',
    label: 'Scrollback',
    description: 'Number of rows retained when lines scroll beyond the viewport.',
    keywords: ['buffer', 'history', 'lines', 'xterm']
  },
  {
    id: 'terminal.cursorBlink',
    section: 'terminal',
    kind: 'field',
    label: 'Cursor blink',
    description: 'Blink the cursor when the terminal is focused (respects reduced-motion).',
    keywords: ['cursor', 'blink', 'caret']
  },
  {
    id: 'terminal.blinkIntervalDuration',
    section: 'terminal',
    kind: 'field',
    label: 'Blink interval (ms)',
    description:
      'Interval in milliseconds for blinking text attributes. Set to 0 to disable. Requires a newer xterm.js build to take effect.',
    keywords: ['blink', 'text', 'interval', 'duration']
  },
  {
    id: 'terminal.cursorStyle',
    section: 'terminal',
    kind: 'field',
    label: 'Cursor style',
    description: 'Shape of the cursor when the terminal is focused.',
    keywords: ['cursor', 'block', 'underline', 'bar', 'caret']
  },
  {
    id: 'terminal.fastScrollSensitivity',
    section: 'terminal',
    kind: 'field',
    label: 'Fast scroll sensitivity',
    description: 'Scroll speed multiplier used for fast scrolling when Alt is held.',
    keywords: ['scroll', 'speed', 'alt', 'sensitivity']
  },
  {
    id: 'terminal.fontSize',
    section: 'terminal',
    kind: 'field',
    label: 'Font size',
    description: 'Font size in pixels for terminal text.',
    keywords: ['font', 'size', 'text']
  },
  {
    id: 'terminal.fontFamily',
    section: 'terminal',
    kind: 'field',
    label: 'Font family',
    description: 'CSS font-family stack used for terminal text.',
    keywords: ['font', 'monospace', 'typeface']
  },
  {
    id: 'terminal.fontWeight',
    section: 'terminal',
    kind: 'field',
    label: 'Font weight',
    description: 'Font weight used for non-bold terminal text.',
    keywords: ['font', 'weight', 'bold']
  },
  {
    id: 'ai.enterToSend',
    section: 'ai',
    kind: 'field',
    label: 'Enter sends message',
    description:
      'When enabled, Enter sends the AI chat message. When disabled, use Ctrl+Enter (Cmd+Enter on macOS). Shift+Enter always inserts a new line.',
    keywords: ['enter', 'send', 'keyboard', 'composer', 'ctrl+enter', 'cmd+enter']
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
    id: 'ai.githubModels',
    section: 'ai',
    kind: 'field',
    label: 'GitHub Models',
    description: 'Sign in with GitHub to use rate-limited GitHub Models on your account quota.',
    keywords: ['github', 'models', 'oauth', 'sign in', 'free']
  },
  {
    id: 'appearance.showSidebar',
    section: 'appearance',
    kind: 'field',
    label: 'Collections Sidebar',
    description:
      'Show the collections sidebar that lists requests, environments, and related sections.',
    keywords: ['sidebar', 'collections', 'layout', 'chrome', 'view', 'appearance', 'panel']
  },
  {
    id: 'appearance.showRail',
    section: 'appearance',
    kind: 'field',
    label: 'Rail',
    description:
      'Show the activity rail beside the collections sidebar for switching sidebar modes.',
    keywords: ['rail', 'activity', 'sidebar', 'layout', 'chrome', 'view', 'appearance']
  },
  {
    id: 'appearance.showAiSidebar',
    section: 'appearance',
    kind: 'field',
    label: 'Agent Chat',
    description: 'Show the agent chat sidebar for Harbor AI conversations.',
    keywords: ['ai', 'agent', 'chat', 'sidebar', 'layout', 'chrome', 'view', 'appearance']
  },
  {
    id: 'appearance.showGitSidebar',
    section: 'appearance',
    kind: 'field',
    label: 'Git Sidebar',
    description: 'Show the Git source-control sidebar for commits and diffs.',
    keywords: ['git', 'source control', 'sidebar', 'layout', 'chrome', 'view', 'appearance']
  },
  {
    id: 'appearance.showShortcutsSidebar',
    section: 'appearance',
    kind: 'field',
    label: 'Shortcuts',
    description: 'Show the shortcuts editor sidebar for customizing keyboard shortcuts.',
    keywords: ['shortcuts', 'keyboard', 'sidebar', 'layout', 'chrome', 'view', 'appearance']
  },
  {
    id: 'appearance.showRequestEditor',
    section: 'appearance',
    kind: 'field',
    label: 'Request',
    description: 'Show the request editor pane in the main content area.',
    keywords: ['request', 'editor', 'pane', 'layout', 'chrome', 'view', 'appearance']
  },
  {
    id: 'appearance.showResponseEditor',
    section: 'appearance',
    kind: 'field',
    label: 'Response',
    description: 'Show the response editor pane in the main content area.',
    keywords: ['response', 'editor', 'pane', 'layout', 'chrome', 'view', 'appearance']
  },
  {
    id: 'appearance.showConsole',
    section: 'appearance',
    kind: 'field',
    label: 'Console',
    description: 'Show the footer console panel for script and request logs.',
    keywords: ['console', 'footer', 'panel', 'layout', 'chrome', 'view', 'appearance']
  },
  {
    id: 'appearance.showVariables',
    section: 'appearance',
    kind: 'field',
    label: 'Variables',
    description: 'Show the footer variables panel for inspecting resolved variables.',
    keywords: ['variables', 'footer', 'panel', 'layout', 'chrome', 'view', 'appearance']
  },
  {
    id: 'appearance.showMcp',
    section: 'appearance',
    kind: 'field',
    label: 'MCP',
    description: 'Show the footer MCP panel for Model Context Protocol connections.',
    keywords: ['mcp', 'footer', 'panel', 'layout', 'chrome', 'view', 'appearance']
  },
  {
    id: 'appearance.showTerminal',
    section: 'appearance',
    kind: 'field',
    label: 'Terminal',
    description: 'Show the footer terminal panel for an embedded shell.',
    keywords: ['terminal', 'footer', 'panel', 'layout', 'chrome', 'view', 'appearance']
  },
  {
    id: 'appearance.showStorageLocationBadges',
    section: 'appearance',
    kind: 'field',
    label: 'Storage locations',
    description: 'Show storage-location badges on collections sidebar rows.',
    keywords: ['storage', 'location', 'badge', 'sidebar', 'display', 'chrome', 'view', 'appearance']
  },
  {
    id: 'appearance.showMarkers',
    section: 'appearance',
    kind: 'field',
    label: 'Color markers',
    description: 'Show color marker dots on collections sidebar rows.',
    keywords: ['marker', 'color', 'dot', 'sidebar', 'display', 'chrome', 'view', 'appearance']
  },
  {
    id: 'appearance.showMethodColors',
    section: 'appearance',
    kind: 'field',
    label: 'Highlights',
    description: 'Color HTTP method badges in the collections sidebar by method.',
    keywords: [
      'highlight',
      'method',
      'color',
      'badge',
      'sidebar',
      'display',
      'chrome',
      'view',
      'appearance'
    ]
  },
  {
    id: 'appearance.showIndicators',
    section: 'appearance',
    kind: 'field',
    label: 'Indicators',
    description: 'Show status indicator dots in History and Runs sidebar sections.',
    keywords: [
      'indicator',
      'status',
      'dot',
      'history',
      'runs',
      'sidebar',
      'display',
      'chrome',
      'view',
      'appearance'
    ]
  },
  {
    id: 'appearance.showFilters',
    section: 'appearance',
    kind: 'field',
    label: 'Filters',
    description:
      'Show section filter controls in the collections sidebar. Turning off clears active section filters.',
    keywords: ['filter', 'sidebar', 'display', 'chrome', 'view', 'appearance']
  },
  {
    id: 'appearance.showSorting',
    section: 'appearance',
    kind: 'field',
    label: 'Sorting',
    description:
      'Show section sort controls in the collections sidebar. Turning off resets section sorts to default.',
    keywords: ['sort', 'sorting', 'sidebar', 'display', 'chrome', 'view', 'appearance']
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
    id: 'git',
    section: 'git',
    kind: 'section',
    label: 'Git',
    description:
      'Manage shared credentials for git hosts. One identity per host is reused by all git-backed collections.',
    keywords: [
      'github',
      'oauth',
      'token',
      'authentication',
      'credentials',
      'host',
      'auto track',
      'tracking'
    ]
  },
  {
    id: 'runtimes',
    section: 'runtimes',
    kind: 'section',
    label: 'Runtimes',
    description:
      'Define Node, PHP, and Python executables used by live server run commands. Paths stay on this machine so exported servers can match by kind and version.',
    keywords: [
      'runtime',
      'node',
      'php',
      'python',
      'executable',
      'binary',
      'live server',
      'run command',
      'env',
      'environment'
    ]
  },
  {
    id: 'git.autoTrack',
    section: 'git',
    kind: 'group',
    label: 'Auto track',
    description:
      'When enabled, HarborClient automatically tracks all requests and files added to git-backed collections. When disabled, use Add on individual requests to track changes before committing.',
    keywords: ['git', 'track', 'tracking', 'auto track', 'commit', 'unstaged', 'manual']
  },
  {
    id: 'git.commitAuthor',
    section: 'git',
    kind: 'group',
    label: 'Commit author',
    description:
      'Name and email stamped on commits created through HarborClient. When empty, HarborClient falls back to repo-local git config or a default identity.',
    keywords: ['git', 'commit', 'author', 'name', 'email', 'identity', 'user.name', 'user.email']
  },
  {
    id: 'backup-restore',
    section: 'backup-restore',
    kind: 'section',
    label: 'Backup & Restore',
    description:
      'Export everything HarborClient stores locally into a backup file, or restore from a backup.',
    keywords: ['export', 'import']
  },
  {
    id: 'backup-restore.confirmations',
    section: 'backup-restore',
    kind: 'group',
    label: 'Show confirmations',
    description:
      'Choose which confirmation prompts HarborClient shows. Uncheck a row to suppress that prompt permanently, including after choosing "Don\'t ask again" in a dialog.',
    keywords: [
      'confirmation',
      'confirm',
      'warn',
      'warning',
      'prompt',
      "don't ask again",
      'theme',
      'unsaved',
      'snippet',
      'workspace'
    ]
  }
];

const CATALOG_BY_ID = new Map<SettingId, SettingEntry>(
  SETTINGS_CATALOG.map((entry) => [entry.id, entry])
);

/**
 * Returns whether a string is a known settings catalog id.
 *
 * @param id - Candidate setting identifier.
 * @returns True when the id exists in {@link SETTINGS_CATALOG}.
 */
export function isSettingId(id: string): id is SettingId {
  return CATALOG_BY_ID.has(id as SettingId);
}

/**
 * Returns the catalog entry for a setting id when present.
 *
 * @param id - Candidate setting identifier.
 * @returns Matching catalog entry, or undefined when unknown.
 */
export function tryGetSettingEntry(id: string): SettingEntry | undefined {
  if (!isSettingId(id)) {
    return undefined;
  }
  return CATALOG_BY_ID.get(id);
}

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
  return (
    section === 'general' ||
    section === 'appearance' ||
    section === 'proxy' ||
    section === 'syntax' ||
    section === 'ai' ||
    section === 'terminal'
  );
}
