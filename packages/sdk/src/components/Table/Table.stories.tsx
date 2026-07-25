import type { Meta, StoryObj } from '@storybook/react-vite';
import { Checkbox, Input } from '../forms/index.js';
import { Table, TableBody, TableCell, TableHead, TableHeader } from './index.js';

const meta = {
  title: 'Components/Table',
  component: Table,
  tags: ['autodocs'],
  args: {
    children: null
  }
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StaticRows: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <tr>
          <TableHead>Name</TableHead>
          <TableHead>Value</TableHead>
        </tr>
      </TableHeader>
      <TableBody>
        <tr>
          <TableCell>Authorization</TableCell>
          <TableCell>Bearer token</TableCell>
        </tr>
        <tr>
          <TableCell>Accept</TableCell>
          <TableCell>application/json</TableCell>
        </tr>
        <tr>
          <TableCell>Content-Type</TableCell>
          <TableCell>application/json</TableCell>
        </tr>
      </TableBody>
    </Table>
  )
};

export const WithInputs: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <tr>
          <TableHead className="w-6 p-0">
            <span className="sr-only">Enable</span>
          </TableHead>
          <TableHead>Key</TableHead>
          <TableHead>Value</TableHead>
        </tr>
      </TableHeader>
      <TableBody>
        <tr>
          <TableCell className="w-6 p-1 text-center">
            <Checkbox defaultChecked aria-label="Enable row 1" title="Enable" />
          </TableCell>
          <TableCell>
            <Input
              type="text"
              className="w-full"
              defaultValue="Authorization"
              aria-label="Key, row 1"
            />
          </TableCell>
          <TableCell>
            <Input
              type="text"
              className="w-full"
              defaultValue="Bearer {{token}}"
              aria-label="Value, row 1"
            />
          </TableCell>
        </tr>
        <tr>
          <TableCell className="w-6 p-1 text-center">
            <Checkbox defaultChecked aria-label="Enable row 2" title="Enable" />
          </TableCell>
          <TableCell>
            <Input type="text" className="w-full" defaultValue="Accept" aria-label="Key, row 2" />
          </TableCell>
          <TableCell>
            <Input
              type="text"
              className="w-full"
              defaultValue="application/json"
              aria-label="Value, row 2"
            />
          </TableCell>
        </tr>
      </TableBody>
    </Table>
  )
};

export const SingleRow: Story = {
  render: () => (
    <Table className="max-w-md">
      <TableHeader>
        <tr>
          <TableHead>Key</TableHead>
          <TableHead>Value</TableHead>
        </tr>
      </TableHeader>
      <TableBody>
        <tr>
          <TableCell>
            <Input type="text" className="w-full" placeholder="Key" aria-label="Key" />
          </TableCell>
          <TableCell>
            <Input type="text" className="w-full" placeholder="Value" aria-label="Value" />
          </TableCell>
        </tr>
      </TableBody>
    </Table>
  )
};
