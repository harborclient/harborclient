import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { BackButton } from './index.js';

const meta = {
  title: 'Components/BackButton',
  component: BackButton,
  tags: ['autodocs'],
  args: {
    onClick: fn()
  }
} satisfies Meta<typeof BackButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'Back'
  }
};

export const CustomLabel: Story = {
  args: {
    label: 'Return to list',
    ariaLabel: 'Return to list'
  }
};
