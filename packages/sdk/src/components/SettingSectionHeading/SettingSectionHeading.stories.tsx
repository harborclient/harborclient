import type { Meta, StoryObj } from '@storybook/react-vite';
import { SettingSectionHeading } from './index.js';

const meta = {
  title: 'Components/SettingSectionHeading',
  component: SettingSectionHeading,
  tags: ['autodocs']
} satisfies Meta<typeof SettingSectionHeading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithDescription: Story = {
  args: {
    settingId: 'general.settings',
    title: 'General',
    description:
      'These defaults apply to outbound HTTP requests sent from HarborClient. Control how long requests and pre/post scripts may run.'
  }
};

export const TitleOnly: Story = {
  args: {
    settingId: 'git.identities',
    title: 'Git Identities'
  }
};
