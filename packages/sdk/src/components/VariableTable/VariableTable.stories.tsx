import { useState } from '@harborclient/sdk/react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import type { Variable } from '../../types.js';
import { VariableTable } from './index.js';

const initialVariables: Variable[] = [
  { key: 'baseUrl', value: 'https://api.example.com', defaultValue: '', share: true },
  { key: 'apiKey', value: '', defaultValue: 'dev-key', share: false }
];

const meta = {
  title: 'Components/VariableTable',
  component: VariableTable,
  tags: ['autodocs'],
  args: {
    variables: initialVariables,
    onChange: fn()
  }
} satisfies Meta<typeof VariableTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const [variables, setVariables] = useState<Variable[]>(args.variables);
    return <VariableTable {...args} variables={variables} onChange={setVariables} />;
  }
};

export const WithDescription: Story = {
  args: {
    variables: [{ key: '', value: '', defaultValue: '', share: false }],
    description: 'Variables are substituted into requests using {{key}} syntax.'
  },
  render: (args) => {
    const [variables, setVariables] = useState<Variable[]>(args.variables);
    return <VariableTable {...args} variables={variables} onChange={setVariables} />;
  }
};

export const SingleEmptyRow: Story = {
  args: {
    variables: [{ key: '', value: '', defaultValue: '', share: false }]
  },
  render: (args) => {
    const [variables, setVariables] = useState<Variable[]>(args.variables);
    return <VariableTable {...args} variables={variables} onChange={setVariables} />;
  }
};
