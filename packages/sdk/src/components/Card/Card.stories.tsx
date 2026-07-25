import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card } from './index.js';

const meta = {
  title: 'Components/Card',
  component: Card,
  tags: ['autodocs'],
  argTypes: {}
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Regular: Story = {
  args: {
    className: 'w-[300px]',
    children: (
      <Card.Body>
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="m-0 min-w-0 truncate text-[14px] font-semibold text-text">Plugin Name</h3>
          <span className="shrink-0 text-[14px] text-muted">v1.0.0</span>
        </div>
        <p className="m-0 text-[14px] text-text">
          This is a description of the plugin. It is a plugin that does something.
        </p>
      </Card.Body>
    )
  }
};

export const WithImage: Story = {
  args: {
    className: 'w-[300px]',
    children: (
      <>
        <Card.Image src="https://placehold.co/300x150" alt="Placeholder" />
        <Card.Body>
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="m-0 min-w-0 truncate text-[14px] font-semibold text-text">
              Plugin Name
            </h3>
            <span className="shrink-0 text-[14px] text-muted">v1.0.0</span>
          </div>
          <p className="m-0 text-[14px] text-text">
            This is a description of the plugin. It is a plugin that does something.
          </p>
        </Card.Body>
      </>
    )
  }
};
