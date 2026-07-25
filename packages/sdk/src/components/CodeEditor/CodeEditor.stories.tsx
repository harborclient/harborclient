import { useState } from '@harborclient/sdk/react';
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import type { Variable } from '../../types.js';
import { CodeEditorConfigProvider, DEFAULT_CODE_EDITOR_CONFIG } from './config.js';
import { CodeEditor } from './index.js';

const sampleVariables: Variable[] = [
  { key: 'baseUrl', value: 'https://api.example.com', defaultValue: '', share: false },
  { key: 'token', value: 'secret-token', defaultValue: '', share: false }
];

const withConfig: Decorator = (Story) => (
  <CodeEditorConfigProvider value={DEFAULT_CODE_EDITOR_CONFIG}>
    <Story />
  </CodeEditorConfigProvider>
);

const meta = {
  title: 'Components/CodeEditor',
  component: CodeEditor,
  tags: ['autodocs'],
  decorators: [withConfig],
  argTypes: {
    language: {
      control: 'select',
      options: ['text', 'json', 'javascript', 'shell']
    },
    readOnly: { control: 'boolean' },
    lint: { control: 'boolean' }
  },
  args: {
    value: ''
  }
} satisfies Meta<typeof CodeEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PlainText: Story = {
  args: {
    value: 'Hello, HarborClient.',
    language: 'text',
    placeholder: 'Enter text…',
    'aria-label': 'Plain text editor'
  },
  render: (args) => {
    const [value, setValue] = useState(args.value);
    return <CodeEditor {...args} value={value} onChange={setValue} />;
  }
};

export const Json: Story = {
  args: {
    value: '{\n  "name": "HarborClient"\n}',
    language: 'json',
    'aria-label': 'JSON editor'
  },
  render: (args) => {
    const [value, setValue] = useState(args.value);
    return <CodeEditor {...args} value={value} onChange={setValue} />;
  }
};

export const ReadOnly: Story = {
  args: {
    value: 'HTTP/1.1 200 OK\nContent-Type: application/json',
    readOnly: true,
    language: 'text',
    'aria-label': 'Response body'
  }
};

export const WithVariables: Story = {
  args: {
    value: 'GET {{baseUrl}}/users\nAuthorization: Bearer {{token}}',
    language: 'text',
    variables: sampleVariables,
    onEditVariable: fn(),
    'aria-label': 'Request script'
  },
  render: (args) => {
    const [value, setValue] = useState(args.value);
    return <CodeEditor {...args} value={value} onChange={setValue} />;
  }
};

const scriptPlaceholder = `hc.request.url = 'https://example.com';
hc.request.variables.set('token', 'abc');

/ask How do I set a request header?`;

export const HighlightedScriptPlaceholder: Story = {
  args: {
    value: '',
    language: 'javascript',
    placeholder: scriptPlaceholder,
    placeholderHighlight: true,
    slashCommands: [{ name: 'ask', description: 'Ask AI about this script' }],
    'aria-label': 'Script editor placeholder preview'
  },
  render: (args) => {
    const [value, setValue] = useState(args.value);
    return <CodeEditor {...args} value={value} onChange={setValue} />;
  }
};

export const JsonInvalid: Story = {
  args: {
    value: '{ "name": ',
    language: 'json',
    lint: true,
    'aria-label': 'Invalid JSON editor'
  },
  render: (args) => {
    const [value, setValue] = useState(args.value);
    return <CodeEditor {...args} value={value} onChange={setValue} />;
  }
};

export const JavascriptInvalid: Story = {
  args: {
    value: 'function foo( {',
    language: 'javascript',
    lint: true,
    'aria-label': 'Invalid JavaScript editor'
  },
  render: (args) => {
    const [value, setValue] = useState(args.value);
    return <CodeEditor {...args} value={value} onChange={setValue} />;
  }
};

export const LintDisabled: Story = {
  args: {
    value: '{ "name": ',
    language: 'json',
    lint: false,
    'aria-label': 'Invalid JSON editor with lint disabled'
  },
  render: (args) => {
    const [value, setValue] = useState(args.value);
    return <CodeEditor {...args} value={value} onChange={setValue} />;
  }
};
