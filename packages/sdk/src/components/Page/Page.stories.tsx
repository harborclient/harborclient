import { faGear } from '@fortawesome/free-solid-svg-icons';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Button } from '../Button/index.js';
import { ModalFooter } from '../Modal/index.js';
import { PanelCloseButton } from '../PanelCloseButton/index.js';
import { Page } from './index.js';

const meta = {
  title: 'Components/Page',
  component: Page,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen'
  }
} satisfies Meta<typeof Page>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Environment settings',
    description: 'Manage environment settings and configuration',
    actions: <PanelCloseButton onClose={fn()} ariaLabel="Close environment settings" />,
    children: (
      <p className="m-0 text-[14px] text-muted">
        Configure variables and defaults for this workspace.
      </p>
    )
  }
};

export const WithFooter: Story = {
  args: {
    title: 'Collection settings',
    description: 'Manage collection settings and configuration',
    actions: <PanelCloseButton onClose={fn()} ariaLabel="Close collection settings" />,
    children: (
      <p className="m-0 text-[14px] text-text">Adjust collection-specific options before saving.</p>
    ),
    footer: (
      <ModalFooter>
        <Button variant="secondary" onClick={fn()}>
          Cancel
        </Button>
        <Button variant="primary" onClick={fn()}>
          Save
        </Button>
      </ModalFooter>
    )
  }
};

export const Embedded: Story = {
  args: {
    embedded: true,
    title: 'General',
    description: 'Appearance and HTTP request defaults.',
    icon: faGear,
    actions: <PanelCloseButton onClose={fn()} ariaLabel="Close settings" />,
    children: (
      <p className="m-0 text-[14px] text-muted">
        Embedded mode omits the scroll container for use inside a sidebar layout.
      </p>
    )
  }
};
