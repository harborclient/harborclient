import { faGear, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { FaIcon } from './index.js';

const meta = {
  title: 'Components/FaIcon',
  component: FaIcon,
  tags: ['autodocs'],
  argTypes: {
    icon: { control: false }
  }
} satisfies Meta<typeof FaIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    icon: faGear
  }
};

export const Large: Story = {
  args: {
    icon: faPlus,
    className: 'h-5 w-5 text-accent'
  }
};

export const WithTitle: Story = {
  args: {
    icon: faTrash,
    className: 'h-4 w-4 text-danger',
    title: 'Delete'
  }
};
