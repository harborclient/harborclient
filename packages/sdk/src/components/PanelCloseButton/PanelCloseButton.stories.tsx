import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { PanelCloseButton } from './index.js';

const meta = {
  title: 'Components/PanelCloseButton',
  component: PanelCloseButton,
  tags: ['autodocs'],
  args: {
    onClose: fn()
  }
} satisfies Meta<typeof PanelCloseButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const CustomLabel: Story = {
  args: {
    label: 'Close panel',
    ariaLabel: 'Close settings panel'
  }
};
