import { useState } from '@harborclient/sdk/react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import type { FormDataPart, Variable } from '../../types.js';
import { FormDataEditor } from './index.js';

const sampleVariables: Variable[] = [
  { key: 'username', value: 'demo', defaultValue: '', share: false }
];

const initialParts: FormDataPart[] = [
  { key: 'name', value: '{{username}}', enabled: true, type: 'text', files: [] },
  {
    key: 'avatar',
    value: '',
    enabled: true,
    type: 'file',
    files: ['/Users/demo/Pictures/avatar.png']
  }
];

const meta = {
  title: 'Components/FormDataEditor',
  component: FormDataEditor,
  tags: ['autodocs'],
  args: {
    parts: initialParts,
    onChange: fn(),
    variables: sampleVariables,
    onSelectFiles: async () => [] as string[]
  }
} satisfies Meta<typeof FormDataEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onSelectFiles: async () => ['/tmp/upload.bin'],
    onEditVariable: fn()
  },
  render: (args) => {
    const [parts, setParts] = useState<FormDataPart[]>(args.parts);
    return <FormDataEditor {...args} parts={parts} onChange={setParts} />;
  }
};

export const TextOnly: Story = {
  args: {
    parts: [{ key: 'email', value: 'user@example.com', enabled: true, type: 'text', files: [] }]
  },
  render: (args) => {
    const [parts, setParts] = useState<FormDataPart[]>(args.parts);
    return <FormDataEditor {...args} parts={parts} onChange={setParts} />;
  }
};

export const Empty: Story = {
  args: {
    parts: []
  },
  render: (args) => {
    const [parts, setParts] = useState<FormDataPart[]>(args.parts);
    return <FormDataEditor {...args} parts={parts} onChange={setParts} />;
  }
};
