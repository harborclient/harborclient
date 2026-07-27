import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactElement } from 'react';
import { fn } from 'storybook/test';
import { SettingFieldActions } from './index.js';

const meta = {
  title: 'Components/SettingFieldActions',
  component: SettingFieldActions,
  tags: ['autodocs'],
  args: {
    settingId: 'general.verifySsl',
    isModified: false,
    onReset: fn(),
    onCopyId: fn()
  },
  decorators: [
    (Story) => (
      <div className="group/setting-field flex items-center gap-2 rounded-md border border-separator p-4">
        <Story />
        <span className="font-medium text-text">Verify SSL certificates</span>
      </div>
    )
  ],
  parameters: {
    docs: {
      description: {
        component:
          'Requires a parent with `group/setting-field` so the gear reveals on hover and focus. Always visible when `isModified` is true.'
      }
    }
  }
} satisfies Meta<typeof SettingFieldActions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Hover or focus the row to reveal the gear. Reset Setting is disabled.'
      }
    }
  }
};

export const Modified: Story = {
  args: {
    isModified: true
  },
  parameters: {
    docs: {
      description: {
        story: 'When modified, the gear stays visible and Reset Setting is enabled.'
      }
    }
  }
};

/**
 * Demonstrates the open menu state for visual regression and docs.
 */
function OpenMenuDemo(): ReactElement {
  return (
    <SettingFieldActions
      settingId="syntax.lineNumbers"
      isModified={true}
      onReset={fn()}
      onCopyId={fn()}
    />
  );
}

export const ModifiedWithLabel: Story = {
  args: {
    settingId: 'syntax.lineNumbers',
    isModified: true
  },
  render: () => <OpenMenuDemo />,
  parameters: {
    docs: {
      description: {
        story: 'Nested catalog path example (`syntax.lineNumbers`) with modified styling.'
      }
    }
  }
};
