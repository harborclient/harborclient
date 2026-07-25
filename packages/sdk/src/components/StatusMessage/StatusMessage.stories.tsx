import type { Meta, StoryObj } from '@storybook/react-vite';
import { StatusMessage } from './index.js';

const meta = {
  title: 'Components/StatusMessage',
  component: StatusMessage,
  tags: ['autodocs'],
  argTypes: {
    live: { control: 'boolean' }
  }
} satisfies Meta<typeof StatusMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Saving changes…',
    live: true
  }
};

export const Static: Story = {
  args: {
    children: 'Last saved 2 minutes ago.',
    live: false
  }
};
