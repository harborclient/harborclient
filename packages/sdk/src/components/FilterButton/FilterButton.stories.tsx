import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { FilterButton } from './index.js';

const meta = {
  title: 'Components/FilterButton',
  component: FilterButton,
  tags: ['autodocs'],
  args: {
    onClick: fn(),
    'aria-label': 'Filter collections'
  }
} satisfies Meta<typeof FilterButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Inactive filter trigger with muted icon color.
 */
export const Default: Story = {
  args: {
    active: false
  }
};

/**
 * Active filter trigger with accent corner indicator.
 */
export const Active: Story = {
  args: {
    active: true
  }
};

/**
 * Open filter dialog: expanded ARIA state with active indicator.
 */
export const Expanded: Story = {
  args: {
    active: true,
    'aria-expanded': true,
    'aria-haspopup': 'dialog'
  }
};
