import {
  faDiagramProject,
  faFolder,
  faGlobe,
  faLayerGroup,
  faTrash
} from '@fortawesome/free-solid-svg-icons';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { type JSX, useState } from 'react';
import { fn } from 'storybook/test';
import { SidebarRail, type SidebarRailItemData } from './index.js';

const railItems: SidebarRailItemData[] = [
  { id: 'collections', icon: faFolder, label: 'Collections' },
  { id: 'environments', icon: faGlobe, label: 'Environments' },
  { id: 'workspaces', icon: faLayerGroup, label: 'Workspaces' },
  { id: 'workflows', icon: faDiagramProject, label: 'Workflows' },
  { id: 'trash', icon: faTrash, label: 'Trash' }
];

/**
 * Stateful wrapper so Storybook demos can toggle expand/collapse and selection.
 * Renders the five default rail modes with separators between each item.
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
    ariaLabel: 'Sidebar'
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
