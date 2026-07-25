import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './index.js';

const meta = {
  title: 'Components/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['success', 'danger', 'muted', 'accent', 'warning', 'category']
    }
  }
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Muted: Story = {
  args: {
    children: 'Draft',
    variant: 'muted'
  }
};

export const Success: Story = {
  args: {
    children: 'Active',
    variant: 'success'
  }
};

export const Danger: Story = {
  args: {
    children: 'Error',
    variant: 'danger'
  }
};

export const Accent: Story = {
  args: {
    children: 'New',
    variant: 'accent'
  }
};

export const Warning: Story = {
  args: {
    children: 'Permissions',
    variant: 'warning'
  }
};

export const Category: Story = {
  args: {
    children: 'Productivity',
    variant: 'category'
  }
};
