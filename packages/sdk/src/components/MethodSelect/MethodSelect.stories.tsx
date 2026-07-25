import { useState } from '@harborclient/sdk/react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import type { HttpMethod } from '../../types.js';
import { MethodSelect } from './index.js';

const meta = {
  title: 'Components/MethodSelect',
  component: MethodSelect,
  tags: ['autodocs'],
  args: {
    value: 'GET',
    onChange: fn()
  }
} satisfies Meta<typeof MethodSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: 'POST'
  },

  render: (args) => {
    const [method, setMethod] = useState<HttpMethod>(args.value);
    return <MethodSelect value={method} onChange={setMethod} />;
  }
};

export const PostSelected: Story = {
  args: {
    value: 'PATCH'
  },
  render: (args) => {
    const [method, setMethod] = useState<HttpMethod>(args.value);
    return <MethodSelect value={method} onChange={setMethod} />;
  }
};
