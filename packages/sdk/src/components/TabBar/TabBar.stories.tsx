import { useState } from '@harborclient/sdk/react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { JSX } from 'react';
import { TabBar, type TabBarItem } from './index.js';

interface StoryTab {
  id: string;
  title: string;
}

const initialTabs: StoryTab[] = [
  { id: '1', title: 'GET Users' },
  { id: '2', title: 'POST Create user' },
  { id: '3', title: 'Collection settings' }
];

/**
 * Builds tab bar items for Storybook demos.
 */
function toTabBarItems(tabs: StoryTab[], activeId: string): TabBarItem<string>[] {
  return tabs.map((tab) => ({
    id: tab.id,
    active: tab.id === activeId,
    accessibleName: tab.title,
    closeAccessibleName: `Close ${tab.title}`,
    title: tab.title,
    dragLabel: tab.title,
    content: <span className="truncate text-[14px]">{tab.title}</span>
  }));
}

/**
 * Stateful wrapper so tab selection and close work in Storybook.
 */
function TabBarDemo({ wrap = false }: { wrap?: boolean }): JSX.Element {
  const [tabs, setTabs] = useState(initialTabs);
  const [activeId, setActiveId] = useState('1');

  return (
    <TabBar
      tabs={toTabBarItems(tabs, activeId)}
      activeId={activeId}
      wrap={wrap}
      ariaLabel="Open tabs"
      tabIdPrefix="story-tab-"
      panelIdPrefix="story-tabpanel-"
      className="min-h-16"
      newTab={{
        ariaLabel: 'New tab',
        title: 'New tab',
        onClick: () => {
          const id = String(Date.now());
          setTabs((current) => [...current, { id, title: 'New request' }]);
          setActiveId(id);
        }
      }}
      onSelect={setActiveId}
      onClose={(id) => {
        setTabs((current) => current.filter((tab) => tab.id !== id));
        setActiveId((current) => (current === id ? (tabs[0]?.id ?? '') : current));
      }}
      onReorder={(orderedIds) => {
        setTabs((current) =>
          orderedIds
            .map((id) => current.find((tab) => tab.id === id))
            .filter((tab): tab is StoryTab => tab != null)
        );
      }}
      buildContextMenuGroups={(targetId) => [
        [
          {
            label: 'Close',
            onSelect: () => {
              setTabs((current) => current.filter((tab) => tab.id !== targetId));
            }
          },
          {
            label: 'Close all',
            onSelect: () => {
              setTabs([]);
            }
          }
        ]
      ]}
      onFocusTab={(id) => {
        document.getElementById(`story-tab-${id}`)?.focus();
      }}
    />
  );
}

const meta = {
  title: 'Components/TabBar',
  component: TabBarDemo,
  tags: ['autodocs']
} satisfies Meta<typeof TabBarDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const HorizontalScroll: Story = {
  args: {
    wrap: false
  }
};

export const Wrapped: Story = {
  args: {
    wrap: true
  }
};
