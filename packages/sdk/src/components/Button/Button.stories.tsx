import { faTrash, faXmark } from '@fortawesome/free-solid-svg-icons';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { FaIcon } from '../FaIcon/index.js';
import { Button } from './index.js';

const meta = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'primary',
        'secondary',
        'primaryDanger',
        'secondaryDanger',
        'toolbar',
        'icon',
        'iconDanger'
      ]
    },
    disabled: { control: 'boolean' }
  }
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    children: 'Save',
    variant: 'primary'
  }
};

export const Secondary: Story = {
  args: {
    children: 'Cancel',
    variant: 'secondary'
  }
};

export const PrimaryDanger: Story = {
  args: {
    children: 'Delete',
    variant: 'primaryDanger'
  }
};

export const Disabled: Story = {
  args: {
    children: 'Disabled',
    variant: 'primary',
    disabled: true
  }
};

export const Icon: Story = {
  args: {
    variant: 'icon',
    'aria-label': 'Close',
    children: <FaIcon icon={faXmark} className="h-4 w-4" />
  }
};

export const IconDanger: Story = {
  args: {
    variant: 'iconDanger',
    'aria-label': 'Remove',
    children: <FaIcon icon={faTrash} className="h-3.5 w-3.5" />
  }
};
