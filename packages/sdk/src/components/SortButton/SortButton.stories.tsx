import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { SortButton } from './index.js';

const meta = {
  title: 'Components/SortButton',
  component: SortButton,
  tags: ['autodocs'],
  args: {
    onClick: fn(),
    'aria-label': 'Sort collections'
  }
} satisfies Meta<typeof SortButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Inactive sort trigger with muted icon color.
 */
export const Default: Story = {
  args: {
    active: false
  }
};

/**
 * Active sort trigger with accent corner indicator.
 */
export const Active: Story = {
  args: {
    active: true
  }
};

/**
 * Open sort listbox: expanded ARIA state with active indicator.
 */
export const Expanded: Story = {
  args: {
    active: true,
    'aria-expanded': true,
    'aria-haspopup': 'listbox'
  }
};
