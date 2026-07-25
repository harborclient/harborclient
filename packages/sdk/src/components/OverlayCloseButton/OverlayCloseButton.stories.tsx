import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { OverlayCloseButton } from './index.js';

const meta = {
  title: 'Components/OverlayCloseButton',
  component: OverlayCloseButton,
  tags: ['autodocs'],
  args: {
    onClose: fn()
  }
} satisfies Meta<typeof OverlayCloseButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const CustomLabel: Story = {
  args: {
    label: 'Dismiss settings'
  }
};
