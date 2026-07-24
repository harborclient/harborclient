/**
 * Human-readable labels for each theme color token in the Designer grid.
 */
export const CUSTOM_THEME_TOKEN_LABELS = {
    'surface': 'Surface',
    'sidebar': 'Sidebar',
    'sidebar-toolbar': 'Sidebar toolbar',
    'sidebar-section': 'Sidebar section',
    'sidebar-section-text': 'Sidebar section text',
    'footer': 'Footer',
    'footer-text': 'Footer text',
    'footer-muted': 'Footer muted',
    'footer-icon-active': 'Footer icon active',
    'toolbar-action-active': 'Toolbar action active',
    'breadcrumb-background': 'Breadcrumb background',
    'breadcrumb-segment': 'Breadcrumb segment',
    'control': 'Control',
    'field': 'Field',
    'separator': 'Separator',
    'text': 'Text',
    'text-secondary': 'Text secondary',
    'muted': 'Muted',
    'accent': 'Accent',
    'selection': 'Selection',
    'doc-markdown': 'Markdown document',
    'tab-unsaved': 'Unsaved tab text',
    'tab-underline': 'Tab underline',
    'resize-handle': 'Resize handle',
    'variable-token': 'Variable token',
    'danger': 'Danger',
    'danger-light': 'Danger light',
    'warning': 'Warning',
    'success': 'Success',
    'info': 'Info',
    'method-get': 'GET',
    'method-post': 'POST',
    'method-put': 'PUT',
    'method-patch': 'PATCH',
    'method-delete': 'DELETE',
    'method-head': 'HEAD',
    'method-options': 'OPTIONS',
    'scrollbar-track': 'Scrollbar track',
    'scrollbar-thumb': 'Scrollbar thumb',
    'scrollbar-thumb-hover': 'Scrollbar thumb hover',
    'scrollbar-thumb-active': 'Scrollbar thumb active',
    'script-stage-before-all': 'Before all',
    'script-stage-before-each': 'Before each',
    'script-stage-main': 'Main',
    'script-stage-after-each': 'After each',
    'script-stage-after-all': 'After all',
    'terminal': 'Terminal',
    'git-staged': 'Git staged',
    'git-uncommitted': 'Git uncommitted',
    'git-unstaged': 'Git unstaged',
    'git-untracked': 'Git untracked'
};
/**
 * Ordered token groups for the Designer color grid.
 */
export const CUSTOM_THEME_TOKEN_GROUPS = [
    {
        label: 'Layout',
        tokens: [
            'surface',
            'sidebar',
            'sidebar-toolbar',
            'sidebar-section',
            'footer',
            'control',
            'field',
            'separator',
            'terminal'
        ]
    },
    {
        label: 'Breadcrumb',
        tokens: ['breadcrumb-background', 'breadcrumb-segment']
    },
    {
        label: 'Text',
        tokens: [
            'text',
            'text-secondary',
            'muted',
            'sidebar-section-text',
            'footer-text',
            'footer-muted'
        ]
    },
    {
        label: 'Interactive',
        tokens: ['accent', 'selection', 'doc-markdown']
    },
    {
        label: 'Chrome',
        tokens: [
            'footer-icon-active',
            'toolbar-action-active',
            'tab-underline',
            'resize-handle',
            'variable-token'
        ]
    },
    {
        label: 'Tabs',
        tokens: ['tab-unsaved']
    },
    {
        label: 'Status',
        tokens: ['danger', 'danger-light', 'warning', 'success', 'info']
    },
    {
        label: 'HTTP methods',
        tokens: [
            'method-get',
            'method-post',
            'method-put',
            'method-patch',
            'method-delete',
            'method-head',
            'method-options'
        ]
    },
    {
        label: 'Scrollbar',
        tokens: [
            'scrollbar-track',
            'scrollbar-thumb',
            'scrollbar-thumb-hover',
            'scrollbar-thumb-active'
        ]
    },
    {
        label: 'Script stages',
        tokens: [
            'script-stage-before-all',
            'script-stage-before-each',
            'script-stage-main',
            'script-stage-after-each',
            'script-stage-after-all'
        ]
    },
    {
        label: 'Git',
        tokens: ['git-staged', 'git-uncommitted', 'git-unstaged', 'git-untracked']
    }
];
/**
 * All theme color tokens in display order for the Designer grid.
 */
export const CUSTOM_THEME_TOKENS = CUSTOM_THEME_TOKEN_GROUPS.flatMap((group) => group.tokens);
/**
 * Key palette tokens used for the 4x4 swatch preview on Installed cards.
 */
export const CUSTOM_THEME_SWATCH_TOKENS = [
    'surface',
    'sidebar',
    'control',
    'field',
    'accent',
    'selection',
    'text',
    'text-secondary',
    'muted',
    'success',
    'warning',
    'danger',
    'danger-light',
    'info',
    'method-get',
    'method-post'
];
//# sourceMappingURL=customTheme.js.map