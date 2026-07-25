import type { Meta, StoryObj } from '@storybook/react-vite';
import { Select } from './Select.js';

const meta = {
  title: 'Components/Select',
  component: Select,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['control', 'surface', 'plain']
    },
    disabled: { control: 'boolean' }
  }
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Control: Story = {
  args: {
    defaultValue: 'json',
    'aria-label': 'Content type',
    children: (
      <>
        <option value="json">JSON</option>
        <option value="text">Plain text</option>
        <option value="form">Form data</option>
      </>
    )
  }
};

export const Surface: Story = {
  args: {
    variant: 'surface',
    defaultValue: 'staging',
    'aria-label': 'Environment',
    children: (
      <>
        <option value="development">Development</option>
        <option value="staging">Staging</option>
        <option value="production">Production</option>
      </>
    )
  }
};

export const Disabled: Story = {
  args: {
    defaultValue: 'locked',
    disabled: true,
    'aria-label': 'Locked option',
    children: (
      <>
        <option value="locked">Locked</option>
      </>
    )
  }
};
