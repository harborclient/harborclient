import type { Meta, StoryObj } from '@storybook/react-vite';
import { EmptySectionLabel } from './index.js';

const meta = {
  title: 'Components/EmptySectionLabel',
  component: EmptySectionLabel,
  tags: ['autodocs']
} satisfies Meta<typeof EmptySectionLabel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'No commits.'
  }
};

export const WithTopMargin: Story = {
  args: {
    label: 'No history available.',
    className: 'mt-3'
  }
};
