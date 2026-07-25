import {
  faChevronDown,
  faChevronRight,
  faCodeBranch,
  faFolder,
  faLayerGroup,
  faPersonRunning
} from '@fortawesome/free-solid-svg-icons';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { RowActionsMenu } from '../RowActionsMenu/index.js';
import {
  SidebarCommitItem,
  SidebarDocumentItem,
  SidebarEnvironmentItem,
  SidebarFolderItem,
  SidebarHistoryItem,
  SidebarList,
  SidebarListbox,
  SidebarRequestItem,
  SidebarRunItem,
  SidebarTabGroupItem,
  SidebarTree,
  SidebarTreeGroup
} from './index.js';

const meta = {
  title: 'Components/SidebarItem',
  tags: ['autodocs']
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const noopMenuGroups = [[{ label: 'Example action', onSelect: fn() }]];

export const RequestItem: Story = {
  render: () => (
    <div className="w-72 rounded-md border border-separator bg-sidebar p-2">
      <SidebarListbox aria-label="Requests">
        <SidebarRequestItem
          method="GET"
          name="List users"
          selected
          colorDot={{ color: '#32D2E2', visible: true, label: 'Color for List users' }}
          sortable={{ id: 'request-1', dragHandleLabel: 'Reorder request "List users"' }}
          actions={
            <RowActionsMenu
              menuId="request-1"
              openMenuId={null}
              onOpenChange={fn()}
              groups={noopMenuGroups}
            />
          }
        />
      </SidebarListbox>
    </div>
  )
};

export const RequestItemGitChange: Story = {
  render: () => (
    <div className="w-72 rounded-md border border-separator bg-sidebar p-2">
      <SidebarListbox aria-label="Changes">
        <SidebarRequestItem
          method="POST"
          name="Create user"
          statusMarker={{ marker: 'M', className: 'text-git-uncommitted', label: 'Modified' }}
          actions={
            <RowActionsMenu
              menuId="git-change-1"
              openMenuId={null}
              onOpenChange={fn()}
              groups={[[{ label: 'Revert changes', variant: 'danger', onSelect: fn() }]]}
            />
          }
        />
      </SidebarListbox>
    </div>
  )
};

/**
 * Collection folder + request change rows as in the git sidebar / commit details
 * modal. Confirms the solid folder icon's left edge lines up with method text.
 */
export const GitChangeCollectionAndRequest: Story = {
  render: () => (
    <div className="w-72 rounded-md border border-separator bg-sidebar p-2">
      <SidebarListbox aria-label="Changes">
        <SidebarDocumentItem
          icon={faFolder}
          iconClassName="text-doc-markdown"
          name="My Collection"
          statusMarker={{ marker: 'M', className: 'text-git-uncommitted', label: 'Modified' }}
        />
        <SidebarRequestItem
          method="POST"
          name="Echo POST"
          statusMarker={{ marker: 'A', className: 'text-git-unstaged', label: 'Added' }}
        />
      </SidebarListbox>
    </div>
  )
};

export const DocumentItem: Story = {
  render: () => (
    <div className="w-72 rounded-md border border-separator bg-sidebar p-2">
      <SidebarListbox aria-label="Documents">
        <SidebarDocumentItem
          name="README"
          selected
          colorDot={{ color: '#0f2e56', visible: true, label: 'Color for README' }}
          actions={
            <RowActionsMenu
              menuId="document-1"
              openMenuId={null}
              onOpenChange={fn()}
              groups={noopMenuGroups}
            />
          }
        />
      </SidebarListbox>
    </div>
  )
};

export const FolderItem: Story = {
  render: () => (
    <div className="w-72 rounded-md border border-separator bg-sidebar p-2">
      <SidebarTree aria-label="Collections">
        <SidebarFolderItem
          name="Auth"
          expanded
          selected
          dropHighlighted
          childrenId="folder-auth-children"
          level={1}
          setSize={1}
          posInSet={1}
          ariaLabel="Auth folder"
          expandIcon={faChevronRight}
          collapseIcon={faChevronDown}
          onToggleExpand={fn()}
          onNameClick={fn()}
          sortable={{ id: 'folder-1', dragHandleLabel: 'Reorder folder "Auth"' }}
          colorDot={{ color: '#92a8b8', visible: true, label: 'Color for Auth' }}
          actions={
            <RowActionsMenu
              menuId="folder-1"
              openMenuId={null}
              onOpenChange={fn()}
              groups={noopMenuGroups}
            />
          }
        />
        <SidebarTreeGroup id="folder-auth-children">
          <SidebarRequestItem
            method="POST"
            name="Login"
            sortable={{ id: 'request-auth-1', dragHandleLabel: 'Reorder request "Login"' }}
          />
        </SidebarTreeGroup>
      </SidebarTree>
    </div>
  )
};

export const RunItem: Story = {
  render: () => (
    <div className="w-72 rounded-md border border-separator bg-sidebar p-2">
      <SidebarListbox aria-label="Runs" multiselectable>
        <SidebarRunItem
          method="GET"
          label="Smoke test"
          connectionBadge="Local"
          statusDotClassName="bg-success"
          statusSummary="All passed"
          actions={
            <RowActionsMenu
              menuId="run-1"
              openMenuId={null}
              onOpenChange={fn()}
              groups={noopMenuGroups}
            />
          }
        />
      </SidebarListbox>
    </div>
  )
};

export const HistoryItem: Story = {
  render: () => (
    <div className="w-72 rounded-md border border-separator bg-sidebar p-2">
      <SidebarListbox aria-label="History" multiselectable>
        <SidebarHistoryItem
          method="GET"
          name="https://api.example.com/users"
          status={200}
          statusText="OK"
          ariaLabel="GET request"
          actions={
            <RowActionsMenu
              menuId="history-1"
              openMenuId={null}
              onOpenChange={fn()}
              groups={noopMenuGroups}
            />
          }
        />
      </SidebarListbox>
    </div>
  )
};

export const HistoryRunItem: Story = {
  render: () => (
    <div className="w-72 rounded-md border border-separator bg-sidebar p-2">
      <SidebarListbox aria-label="History" multiselectable>
        <SidebarHistoryItem
          method="RUN"
          name="Collection runner"
          isRun
          runIcon={faPersonRunning}
          ariaLabel="Run history entry"
          actions={
            <RowActionsMenu
              menuId="history-run-1"
              openMenuId={null}
              onOpenChange={fn()}
              groups={noopMenuGroups}
            />
          }
        />
      </SidebarListbox>
    </div>
  )
};

export const EnvironmentItem: Story = {
  render: () => (
    <div className="w-72 rounded-md border border-separator bg-sidebar p-2">
      <SidebarListbox aria-label="Environments">
        <SidebarEnvironmentItem
          name="Production"
          variableSummary="12 variables"
          selected
          colorDot={{ color: '#e74c3c', visible: true, label: 'Color for Production' }}
          sortable={{ id: 'env-1', dragHandleLabel: 'Reorder environment "Production"' }}
          actions={
            <RowActionsMenu
              menuId="env-1"
              openMenuId={null}
              onOpenChange={fn()}
              groups={noopMenuGroups}
            />
          }
        />
      </SidebarListbox>
    </div>
  )
};

export const TabGroupItem: Story = {
  render: () => (
    <div className="w-72 rounded-md border border-separator bg-sidebar p-2">
      <SidebarListbox aria-label="Tab groups" multiselectable>
        <SidebarTabGroupItem
          name="API review"
          summary="4 tabs"
          icon={faLayerGroup}
          colorDot={{ color: '#32D2E2', visible: true, label: 'Color for API review' }}
          sortable={{ id: 'tab-group-1', dragHandleLabel: 'Reorder tab group "API review"' }}
          actions={
            <RowActionsMenu
              menuId="tab-group-1"
              openMenuId={null}
              onOpenChange={fn()}
              groups={noopMenuGroups}
            />
          }
        />
      </SidebarListbox>
    </div>
  )
};

export const CommitItem: Story = {
  render: () => (
    <div className="w-72 rounded-md border border-separator bg-sidebar p-2">
      <SidebarList aria-label="Commits">
        <SidebarCommitItem
          message="Fix auth header handling"
          author="Alex"
          timestampLabel="Jul 14, 2026, 10:00 AM"
          icon={faCodeBranch}
          pushStatus="pushed"
          onClick={fn()}
        />
        <SidebarCommitItem
          message="Draft local experiment"
          author="Alex"
          timestampLabel="Jul 15, 2026, 9:00 AM"
          icon={faCodeBranch}
          pushStatus="unpushed"
          onClick={fn()}
        />
        <SidebarCommitItem
          message="Before first fetch"
          author="Alex"
          timestampLabel="Jul 13, 2026, 4:00 PM"
          icon={faCodeBranch}
          pushStatus="unknown"
          onClick={fn()}
        />
      </SidebarList>
    </div>
  )
};
