// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActiveTurnPresentation } from './ActiveTurnPresentation';

vi.mock('@harborclient/sdk/components', () => ({
  FaIcon: () => null
}));

vi.mock('./MarkdownContent', () => ({
  MarkdownContent: ({ content }: { content: string }) => createElement('div', null, content)
}));

describe('ActiveTurnPresentation', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders incremental assistant markdown', async () => {
    await act(async () => {
      root.render(
        createElement(ActiveTurnPresentation, {
          text: 'Hello world',
          thought: '',
          toolRows: [],
          phase: 'streaming'
        })
      );
    });

    expect(container.textContent).toContain('Hello world');
    expect(container.querySelectorAll('[role="status"]').length).toBe(0);
  });

  it('shows generating status before assistant text arrives', async () => {
    await act(async () => {
      root.render(
        createElement(ActiveTurnPresentation, {
          text: '',
          thought: '',
          toolRows: [],
          phase: 'streaming'
        })
      );
    });

    expect(container.textContent).toContain('Generating…');
  });

  it('omits thinking during awaiting_user even when thought text exists', async () => {
    await act(async () => {
      root.render(
        createElement(ActiveTurnPresentation, {
          text: 'Partial',
          thought: 'hidden reasoning',
          toolRows: [],
          phase: 'awaiting_user',
          pendingQuestion: {
            toolCallId: 'call-1',
            question: 'Pick one',
            choices: ['A', 'B']
          }
        })
      );
    });

    expect(container.textContent).not.toContain('Thinking');
    expect(container.textContent).toContain('Waiting for your answer');
    expect(container.textContent).toContain('Pick one');
    expect(container.textContent).toContain('A');
  });

  it('lists tool rows with accessible progress labels', async () => {
    await act(async () => {
      root.render(
        createElement(ActiveTurnPresentation, {
          text: '',
          thought: '',
          phase: 'executing_tools',
          toolRows: [
            {
              callId: 'call-1',
              name: 'search',
              owner: 'harbor',
              status: 'running'
            }
          ]
        })
      );
    });

    expect(container.textContent).toContain('search');
    expect(container.textContent).toContain('Desktop');
    expect(container.textContent).toContain('Running');
  });
});
