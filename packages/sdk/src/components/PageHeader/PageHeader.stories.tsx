import { faGear } from '@fortawesome/free-solid-svg-icons';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button/index.js';
import { PageHeader } from './index.js';

const meta = {
  title: 'Components/PageHeader',
  component: PageHeader,
  tags: ['autodocs']
} satisfies Meta<typeof PageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TitleOnly: Story = {
  args: {
    title: 'Settings'
  }
};

export const WithDescription: Story = {
  args: {
    title: 'Environment variables',
    description: 'Manage variables scoped to this workspace.'
  }
};

export const WithIconAndActions: Story = {
  args: {
    title: 'Plugin settings',
    description: 'Configure how this plugin behaves.',
    icon: faGear,
    children: <Button variant="primary">Save</Button>
  }
};
