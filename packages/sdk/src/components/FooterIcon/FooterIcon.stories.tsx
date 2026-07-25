import { faBars } from '@fortawesome/free-solid-svg-icons';
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { FooterIcon } from './index.js';

const footerBar: Decorator = (Story) => (
  <div className="inline-flex items-center gap-1 rounded-md border border-separator bg-[#252525] p-1">
    <Story />
  </div>
);

const meta = {
  title: 'Components/FooterIcon',
  component: FooterIcon,
  tags: ['autodocs'],
  decorators: [footerBar],
  args: {
    onClick: fn(),
    icon: faBars,
    label: 'sidebar'
  }
} satisfies Meta<typeof FooterIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Hidden: Story = {
  args: {
    active: false
  }
};

export const Visible: Story = {
  args: {
    active: true
  }
};

export const ToolbarMatchHidden: Story = {
  args: {
    active: false,
    activeStyle: 'selection'
  }
};

export const ToolbarMatchVisible: Story = {
  args: {
    active: true,
    activeStyle: 'selection'
  }
};
