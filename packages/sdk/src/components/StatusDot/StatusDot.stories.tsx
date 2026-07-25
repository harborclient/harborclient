import type { Meta, StoryObj } from '@storybook/react-vite';
import { StatusDot } from './index.js';

const meta = {
  title: 'Components/StatusDot',
  component: StatusDot,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['success', 'danger', 'muted', 'accent', 'warning', 'info']
    },
    size: {
      control: 'select',
      options: ['sm', 'md']
    }
  }
} satisfies Meta<typeof StatusDot>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {
  args: {
    variant: 'success',
    label: 'Online'
  }
};

export const Danger: Story = {
  args: {
    variant: 'danger',
    label: 'Failed'
  }
};

export const Muted: Story = {
  args: {
    variant: 'muted',
    label: 'Offline'
  }
};

export const Accent: Story = {
  args: {
    variant: 'accent',
    label: 'Variable change'
  }
};

export const Warning: Story = {
  args: {
    variant: 'warning',
    label: 'Redirect'
  }
};

export const Info: Story = {
  args: {
    variant: 'info',
    label: 'Informational'
  }
};

export const Small: Story = {
  args: {
    variant: 'success',
    size: 'sm'
  }
};

export const Decorative: Story = {
  args: {
    variant: 'success'
  }
};
