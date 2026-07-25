import { useState } from '@harborclient/sdk/react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { JSX } from 'react';
import { ColorPicker } from './index.js';

const meta = {
  title: 'Components/ColorPicker',
  component: ColorPicker,
  tags: ['autodocs']
} satisfies Meta<typeof ColorPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Interactive wrapper so Storybook can exercise selection and clear.
 */
function InteractivePicker(): JSX.Element {
  const [value, setValue] = useState<string | null>('#dc2626');

  return (
    <ColorPicker
      value={value}
      onChange={setValue}
      onClear={() => setValue(null)}
      aria-label="Choose sidebar item color"
    />
  );
}

export const Default: Story = {
  args: {
    value: '#dc2626',
    onChange: () => undefined
  },
  render: () => <InteractivePicker />
};

export const NoSelection: Story = {
  args: {
    value: null,
    onChange: () => undefined,
    'aria-label': 'Choose sidebar item color'
  }
};
