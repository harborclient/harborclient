import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Resizable, ResizeHandle } from './index.js';

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
  title: 'Components/Resizable',
  component: Resizable,
  tags: ['autodocs'],
  decorators: [footerShell],
  args: {
    id: 'console-panel',
    storageKey: 'storybook-console-height',
    closeLabel: 'console',
    onClose: fn()
  }
} satisfies Meta<typeof Resizable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OpenWithHeader: Story = {
  args: {
    open: true,
    title: <span className="text-[14px] font-medium text-text">Console</span>,
    children: (
      <div className="min-h-0 flex-1 overflow-y-auto p-3 font-mono text-[13px] text-text">
        <div>[info] Request sent</div>
        <div>[info] Response 200 OK</div>
      </div>
    )
  }
};

export const Headerless: Story = {
  args: {
    open: true,
    headerless: true,
    children: (
      <div className="min-h-0 flex-1 overflow-y-auto p-4 text-[14px] text-muted">
        Headerless panel with overlay close button.
      </div>
    )
  }
};

export const Closed: Story = {
  args: {
    open: false,
    title: 'Variables',
    children: <div className="p-3 text-[14px] text-muted">Panel content</div>
  }
};

export const ResizeHandleStandalone: Story = {
  name: 'ResizeHandle',
  args: {
    open: true,
    children: null
  },
  render: () => (
    <div className="w-full max-w-md">
      <ResizeHandle
        orientation="horizontal"
        value={200}
        min={120}
        max={400}
        onResizeStart={fn()}
        onKeyboardResize={fn()}
        ariaLabel="Resize panel"
      />
    </div>
  ),
  decorators: []
};
