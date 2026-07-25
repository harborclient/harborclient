import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { TabCloseButton } from './index.js';

const tabChrome: Decorator = (Story) => (
  <div className="group inline-flex items-center gap-1 rounded-md border border-separator bg-control px-2 py-1 text-[14px] text-text">
    <span>GET /users</span>
    <Story />
  </div>
);

const meta = {
  title: 'Components/TabCloseButton',
  component: TabCloseButton,
  tags: ['autodocs'],
  decorators: [tabChrome],
  args: {
    onClick: fn(),
    ariaLabel: 'Close GET /users tab'
  }
} satisfies Meta<typeof TabCloseButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const CustomTitle: Story = {
  args: {
    ariaLabel: 'Close chat tab',
    title: 'Close chat'
  }
};
