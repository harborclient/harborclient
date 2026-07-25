import type { Meta, StoryObj } from '@storybook/react-vite';
import { SettingIdLabel } from './index.js';

const meta = {
  title: 'Components/SettingIdLabel',
  component: SettingIdLabel,
  tags: ['autodocs']
} satisfies Meta<typeof SettingIdLabel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    settingId: 'general.settings',
    children: 'General'
  }
};
