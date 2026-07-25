import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Button } from '../Button/index.js';
import { Input } from '../forms/Input.js';
import { ModalHeader } from './ModalHeader.js';
import { Modal, ModalFooter, ModalFormLayout } from './index.js';

const meta = {
  title: 'Components/Modal',
  component: Modal,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen'
  },
  args: {
    onClose: fn()
  }
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithHeader: Story = {
  args: {
    labelledBy: 'delete-modal-title',
    title: 'Delete collection',
    description: 'This action cannot be undone.',
    children: (
      <ModalFormLayout
        error="Collection is in use by 2 requests."
        actions={
          <>
            <Button variant="secondary" onClick={fn()}>
              Cancel
            </Button>
            <Button variant="primaryDanger" onClick={fn()}>
              Delete
            </Button>
          </>
        }
      >
        <p className="m-0 text-[14px] text-text">
          Permanently remove <strong>Production API</strong> and all nested requests?
        </p>
      </ModalFormLayout>
    )
  }
};

export const SimpleBody: Story = {
  args: {
    label: 'Confirm action',
    className: 'w-[420px]',
    children: (
      <>
        <p className="m-0 text-[14px] text-text">Discard unsaved changes?</p>
        <ModalFooter spaced>
          <Button variant="secondary" onClick={fn()}>
            Keep editing
          </Button>
          <Button variant="primaryDanger" onClick={fn()}>
            Discard
          </Button>
        </ModalFooter>
      </>
    )
  }
};

export const FormExample: Story = {
  args: {
    labelledBy: 'rename-modal-title',
    title: 'Rename request',
    className: 'w-[420px]',
    children: (
      <ModalFormLayout
        actions={
          <>
            <Button variant="secondary" onClick={fn()}>
              Cancel
            </Button>
            <Button variant="primary" onClick={fn()}>
              Save
            </Button>
          </>
        }
      >
        <label className="mb-1 block text-[14px] text-muted" htmlFor="request-name">
          Name
        </label>
        <Input id="request-name" defaultValue="GET /users" aria-label="Request name" />
      </ModalFormLayout>
    )
  }
};

export const HeaderOnly: Story = {
  name: 'ModalHeader',
  args: {
    label: 'Header preview',
    children: null
  },
  render: () => (
    <div className="w-96 overflow-hidden rounded-lg border border-separator bg-surface">
      <ModalHeader
        titleId="header-demo-title"
        title="Team settings"
        description="Manage members and permissions."
        onClose={fn()}
      />
    </div>
  )
};
