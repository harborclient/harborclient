import type { Meta, StoryObj } from '@storybook/react-vite';
import { type JSX, useState } from 'react';
import { Breadcrumb, type BreadcrumbSegment } from './index.js';

interface BreadcrumbDemoProps {
  /**
   * Leading breadcrumb segments shown before the editable item.
   */
  segments: BreadcrumbSegment[];

  /**
   * Initial value for the editable trailing segment.
   */
  initialValue: string;

  /**
   * Placeholder when the editable value is empty.
   */
  placeholder?: string;

  /**
   * Accessible name for the editable trailing segment.
   */
  editableLabel?: string;
}

/**
 * Storybook wrapper that keeps the editable trailing segment controlled.
 */
function BreadcrumbDemo({
  segments,
  initialValue,
  placeholder,
  editableLabel
}: BreadcrumbDemoProps): JSX.Element {
  const [value, setValue] = useState(initialValue);

  return (
    <Breadcrumb
      segments={segments}
      value={value}
      placeholder={placeholder}
      editableLabel={editableLabel}
      onValueChange={setValue}
    />
  );
}

const meta = {
  title: 'Components/Breadcrumb',
  component: BreadcrumbDemo,
  tags: ['autodocs']
} satisfies Meta<typeof BreadcrumbDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EditableOnly: Story = {
  args: {
    segments: [],
    initialValue: '',
    placeholder: 'Request name',
    editableLabel: 'Request name'
  }
};

export const WithCollection: Story = {
  args: {
    segments: [{ id: 'collection', label: 'My API', onClick: () => undefined }],
    initialValue: 'Get users',
    placeholder: 'Request name',
    editableLabel: 'Request name'
  }
};

export const WithCollectionAndFolder: Story = {
  args: {
    segments: [
      { id: 'collection', label: 'My API', onClick: () => undefined },
      { id: 'folder', label: 'Users', onClick: () => undefined }
    ],
    initialValue: 'Create user',
    placeholder: 'Request name',
    editableLabel: 'Request name'
  }
};

export const LongPath: Story = {
  args: {
    segments: [
      { id: 'app', label: 'app' },
      { id: 'src', label: 'src' },
      { id: 'main', label: 'main' },
      { id: 'res', label: 'res' },
      { id: 'drawable', label: 'drawable' }
    ],
    initialValue: 'badge_background.xml',
    placeholder: 'File name',
    editableLabel: 'File name'
  }
};
