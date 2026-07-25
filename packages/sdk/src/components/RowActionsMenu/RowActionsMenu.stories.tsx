import { faCode, faSun } from '@fortawesome/free-solid-svg-icons';
import { useState } from '@harborclient/sdk/react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentProps, ReactElement } from 'react';
import { fn } from 'storybook/test';
import { RowActionsMenu } from './index.js';

const meta = {
  title: 'Components/RowActionsMenu',
  component: RowActionsMenu,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="flex justify-end rounded-md border border-separator px-3 py-2">
        <Story />
      </div>
    )
  ],
  args: {
    menuId: 'row-1',
    openMenuId: null,
    onOpenChange: fn(),
    groups: [[{ label: 'Refresh', onSelect: fn() }]]
  }
} satisfies Meta<typeof RowActionsMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

function RowActionsMenuDemo(
  props: Omit<ComponentProps<typeof RowActionsMenu>, 'openMenuId' | 'onOpenChange'>
): ReactElement {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  return <RowActionsMenu {...props} openMenuId={openMenuId} onOpenChange={setOpenMenuId} />;
}

export const Default: Story = {
  args: {
    groups: [
      [
        { label: 'Rename', onSelect: fn() },
        { label: 'Duplicate', onSelect: fn() }
      ],
      [{ label: 'Delete', onSelect: fn(), variant: 'danger' }]
    ]
  },
  render: (args) => <RowActionsMenuDemo {...args} />
};

export const SingleGroup: Story = {
  args: {
    menuId: 'row-2',
    groups: [[{ label: 'Refresh', onSelect: fn() }]]
  },
  render: (args) => <RowActionsMenuDemo {...args} />
};

export const WithCheckedItems: Story = {
  args: {
    menuId: 'row-3',
    groups: [
      [
        { label: 'Before all', checked: false, onSelect: fn() },
        { label: 'Before each', checked: false, onSelect: fn() },
        { label: 'Main', checked: true, onSelect: fn() },
        { label: 'After each', checked: false, onSelect: fn() },
        { label: 'After all', checked: false, onSelect: fn() }
      ],
      [{ label: 'Delete', onSelect: fn(), variant: 'danger' }]
    ]
  },
  render: (args) => <RowActionsMenuDemo {...args} />
};

export const InsideOverflowHidden: Story = {
  args: {
    menuId: 'row-overflow',
    groups: [
      [
        { label: 'Copy', onSelect: fn() },
        { label: 'Run', onSelect: fn() },
        { label: 'Move up', onSelect: fn() },
        { label: 'Move down', onSelect: fn() }
      ],
      [{ label: 'Delete', onSelect: fn(), variant: 'danger' }]
    ]
  },
  decorators: [
    (Story) => (
      <div className="w-[220px] overflow-hidden rounded-md border border-separator bg-sidebar p-2">
        <div className="flex items-center justify-end rounded-md px-1 py-1 hover:bg-selection">
          <Story />
        </div>
      </div>
    )
  ],
  render: (args) => <RowActionsMenuDemo {...args} />
};

export const LabeledTrigger: Story = {
  args: {
    menuId: 'snippet-library',
    triggerVariant: 'secondary',
    triggerIcon: faCode,
    triggerLabel: 'Snippets',
    triggerAriaLabel: 'Snippets',
    triggerClassName: 'inline-flex shrink-0 items-center gap-2 whitespace-nowrap',
    groups: [
      [{ label: 'Create a snippet', onSelect: fn() }],
      [
        { label: 'Auth helper', onSelect: fn() },
        { label: 'Parse JSON body', onSelect: fn() }
      ]
    ]
  },
  decorators: [
    (Story) => (
      <div className="flex items-center gap-2 rounded-md border border-separator px-3 py-2">
        <Story />
      </div>
    )
  ],
  render: (args) => <RowActionsMenuDemo {...args} />
};

export const FooterEnvironmentPicker: Story = {
  args: {
    menuId: 'footer-environment-menu',
    placement: 'up',
    triggerVariant: 'toolbar',
    triggerIcon: faSun,
    triggerLabel: 'Production API environment',
    triggerTitle: 'Production API environment',
    triggerAriaLabel: 'Select environment',
    triggerClassName:
      'hc-footer-button w-[12rem] min-w-[12rem] justify-start gap-1 overflow-hidden rounded-md border-none bg-transparent px-2 py-0.5 text-left text-muted hover:bg-transparent hover:text-text',
    groups: [
      [
        { label: 'Development', checked: false, onSelect: fn() },
        { label: 'Staging', checked: false, onSelect: fn() },
        { label: 'Production API environment', checked: true, onSelect: fn() }
      ]
    ]
  },
  decorators: [
    (Story) => (
      <div className="inline-flex min-w-0 items-center rounded-md border border-separator bg-sidebar p-0.5">
        <Story />
      </div>
    )
  ],
  render: (args) => <RowActionsMenuDemo {...args} />
};

export const WithSubmenu: Story = {
  args: {
    menuId: 'row-submenu',
    groups: [
      [{ label: 'Run', onSelect: fn() }],
      [
        {
          label: 'New',
          submenu: [
            [
              { label: 'New Folder', onSelect: fn() },
              { label: 'New Request', onSelect: fn() },
              { label: 'New Markdown', onSelect: fn() }
            ]
          ]
        },
        { label: 'Import', onSelect: fn() },
        { label: 'Export', onSelect: fn() }
      ],
      [{ label: 'Delete', onSelect: fn(), variant: 'danger' }]
    ]
  },
  render: (args) => <RowActionsMenuDemo {...args} />
};

export const WithDisabledItems: Story = {
  args: {
    menuId: 'row-disabled',
    triggerVariant: 'secondary',
    triggerIcon: faCode,
    triggerLabel: 'Snippets',
    triggerAriaLabel: 'Snippets',
    triggerClassName: 'inline-flex shrink-0 items-center gap-2 whitespace-nowrap',
    groups: [
      [{ label: 'Create a snippet', onSelect: fn() }],
      [{ label: 'No snippets saved yet', disabled: true, onSelect: fn() }]
    ]
  },
  render: (args) => <RowActionsMenuDemo {...args} />
};
