import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { FooterButton } from './index.js';

const footerBar: Decorator = (Story) => (
  <div className="inline-flex items-center gap-0.5 rounded-md border border-separator bg-[#252525] px-1 py-0.5">
    <Story />
  </div>
);

const meta = {
  title: 'Components/FooterButton',
  component: FooterButton,
  tags: ['autodocs'],
  decorators: [footerBar],
  args: {
    onClick: fn(),
    controlsId: 'console-panel'
  }
} satisfies Meta<typeof FooterButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Inactive: Story = {
  args: {
    active: false,
    children: 'Console'
  }
};

export const Active: Story = {
  args: {
    active: true,
    children: 'Console'
  }
};

export const WithCount: Story = {
  args: {
    active: false,
    children: (
      <>
        Variables <span className="text-muted">(3)</span>
      </>
    )
  }
};
