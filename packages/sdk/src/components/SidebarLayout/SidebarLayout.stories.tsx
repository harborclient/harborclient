import type { Meta, StoryObj } from '@storybook/react-vite';
import { Page } from '../Page/index.js';
import { PageSidebar } from '../PageSidebar/index.js';
import { SidebarLayout } from './index.js';

const meta = {
  title: 'Components/SidebarLayout',
  component: SidebarLayout,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen'
  }
} satisfies Meta<typeof SidebarLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    sidebar: null,
    children: null
  },
  render: () => (
    <SidebarLayout
      sidebar={
        <PageSidebar
          ariaLabel="Example sections"
          selected="one"
          onSelect={() => undefined}
          items={[
            { value: 'one', label: 'Section one' },
            { value: 'two', label: 'Section two' }
          ]}
        />
      }
    >
      <Page embedded title="Section one">
        <p className="m-0 text-[14px] text-muted">Scrollable content area.</p>
      </Page>
    </SidebarLayout>
  )
};
