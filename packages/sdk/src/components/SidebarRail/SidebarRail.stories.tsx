import { faFolder, faLeaf, faRoute, faServer, faTrash } from '@fortawesome/free-solid-svg-icons';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { type JSX, useState } from 'react';
import { fn } from 'storybook/test';
import { SidebarRail, type SidebarRailItemData } from './index.js';

const railItems: SidebarRailItemData[] = [
  { id: 'collections', icon: faFolder, label: 'Collections' },
  { id: 'environments', icon: faLeaf, label: 'Environments' },
  { id: 'workflows', icon: faRoute, label: 'Workflows' },
  { id: 'servers', icon: faServer, label: 'Servers' },
  { id: 'trash', icon: faTrash, label: 'Trash' }
];

/**
 * Stateful wrapper so Storybook demos can toggle expand/collapse and selection.
 * Renders the five default rail modes with a separator after each item.
 *
 * @param props - Initial expanded/active state and optional select spy.
 * @returns Interactive SidebarRail for stories.
 */
function InteractiveRail({
  initialExpanded = false,
  initialActiveId = 'collections',
  onSelect = fn()
}: {
  initialExpanded?: boolean;
  initialActiveId?: string;
  onSelect?: (id: string) => void;
}): JSX.Element {
  const [expanded, setExpanded] = useState(initialExpanded);
  const [activeId, setActiveId] = useState(initialActiveId);

  return (
    <div className="flex h-[420px] border border-separator bg-sidebar">
      <SidebarRail
        items={railItems}
        activeId={activeId}
        expanded={expanded}
        onExpandedChange={setExpanded}
        onSelect={(id) => {
          setActiveId(id);
          onSelect(id);
        }}
      />
      <div className="flex flex-1 items-center justify-center text-muted">Sidebar body</div>
    </div>
  );
}

const meta = {
  title: 'Components/SidebarRail',
  component: SidebarRail,
  tags: ['autodocs'],
  args: {
    items: railItems,
    activeId: 'collections',
    expanded: false,
    onSelect: fn(),
    onExpandedChange: fn(),
    ariaLabel: 'Sidebar modes'
  }
} satisfies Meta<typeof SidebarRail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {
  render: () => <InteractiveRail initialExpanded={false} />
};

export const Expanded: Story = {
  render: () => <InteractiveRail initialExpanded />
};

export const ActiveWorkflows: Story = {
  render: () => <InteractiveRail initialExpanded initialActiveId="workflows" />
};

export const WithBadge: Story = {
  render: () => {
    const itemsWithBadge: SidebarRailItemData[] = railItems.map((item) => {
      if (item.id === 'collections') {
        return { ...item, badge: true };
      }
      if (item.id === 'servers') {
        return { ...item, badge: true, badgeVariant: 'success' as const };
      }
      return item;
    });

    return (
      <div className="flex h-[420px] border border-separator bg-sidebar">
        <SidebarRail
          items={itemsWithBadge}
          activeId="collections"
          expanded={false}
          onExpandedChange={fn()}
          onSelect={fn()}
          ariaLabel="Sidebar modes"
          panelId="story-sidebar-rail-panel"
        />
        <div
          id="story-sidebar-rail-panel"
          role="tabpanel"
          aria-labelledby="hc-sidebar-rail-tab-collections"
          className="flex flex-1 items-center justify-center text-muted"
        >
          Sidebar body
        </div>
      </div>
    );
  }
};
