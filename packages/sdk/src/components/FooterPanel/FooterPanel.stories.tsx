import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { FooterPanel } from './index.js';

const footerShell: Decorator = (Story) => (
  <div className="relative h-[420px] w-full max-w-3xl overflow-hidden rounded-md border border-separator">
    <div className="flex h-full min-h-0 flex-col">
      <div id="main-content" className="min-h-0 flex-1 p-4 text-[14px] text-muted">
        Main workspace — footer panel slides up from the bottom edge.
      </div>
      <div className="relative shrink-0">
        <Story />
      </div>
    </div>
  </div>
);

const meta = {
  title: 'Components/FooterPanel',
  component: FooterPanel,
  tags: ['autodocs'],
  decorators: [footerShell],
  args: {
    id: 'console-panel',
    storageKey: 'storybook-footer-panel-height',
    closeLabel: 'console',
    onClose: fn()
  }
} satisfies Meta<typeof FooterPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  args: {
    open: true,
    title: <span className="text-[14px] font-medium text-text">Console</span>,
    children: (
      <div className="p-3 font-mono text-[13px] text-text">
        <div>[info] Request sent</div>
        <div>[info] Response 200 OK</div>
        <div>[info] Response body parsed</div>
      </div>
    )
  }
};

export const Variables: Story = {
  args: {
    id: 'variables-panel',
    storageKey: 'storybook-variables-panel-height',
    closeLabel: 'variables',
    open: true,
    title: <span className="text-[14px] font-medium text-text">Variables</span>,
    children: (
      <div className="p-3 text-[14px] text-text">
        <div className="grid grid-cols-[1fr_1fr] gap-2 border-b border-separator pb-2 font-medium text-muted">
          <span>Name</span>
          <span>Value</span>
        </div>
        <div className="grid grid-cols-[1fr_1fr] gap-2 py-2">
          <span>baseUrl</span>
          <span className="font-mono">https://api.example.com</span>
        </div>
        <div className="grid grid-cols-[1fr_1fr] gap-2 py-2">
          <span>token</span>
          <span className="font-mono text-muted">••••••••</span>
        </div>
      </div>
    )
  }
};

export const Closed: Story = {
  args: {
    open: false,
    title: 'Console',
    children: <div className="p-3 text-[14px] text-muted">Panel content</div>
  }
};
