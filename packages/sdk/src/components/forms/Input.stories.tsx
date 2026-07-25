import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from './Input.js';

const meta = {
  title: 'Components/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['control', 'surface', 'plain']
    },
    type: {
      control: 'select',
      options: ['text', 'password', 'email']
    },
    disabled: { control: 'boolean' }
  }
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Control: Story = {
  args: {
    placeholder: 'API key',
    'aria-label': 'API key'
  }
};

export const Surface: Story = {
  args: {
    variant: 'surface',
    defaultValue: 'https://api.example.com',
    'aria-label': 'Endpoint URL'
  }
};

export const Disabled: Story = {
  args: {
    defaultValue: 'Read-only value',
    disabled: true,
    'aria-label': 'Read-only field'
  }
};
