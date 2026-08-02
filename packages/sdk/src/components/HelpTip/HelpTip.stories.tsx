import type { Meta, StoryObj } from '@storybook/react-vite';
import { HelpTip } from './index.js';

const meta = {
  title: 'Components/HelpTip',
  component: HelpTip,
  tags: ['autodocs']
} satisfies Meta<typeof HelpTip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RunCommandHelp: Story = {
  args: {
    ariaLabel: 'Run command help',
    children:
      'Optional absolute binary and arguments (for example /usr/bin/node ./server.js). {{name}} tokens resolve from global variables at Start and on crash restart. cwd is the root directory. No shell — use Proxy rules to forward to the app.'
  },
  render: (args) => (
    <p className="m-0 inline-flex items-center gap-1.5 text-[14px] text-muted">
      <span>Optional absolute binary and arguments.</span>
      <HelpTip {...args} />
    </p>
  )
};

export const ShortTip: Story = {
  args: {
    ariaLabel: 'Field help',
    children: 'This value is optional and can be left blank.'
  }
};
