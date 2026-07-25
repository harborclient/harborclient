import { faXmark } from '@fortawesome/free-solid-svg-icons';
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { RoundButton } from './index.js';

const panelChrome: Decorator = (Story) => (
  <div className="inline-flex items-center gap-2 rounded-md border border-separator bg-surface px-3 py-2">
    <span className="text-[14px] text-text">Panel title</span>
    <Story />
  </div>
);

const meta = {
  title: 'Components/RoundButton',
  component: RoundButton,
  tags: ['autodocs'],
  decorators: [panelChrome],
  args: {
    onClick: fn(),
    icon: faXmark,
    ariaLabel: 'Close console'
  }
} satisfies Meta<typeof RoundButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const CustomTitle: Story = {
  args: {
    ariaLabel: 'Close variables panel',
    title: 'Close'
  }
};
