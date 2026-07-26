import type { Meta, StoryObj } from '@storybook/react-vite';
import { FormGroup } from '../FormGroup/index.js';
import { Switch } from './Switch.js';

const meta = {
  title: 'Components/Switch',
  component: Switch,
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' }
  }
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    'aria-label': 'Enable plugin'
  }
};

export const Checked: Story = {
  args: {
    defaultChecked: true,
    'aria-label': 'Disable plugin'
  }
};

export const Disabled: Story = {
  args: {
    disabled: true,
    'aria-label': 'Enable plugin'
  }
};

export const DisabledChecked: Story = {
  args: {
    defaultChecked: true,
    disabled: true,
    'aria-label': 'Disable plugin'
  }
};

export const WithFormGroup: Story = {
  render: () => (
    <FormGroup label="Enable plugin" layout="checkbox">
      <Switch />
    </FormGroup>
  )
};
