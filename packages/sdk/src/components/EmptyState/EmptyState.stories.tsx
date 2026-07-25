import type { Meta, StoryObj } from '@storybook/react-vite';
import { EmptyState } from './index.js';

const meta = {
  title: 'Components/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['inline', 'centered']
    }
  }
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Inline: Story = {
  args: {
    children: 'No items yet.',
    variant: 'inline'
  }
};

export const Centered: Story = {
  args: {
    children: 'No requests in this collection.',
    variant: 'centered'
  },
  decorators: [
    (Story) => (
      <div className="flex h-40 w-full border border-separator">
        <Story />
      </div>
    )
  ]
};
