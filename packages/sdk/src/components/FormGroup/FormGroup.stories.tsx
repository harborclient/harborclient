import type { Meta, StoryObj } from '@storybook/react-vite';
import { Checkbox as CheckboxControl } from '../forms/Checkbox.js';
import { Input } from '../forms/Input.js';
import { Radio as RadioControl } from '../forms/Radio.js';
import { FormGroup } from './index.js';

const meta = {
  title: 'Components/FormGroup',
  component: FormGroup,
  tags: ['autodocs'],
  argTypes: {
    layout: {
      control: 'select',
      options: ['stacked', 'checkbox', 'inline', 'radio', 'checkboxAdjacent', 'associated']
    },
    labelTone: {
      control: 'select',
      options: ['default', 'muted']
    }
  }
} satisfies Meta<typeof FormGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Stacked: Story = {
  args: {
    label: 'API key',
    htmlFor: 'api-key',
    description: 'Used to authenticate requests from this plugin.',
    children: <Input id="api-key" placeholder="sk-…" />
  }
};

export const WithError: Story = {
  args: {
    label: 'Endpoint URL',
    htmlFor: 'endpoint-url',
    error: 'Enter a valid HTTPS URL.',
    children: <Input id="endpoint-url" defaultValue="not-a-url" />
  }
};

export const Checkbox: Story = {
  args: {
    label: 'Enable debug logging',
    layout: 'checkbox',
    children: <CheckboxControl />
  },
  parameters: {
    docs: {
      description: {
        story: 'Label association is automatic — no `htmlFor` or `id` required on the control.'
      }
    }
  }
};

export const CheckboxWithDescription: Story = {
  args: {
    label: 'SSL certificate verification',
    htmlFor: 'verify-ssl',
    description: 'When enabled, HTTPS requests reject invalid or untrusted TLS certificates.',
    layout: 'checkbox',
    children: <CheckboxControl id="verify-ssl" />
  },
  parameters: {
    docs: {
      description: {
        story: 'Checkbox rows with helper text keep the description inside the bordered form group.'
      }
    }
  }
};

export const Radio: Story = {
  args: {
    label: 'Content type'
  },
  render: () => (
    <fieldset className="flex flex-col gap-2 border-none p-0">
      <legend className="mb-2 text-[14px] font-medium text-text">Content type</legend>
      <FormGroup label="JSON" layout="radio">
        <RadioControl name="content-type" value="json" defaultChecked />
      </FormGroup>
      <FormGroup label="Plain text" layout="radio">
        <RadioControl name="content-type" value="text" />
      </FormGroup>
      <FormGroup label="Form data" layout="radio">
        <RadioControl name="content-type" value="form" />
      </FormGroup>
    </fieldset>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Label association is automatic — no `htmlFor` or `id` required on the control.'
      }
    }
  }
};
