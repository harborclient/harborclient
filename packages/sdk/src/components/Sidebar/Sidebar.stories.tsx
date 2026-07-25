import {
  faClock,
  faClockRotateLeft,
  faCodeBranch,
  faDownload,
  faFolder,
  faLayerGroup,
  faPenToSquare,
  faSquareMinus,
  faSun
} from '@fortawesome/free-solid-svg-icons';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { type JSX, type ReactNode, useState } from 'react';
import { fn } from 'storybook/test';
import {
  FaIcon,
  Sidebar,
  SidebarCommitItem,
  SidebarList,
  SidebarListbox,
  SidebarRequestItem,
  type SidebarSectionConfig,
  SidebarSections,
  Toolbar,
  type ToolbarAction
} from '../index.js';

const meta = {
  title: 'Components/Sidebar',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Fixed-height decorator so resize handles and scroll regions behave like the app.
 */
function FixedHeight({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="flex h-[640px] overflow-hidden bg-surface">
      {children}
      <div className="min-w-0 flex-1 bg-field p-4 text-muted">Main content area</div>
    </div>
  );
}

/**
 * Demo sections for the collections-style left sidebar.
 */
function collectionsSections(): SidebarSectionConfig[] {
  return [
    {
      key: 'collections',
      title: 'Collections',
      ariaLabel: 'Collections',
      onAdd: fn(),
      addLabel: 'Add Collection',
      children: (
        <SidebarListbox aria-label="Collections">
          <SidebarRequestItem
            method="GET"
            name="List users"
            selected
            colorDot={{ color: '#32D2E2', visible: true, label: 'Color for List users' }}
            sortable={{ id: 'request-1', dragHandleLabel: 'Reorder request "List users"' }}
          />
          <SidebarRequestItem
            method="POST"
            name="Create user"
            sortable={{ id: 'request-2', dragHandleLabel: 'Reorder request "Create user"' }}
          />
        </SidebarListbox>
      )
    },
    {
      key: 'history',
      title: 'History',
      ariaLabel: 'History',
      children: <p className="px-2 text-muted">No recent requests.</p>
    }
  ];
}

/**
 * Demo sections for the Git-style right sidebar.
 */
function gitSections(): SidebarSectionConfig[] {
  return [
    {
      key: 'commitMessage',
      title: 'Commit message',
      ariaLabel: 'Commit message',
      children: (
        <textarea
          className="field w-full resize-none"
          rows={3}
          placeholder="Describe your changes"
          aria-label="Commit message"
        />
      )
    },
    {
      key: 'changes',
      title: 'Changes',
      ariaLabel: 'Changes',
      flushBody: true,
      children: (
        <SidebarListbox aria-label="Changes">
          <SidebarRequestItem
            method="POST"
            name="Create user"
            statusMarker={{ marker: 'M', className: 'text-git-uncommitted', label: 'Modified' }}
          />
        </SidebarListbox>
      )
    },
    {
      key: 'commits',
      title: 'Commits',
      ariaLabel: 'Commits',
      children: (
        <SidebarList aria-label="Commits">
          <SidebarCommitItem
            message="Add user endpoint"
            author="Alex"
            timestampLabel="2 hours ago"
            icon={faCodeBranch}
          />
        </SidebarList>
      )
    }
  ];
}

export const CollectionsLeft: Story = {
  render: () => {
    const [expanded, setExpanded] = useState<Record<string, boolean>>({
      collections: true,
      history: true
    });

    const toolbarActions: ToolbarAction[] = [
      {
        id: 'toggle-collections',
        icon: faFolder,
        label: 'Collections',
        title: 'Collections section',
        ariaPressed: true,
        onClick: fn()
      },
      {
        id: 'toggle-history',
        icon: faClock,
        label: 'History',
        title: 'History section',
        ariaPressed: true,
        onClick: fn()
      },
      {
        id: 'toggle-environments',
        icon: faSun,
        label: 'Environments',
        title: 'Environments section',
        ariaPressed: false,
        onClick: fn()
      },
      {
        id: 'toggle-tab-groups',
        icon: faLayerGroup,
        label: 'Tab Groups',
        title: 'Tab groups section',
        ariaPressed: false,
        onClick: fn()
      }
    ];

    const toolbarToggles: ToolbarAction[] = [
      {
        id: 'collapse-all',
        icon: faSquareMinus,
        label: 'Collapse all',
        title: 'Collapse all collections and folders',
        onClick: fn()
      }
    ];

    return (
      <FixedHeight>
        <Sidebar
          side="left"
          ariaLabel="Collections sidebar"
          storageKey="storybook.sidebarWidth"
          defaultSize={320}
          minSize={240}
          getMaxSize={() => 480}
          header={
            <>
              <div className="border-b border-separator px-2 py-2 text-[15px] font-medium tracking-wide text-muted uppercase">
                Panels
              </div>
              <input
                type="search"
                className="field mx-2 mt-2"
                placeholder="Search collections"
                aria-label="Search collections"
              />
              <Toolbar
                ariaLabel="Collections sidebar"
                actions={toolbarActions}
                toggles={toolbarToggles}
              />
            </>
          }
          bodyClassName="pr-2 pb-3"
        >
          <SidebarSections
            sections={collectionsSections()}
            expanded={expanded}
            onToggle={(key, isExpanded) =>
              setExpanded((current) => ({ ...current, [key]: isExpanded }))
            }
          />
        </Sidebar>
      </FixedHeight>
    );
  }
};

export const GitRight: Story = {
  render: () => {
    const toolbarActions: ToolbarAction[] = [
      {
        id: 'git-section-commit',
        icon: faPenToSquare,
        label: 'Commit message section',
        title: 'Commit message section',
        ariaPressed: true,
        onClick: fn()
      },
      {
        id: 'git-section-changes',
        icon: faLayerGroup,
        label: 'Changes section',
        title: 'Changes section',
        ariaPressed: true,
        onClick: fn()
      },
      {
        id: 'git-section-commits',
        icon: faClockRotateLeft,
        label: 'Commits section',
        title: 'Commits section',
        ariaPressed: true,
        onClick: fn()
      }
    ];

    const toolbarToggles: ToolbarAction[] = [
      {
        id: 'git-pull',
        icon: faDownload,
        label: 'Pull changes',
        title: 'Pull changes',
        onClick: fn()
      }
    ];

    return (
      <FixedHeight>
        <div className="min-w-0 flex-1 bg-field p-4 text-muted">Main content area</div>
        <Sidebar
          side="right"
          ariaLabel="Git source control"
          storageKey="storybook.gitSidebarWidth"
          defaultSize={360}
          minSize={280}
          getMaxSize={() => 480}
          resizeAriaLabel="Resize Git sidebar"
          header={
            <>
              <div className="flex h-[56px] items-center gap-2 border-b border-separator px-2 py-1">
                <span className="inline-flex min-w-0 items-center gap-1.5 font-medium">
                  <span aria-hidden>⎇</span>
                  <span className="truncate">Demo Collection</span>
                </span>
              </div>
              <Toolbar
                ariaLabel="Git sidebar sections"
                actions={toolbarActions}
                toggles={toolbarToggles}
              />
            </>
          }
        >
          <SidebarSections sections={gitSections()} />
        </Sidebar>
      </FixedHeight>
    );
  }
};

export const GitEmptyState: Story = {
  render: () => {
    const toolbarActions: ToolbarAction[] = [
      {
        id: 'git-section-commit',
        icon: faPenToSquare,
        label: 'Commit message section',
        title: 'Commit message section',
        ariaPressed: true,
        onClick: fn()
      },
      {
        id: 'git-section-changes',
        icon: faLayerGroup,
        label: 'Changes section',
        title: 'Changes section',
        ariaPressed: true,
        onClick: fn()
      },
      {
        id: 'git-section-commits',
        icon: faClockRotateLeft,
        label: 'Commits section',
        title: 'Commits section',
        ariaPressed: true,
        onClick: fn()
      }
    ];

    return (
      <FixedHeight>
        <div className="min-w-0 flex-1 bg-field p-4 text-muted">Main content area</div>
        <Sidebar
          side="right"
          ariaLabel="Git source control"
          storageKey="storybook.gitSidebarEmptyWidth"
          defaultSize={360}
          minSize={280}
          getMaxSize={() => 480}
          resizeAriaLabel="Resize Git sidebar"
          header={
            <>
              <div className="flex h-[56px] items-center gap-2 border-b border-separator px-2 py-1">
                <span className="inline-flex min-w-0 items-center gap-1.5 font-medium">
                  <FaIcon icon={faCodeBranch} className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="truncate">Git</span>
                </span>
              </div>
              <Toolbar ariaLabel="Git sidebar sections" actions={toolbarActions} />
            </>
          }
        >
          <div
            role="status"
            aria-label="Selected collection is not git-backed"
            className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center text-muted"
          >
            <FaIcon icon={faCodeBranch} className="h-12 w-12" aria-hidden />
            <p className="m-0">
              &quot;Picsum&quot; is not stored in a git repository. Select a git-backed collection
              to use source control.
            </p>
          </div>
        </Sidebar>
      </FixedHeight>
    );
  }
};

export const AiRightNoScroll: Story = {
  render: () => {
    const toolbarActions: ToolbarAction[] = [
      {
        id: 'chat-history',
        icon: faClockRotateLeft,
        label: 'Chat history',
        title: 'Chat history',
        onClick: fn()
      }
    ];

    return (
      <FixedHeight>
        <div className="min-w-0 flex-1 bg-field p-4 text-muted">Main content area</div>
        <Sidebar
          side="right"
          ariaLabel="AI"
          scroll={false}
          storageKey="storybook.aiSidebarWidth"
          defaultSize={320}
          minSize={240}
          getMaxSize={() => 480}
          resizeAriaLabel="Resize AI sidebar"
          header={<Toolbar ariaLabel="AI sidebar" actions={toolbarActions} />}
          bodyClassName="px-2 pb-2"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-2 rounded-md border border-separator bg-field p-3">
            <p className="m-0 text-muted">Chat messages scroll inside the body.</p>
            <textarea
              className="field mt-auto resize-none"
              rows={3}
              placeholder="Ask HarborClient AI…"
              aria-label="Message"
            />
          </div>
        </Sidebar>
      </FixedHeight>
    );
  }
};

export const GitTitleBar: Story = {
  render: () => (
    <div className="flex h-24 items-stretch bg-surface">
      <Sidebar
        side="right"
        ariaLabel="Git source control"
        storageKey="storybook.gitSidebarTitle"
        defaultSize={280}
        minSize={200}
        header={
          <div className="flex h-[56px] items-center gap-2 border-b border-separator px-2 py-1">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span aria-hidden>{String.fromCharCode(0x2387)}</span>
              Git branch icon demo
            </span>
          </div>
        }
      >
        <p className="px-2 text-muted">Body content</p>
      </Sidebar>
    </div>
  )
};
