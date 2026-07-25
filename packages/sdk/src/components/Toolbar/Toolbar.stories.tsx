import {
  faAnglesUp,
  faClock,
  faClockRotateLeft,
  faCloud,
  faDatabase,
  faFolder,
  faLayerGroup,
  faPalette,
  faPlus,
  faSquareMinus,
  faSun,
  faTrash,
  faXmark
} from '@fortawesome/free-solid-svg-icons';
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Toolbar } from './index.js';

const sidebarStrip: Decorator = (Story) => (
  <div className="w-80 border border-separator bg-sidebar">
    <div className="border-b border-separator px-2 py-3">
      <div className="rounded-md border border-separator bg-field px-2 py-1.5 text-[14px] text-muted">
        Search
      </div>
    </div>
    <Story />
  </div>
);

const meta = {
  title: 'Components/Toolbar',
  component: Toolbar,
  tags: ['autodocs'],
  decorators: [sidebarStrip],
  args: {
    ariaLabel: 'Sidebar toolbar'
  }
} satisfies Meta<typeof Toolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CloseOnly: Story = {
  args: {
    actions: [
      {
        id: 'close-sidebar',
        icon: faXmark,
        label: 'Close sidebar',
        title: 'Close sidebar',
        onClick: fn()
      }
    ]
  }
};

export const ToggleAction: Story = {
  args: {
    ariaLabel: 'Collections sidebar',
    actions: [
      {
        id: 'toggle-storage-badges',
        icon: faDatabase,
        label: 'Storage location badges',
        title: 'Hide storage location badges',
        ariaPressed: true,
        onClick: fn()
      }
    ]
  }
};

export const PressedState: Story = {
  args: {
    ariaLabel: 'Collections sidebar',
    actions: [
      {
        id: 'toggle-storage-badges',
        icon: faDatabase,
        label: 'Storage location badges',
        title: 'Hide storage location badges',
        ariaPressed: true,
        onClick: fn()
      },
      {
        id: 'close-sidebar',
        icon: faXmark,
        label: 'Close sidebar',
        title: 'Close sidebar',
        onClick: fn()
      }
    ]
  }
};

export const AiSidebarActions: Story = {
  args: {
    ariaLabel: 'AI sidebar',
    actions: [
      {
        id: 'chat-history',
        icon: faClockRotateLeft,
        label: 'Chat history',
        title: 'Chat history',
        ariaHaspopup: 'menu',
        ariaExpanded: false,
        onClick: fn()
      },
      {
        id: 'new-chat',
        icon: faPlus,
        label: 'New chat',
        title: 'New chat',
        onClick: fn()
      },
      {
        id: 'close-ai-sidebar',
        icon: faXmark,
        label: 'Close AI sidebar',
        title: 'Close AI sidebar',
        onClick: fn()
      }
    ]
  }
};

export const RightAlignedToggles: Story = {
  args: {
    ariaLabel: 'Collections sidebar',
    actions: [
      {
        id: 'toggle-collections-section',
        icon: faFolder,
        label: 'Collections',
        title: 'Hide collections section',
        ariaPressed: true,
        onClick: fn()
      },
      {
        id: 'toggle-storage-badges',
        icon: faDatabase,
        label: 'Storage location badges',
        title: 'Hide storage location badges',
        ariaPressed: true,
        onClick: fn()
      }
    ],
    toggles: [
      {
        id: 'collapse-all',
        icon: faAnglesUp,
        label: 'Collapse all',
        title: 'Collapse all collections and folders',
        onClick: fn()
      }
    ]
  }
};

/**
 * Narrow host that forces collection-style toolbar icons onto multiple rows.
 */
export const WrapsWhenNarrow: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-[180px] border border-separator bg-sidebar">
        <Story />
      </div>
    )
  ],
  args: {
    ariaLabel: 'Collections sidebar',
    actions: [
      { id: 'collections', icon: faFolder, label: 'Collections', ariaPressed: true, onClick: fn() },
      { id: 'runs', icon: faClockRotateLeft, label: 'Runs', onClick: fn() },
      { id: 'history', icon: faClock, label: 'History', onClick: fn() },
      { id: 'environments', icon: faSun, label: 'Environments', onClick: fn() },
      { id: 'tab-groups', icon: faLayerGroup, label: 'Tab groups', onClick: fn() },
      { id: 'trash', icon: faTrash, label: 'Trash', onClick: fn() },
      { id: 'cloud', icon: faCloud, label: 'Cloud', onClick: fn() },
      { id: 'themes', icon: faPalette, label: 'Themes', onClick: fn() }
    ],
    toggles: [
      {
        id: 'collapse-all',
        icon: faSquareMinus,
        label: 'Collapse all',
        title: 'Collapse all collections and folders',
        onClick: fn()
      }
    ]
  }
};
