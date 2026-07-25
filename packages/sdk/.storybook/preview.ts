import { installReact } from '@harborclient/sdk';
import type { Preview } from '@storybook/react-vite';
import React from 'react';
import ReactDOM from 'react-dom';
import { setHostReactDom } from '../src/runtime/reactHost.js';
import './tailwind.css';

installReact(React);
setHostReactDom(ReactDOM);

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#1e1e1e' },
        { name: 'surface', value: '#2a2a2a' }
      ]
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    }
  },
  decorators: [
    (Story) =>
      React.createElement(
        'div',
        {
          className: 'min-h-[120px] bg-surface p-6 text-text'
        },
        React.createElement(Story)
      )
  ]
};

export default preview;
