import { faGear, faKeyboard } from '@fortawesome/free-solid-svg-icons';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Page } from '../Page/index.js';
import { SidebarLayout } from '../SidebarLayout/index.js';
import { PageSidebar } from './index.js';

const meta = {
  title: 'Components/PageSidebar',
  component: PageSidebar,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen'
  }
} satisfies Meta<typeof PageSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithIcons: Story = {
  args: {
    ariaLabel: 'Settings sections',
    selected: 'general',
    onSelect: fn(),
    items: [
      { value: 'general', label: 'General', icon: faGear },
      { value: 'shortcuts', label: 'Shortcuts', icon: faKeyboard }
    ]
  },
  render: (args) => (
    <SidebarLayout sidebar={<PageSidebar {...args} />}>
      <Page embedded title="General" description="Appearance and defaults.">
        <p className="m-0 text-[14px] text-muted">Settings panel content.</p>
      </Page>
    </SidebarLayout>
  )
};

export const WithoutIcons: Story = {
  args: {
    ariaLabel: 'Sharing keys sections',
    selected: 'identity',
    onSelect: fn(),
    items: [
      { value: 'identity', label: 'Identity' },
      { value: 'trusted', label: 'Trusted keys' }
    ]
  },
  render: (args) => (
    <SidebarLayout sidebar={<PageSidebar {...args} />}>
      <Page embedded title="Identity">
        <p className="m-0 text-[14px] text-muted">Sharing keys panel content.</p>
      </Page>
    </SidebarLayout>
  )
};
