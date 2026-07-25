import { useState } from '@harborclient/sdk/react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import type { Variable } from '../../types.js';
import { fieldFrame } from '../forms/index.js';
import { VariableInput } from './index.js';

const sampleVariables: Variable[] = [
  { key: 'baseUrl', value: 'https://api.example.com', defaultValue: '', share: false },
  { key: 'host', value: '', defaultValue: 'localhost', share: false }
];

const meta = {
  title: 'Components/VariableInput',
  component: VariableInput,
  tags: ['autodocs'],
  args: {
    value: '',
    onChange: fn(),
    variables: sampleVariables,
    wrapperClassName: `${fieldFrame} w-full max-w-md`
  }
} satisfies Meta<typeof VariableInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: 'Value',
    'aria-label': 'Header value'
  },
  render: (args) => {
    const [value, setValue] = useState(args.value);
    return <VariableInput {...args} value={value} onChange={setValue} />;
  }
};

export const WithTokens: Story = {
  args: {
    value: '{{baseUrl}}/v1/users',
    onEditVariable: fn(),
    'aria-label': 'URL with variables'
  },
  render: (args) => {
    const [value, setValue] = useState(args.value);
    return <VariableInput {...args} value={value} onChange={setValue} />;
  }
};

export const WithMultipleTokens: Story = {
  args: {
    value: '{{baseUrl}}/{{host}}/v1',
    onEditVariable: fn(),
    'aria-label': 'URL with multiple variables'
  },
  render: (args) => {
    const [value, setValue] = useState(args.value);
    return <VariableInput {...args} value={value} onChange={setValue} />;
  }
};

export const UndefinedVariable: Story = {
  args: {
    value: '{{missingKey}}',
    'aria-label': 'Undefined variable token'
  },
  render: (args) => {
    const [value, setValue] = useState(args.value);
    return <VariableInput {...args} value={value} onChange={setValue} />;
  }
};
