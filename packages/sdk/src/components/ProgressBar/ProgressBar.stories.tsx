import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProgressBar } from './index.js';

const meta = {
  title: 'Components/ProgressBar',
  component: ProgressBar,
  tags: ['autodocs'],
  args: {
    label: 'Progress'
  }
} satisfies Meta<typeof ProgressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    value: 0,
    max: 10
  }
};

export const Partial: Story = {
  args: {
    value: 3,
    max: 10
  }
};

export const Complete: Story = {
  args: {
    value: 10,
    max: 10
  }
};

export const ZeroMax: Story = {
  args: {
    value: 0,
    max: 0
  }
};
