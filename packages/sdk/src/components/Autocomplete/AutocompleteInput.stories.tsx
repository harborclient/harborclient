import { useMemo, useState } from '@harborclient/sdk/react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { AutocompleteInput } from './AutocompleteInput.js';
import type { AutocompleteSource } from './types.js';

const US_STATES = [
  'Alabama',
  'Alaska',
  'Arizona',
  'Arkansas',
  'California',
  'Colorado',
  'Connecticut',
  'Delaware',
  'Florida',
  'Georgia',
  'Hawaii',
  'Idaho',
  'Illinois',
  'Indiana',
  'Iowa',
  'Kansas',
  'Kentucky',
  'Louisiana',
  'Maine',
  'Maryland',
  'Massachusetts',
  'Michigan',
  'Minnesota',
  'Mississippi',
  'Missouri',
  'Montana',
  'Nebraska',
  'Nevada',
  'New Hampshire',
  'New Jersey',
  'New Mexico',
  'New York',
  'North Carolina',
  'North Dakota',
  'Ohio',
  'Oklahoma',
  'Oregon',
  'Pennsylvania',
  'Rhode Island',
  'South Carolina',
  'South Dakota',
  'Tennessee',
  'Texas',
  'Utah',
  'Vermont',
  'Virginia',
  'Washington',
  'West Virginia',
  'Wisconsin',
  'Wyoming'
];

/**
 * Creates an in-memory async autocomplete source backed by React state.
 */
function createMemorySource(initial: string[]): {
  source: AutocompleteSource;
  useSource: () => AutocompleteSource;
} {
  let values = [...initial];

  const source: AutocompleteSource = {
    list: async () => [...values],
    add: async (value) => {
      if (!values.some((item) => item.toLowerCase() === value.toLowerCase())) {
        values = [...values, value];
      }
    }
  };

  return {
    source,
    /**
     * Returns a stable source instance for Storybook renders.
     */
    useSource: () => useMemo(() => source, [])
  };
}

const stateSource = createMemorySource(US_STATES);

const meta = {
  title: 'Components/AutocompleteInput',
  component: AutocompleteInput,
  tags: ['autodocs'],
  args: {
    value: '',
    placeholder: 'State',
    'aria-label': 'State'
  }
} satisfies Meta<typeof AutocompleteInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onChange: fn()
  },
  render: (args) => {
    const [value, setValue] = useState(args.value);
    return <AutocompleteInput {...args} value={value} onChange={setValue} />;
  }
};

export const WithSource: Story = {
  args: {
    onChange: fn()
  },
  render: (args) => {
    const [value, setValue] = useState('Cal');
    const { useSource } = stateSource;
    const source = useSource();

    return (
      <AutocompleteInput
        {...args}
        value={value}
        onChange={setValue}
        source={source}
        placeholder="State"
        aria-label="State"
      />
    );
  }
};
