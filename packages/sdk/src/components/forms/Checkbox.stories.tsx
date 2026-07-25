import type { Meta, StoryObj } from '@storybook/react-vite';
import { FormGroup } from '../FormGroup/index.js';
import { Checkbox } from './Checkbox.js';

const meta = {
  title: 'Components/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' }
  }
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    'aria-label': 'Enable feature'
  }
};

export const Checked: Story = {
  args: {
    defaultChecked: true,
    'aria-label': 'Enable feature'
  }
};

export const Disabled: Story = {
  args: {
    disabled: true,
    'aria-label': 'Enable feature'
  }
};

export const DisabledChecked: Story = {
  args: {
    defaultChecked: true,
    disabled: true,
    'aria-label': 'Enable feature'
  }
};

export const WithFormGroup: Story = {
  render: () => (
    <FormGroup label="Enable debug logging" layout="checkbox">
      <Checkbox />
    </FormGroup>
  )
};
