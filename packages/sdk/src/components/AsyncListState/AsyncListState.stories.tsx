import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { AsyncListState, ErrorRetry, LoadingMessage } from './index.js';

const meta = {
  title: 'Components/AsyncListState',
  component: AsyncListState,
  tags: ['autodocs'],
  args: {
    onRetry: fn()
  }
} satisfies Meta<typeof AsyncListState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  args: {
    loading: true,
    children: null
  }
};

export const ErrorWithRetry: Story = {
  args: {
    loading: false,
    error: 'Failed to load collections.',
    onRetry: fn(),
    children: null
  }
};

export const Empty: Story = {
  args: {
    loading: false,
    isEmpty: true,
    emptyMessage: 'No items yet.',
    children: null
  }
};

export const Ready: Story = {
  args: {
    loading: false,
    children: (
      <ul className="m-0 list-none p-0 text-[14px] text-text">
        <li>Alpha collection</li>
        <li>Beta collection</li>
      </ul>
    )
  }
};

export const LoadingMessageStandalone: Story = {
  name: 'LoadingMessage',
  args: {
    loading: false,
    children: null
  },
  render: () => <LoadingMessage>Fetching data…</LoadingMessage>
};

export const ErrorRetryStandalone: Story = {
  name: 'ErrorRetry',
  args: {
    loading: false,
    children: null
  },
  render: () => <ErrorRetry error="Network error." onRetry={fn()} />
};
