import { useMemo, useState } from '@harborclient/sdk/react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import type { KeyValue, Variable } from '../../types.js';
import type { AutocompleteSource } from '../Autocomplete/types.js';
import { KeyValueEditor } from './index.js';

const sampleVariables: Variable[] = [
  { key: 'token', value: 'abc123', defaultValue: '', share: false }
];

const initialRows: KeyValue[] = [
  { key: 'Authorization', value: 'Bearer {{token}}', enabled: true },
  { key: 'Accept', value: 'application/json', enabled: true }
];

/**
 * Creates an in-memory async autocomplete source for Storybook demos.
 */
function createMemorySource(initial: string[]): AutocompleteSource {
  let values = [...initial];

  return {
    list: async () => [...values],
    add: async (value) => {
      if (!values.some((item) => item.toLowerCase() === value.toLowerCase())) {
        values = [...values, value];
      }
    }
  };
}

const headerKeySource = createMemorySource([
  'Accept',
  'Authorization',
  'Content-Type',
  'User-Agent',
  'X-Request-Id'
]);

const headerValueSource = createMemorySource([
  'application/json',
  'application/xml',
  'Bearer {{token}}',
  'text/plain'
]);

const meta = {
  title: 'Components/KeyValueEditor',
  component: KeyValueEditor,
  tags: ['autodocs'],
  args: {
    rows: initialRows,
    onChange: fn(),
    variables: sampleVariables
  }
} satisfies Meta<typeof KeyValueEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Headers: Story = {
  args: {
    onEditVariable: fn()
  },
  render: (args) => {
    const [rows, setRows] = useState<KeyValue[]>(args.rows);
    return <KeyValueEditor {...args} rows={rows} onChange={setRows} />;
  }
};

export const EmptyRow: Story = {
  args: {
    rows: [{ key: '', value: '', enabled: true }],
    placeholderKey: 'Query key',
    placeholderValue: 'Query value'
  },
  render: (args) => {
    const [rows, setRows] = useState<KeyValue[]>(args.rows);
    return <KeyValueEditor {...args} rows={rows} onChange={setRows} />;
  }
};

export const DisabledRow: Story = {
  args: {
    rows: [{ key: 'X-Debug', value: 'true', enabled: false }]
  },
  render: (args) => {
    const [rows, setRows] = useState<KeyValue[]>(args.rows);
    return <KeyValueEditor {...args} rows={rows} onChange={setRows} />;
  }
};

export const WithAutocomplete: Story = {
  args: {
    onEditVariable: fn()
  },
  render: (args) => {
    const [rows, setRows] = useState<KeyValue[]>(initialRows);
    const keySource = useMemo(() => headerKeySource, []);
    const valueSource = useMemo(() => headerValueSource, []);

    return (
      <KeyValueEditor
        {...args}
        rows={rows}
        onChange={setRows}
        variables={sampleVariables}
        keySource={keySource}
        valueSource={valueSource}
      />
    );
  }
};
