import type { Meta, StoryObj } from '@storybook/react-vite';
import { FormGroup } from '../FormGroup/index.js';
import { Radio } from './Radio.js';

const meta = {
  title: 'Components/Radio',
  component: Radio,
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' }
  }
} satisfies Meta<typeof Radio>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    name: 'example',
    value: 'option',
    'aria-label': 'Option'
  }
};

export const Checked: Story = {
  args: {
    name: 'example',
    value: 'option',
    defaultChecked: true,
    'aria-label': 'Option'
  }
};

export const Disabled: Story = {
  args: {
    name: 'example',
    value: 'option',
    disabled: true,
    'aria-label': 'Option'
  }
};

export const DisabledChecked: Story = {
  args: {
    name: 'example',
    value: 'option',
    defaultChecked: true,
    disabled: true,
    'aria-label': 'Option'
  }
};

export const WithFormGroup: Story = {
  render: () => (
    <FormGroup label="JSON" layout="radio">
      <Radio name="content-type" value="json" defaultChecked />
    </FormGroup>
  )
};

export const RadioGroup: Story = {
  render: () => (
    <fieldset className="flex flex-col gap-2 border-none p-0">
      <legend className="mb-2 text-[14px] font-medium text-text">Content type</legend>
      <FormGroup label="JSON" layout="radio">
        <Radio name="content-type-group" value="json" defaultChecked />
      </FormGroup>
      <FormGroup label="Plain text" layout="radio">
        <Radio name="content-type-group" value="text" />
      </FormGroup>
      <FormGroup label="Form data" layout="radio">
        <Radio name="content-type-group" value="form" />
      </FormGroup>
    </fieldset>
  )
};
