import type { Meta, StoryObj } from '@storybook/react-vite';
import { Spinner } from './index.js';

const meta = {
  title: 'Components/Spinner',
  component: Spinner,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md']
    }
  }
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Medium: Story = {
  args: {
    size: 'md',
    label: 'Loading'
  }
};

export const Small: Story = {
  args: {
    size: 'sm'
  }
};
