import { useState } from '@harborclient/sdk/react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactElement } from 'react';
import { fn } from 'storybook/test';
import { Button } from '../Button/index.js';
import { RowActionsMenu } from '../RowActionsMenu/index.js';
import {
  ResourceList,
  ResourceListEmptyItem,
  ResourceListPrimary,
  ResourceListRow
} from './index.js';

const meta = {
  title: 'Components/ResourceList',
  component: ResourceList,
  tags: ['autodocs'],
  args: {
    children: null
  }
} satisfies Meta<typeof ResourceList>;

export default meta;
type Story = StoryObj<typeof meta>;

function RowActionsDemo(): ReactElement {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  return (
    <RowActionsMenu
      menuId="item-1"
      openMenuId={openMenuId}
      onOpenChange={setOpenMenuId}
      groups={[
        [
          { label: 'Rename', onSelect: fn() },
          { label: 'Duplicate', onSelect: fn() }
        ],
        [{ label: 'Delete', onSelect: fn(), variant: 'danger' }]
      ]}
    />
  );
}

export const WithRows: Story = {
  render: () => (
    <ResourceList aria-label="API endpoints">
      <ResourceListRow
        primary={<ResourceListPrimary>Production API</ResourceListPrimary>}
        secondary="https://api.example.com"
        actions={<RowActionsDemo />}
      />
      <ResourceListRow
        primary={<ResourceListPrimary>Staging API</ResourceListPrimary>}
        secondary="https://staging.example.com"
        actions={
          <Button variant="secondary" onClick={fn()}>
            Open
          </Button>
        }
      />
    </ResourceList>
  )
};

export const Empty: Story = {
  render: () => (
    <ResourceList aria-label="Collections">
      <ResourceListEmptyItem>No collections yet.</ResourceListEmptyItem>
    </ResourceList>
  )
};

export const WrappingRow: Story = {
  render: () => (
    <ResourceList aria-label="Collections" className="max-w-xs">
      <ResourceListRow
        wrap
        primary={
          <ResourceListPrimary>
            Long collection name that wraps on narrow widths
          </ResourceListPrimary>
        }
        secondary="extra-long-identifier.example.com/v1/resources"
        actions={
          <Button variant="secondary" onClick={fn()}>
            Edit
          </Button>
        }
      />
    </ResourceList>
  )
};
