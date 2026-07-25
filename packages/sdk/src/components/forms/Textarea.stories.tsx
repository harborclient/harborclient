import type { Meta, StoryObj } from '@storybook/react-vite';
import { Textarea } from './Textarea.js';

const meta = {
  title: 'Components/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['control', 'surface', 'plain']
    },
    disabled: { control: 'boolean' }
  }
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Control: Story = {
  args: {
    rows: 4,
    placeholder: 'Notes…',
    'aria-label': 'Notes'
  }
};

export const Surface: Story = {
  args: {
    variant: 'surface',
    rows: 3,
    defaultValue: 'Line one\nLine two',
    'aria-label': 'Description'
  }
};

export const Disabled: Story = {
  args: {
    rows: 3,
    defaultValue: 'This field cannot be edited.',
    disabled: true,
    'aria-label': 'Read-only notes'
  }
};
