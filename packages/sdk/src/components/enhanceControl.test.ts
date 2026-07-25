import { Fragment, createElement, isValidElement } from 'react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { enhanceControl } from './enhanceControl.js';

type ControlProps = {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
};

/** Stand-in for {@link Input} — function component that forwards props to a native input. */
function TextInput(props: ControlProps): ReactElement {
  return createElement('input', { type: 'text', ...props });
}

function propsOf(node: unknown): Record<string, unknown> {
  if (!isValidElement(node)) {
    throw new Error('Expected a valid React element');
  }
  return node.props as Record<string, unknown>;
}

describe('enhanceControl', () => {
  it('merges aria-describedby and aria-invalid on a form component', () => {
    const result = enhanceControl(createElement(TextInput), {
      describedBy: 'field-error',
      invalid: true
    });

    expect(propsOf(result)['aria-describedby']).toBe('field-error');
    expect(propsOf(result)['aria-invalid']).toBe(true);
  });

  it('includes description id in aria-describedby without setting aria-invalid', () => {
    const result = enhanceControl(createElement(TextInput), {
      describedBy: 'api-key-description'
    });

    expect(propsOf(result)['aria-describedby']).toBe('api-key-description');
    expect(propsOf(result)['aria-invalid']).toBeUndefined();
  });

  it('merges description and error ids in aria-describedby', () => {
    const result = enhanceControl(createElement(TextInput), {
      describedBy: 'api-key-description api-key-error',
      invalid: true
    });

    expect(propsOf(result)['aria-describedby']).toBe('api-key-description api-key-error');
    expect(propsOf(result)['aria-invalid']).toBe(true);
  });

  it('merges with an existing aria-describedby value', () => {
    const result = enhanceControl(createElement(TextInput, { 'aria-describedby': 'existing' }), {
      describedBy: 'field-error'
    });

    expect(propsOf(result)['aria-describedby']).toBe('existing field-error');
  });

  it('enhances a control wrapped in a div', () => {
    const wrapped = createElement('div', null, createElement(TextInput));
    const result = enhanceControl(wrapped, { describedBy: 'field-error' });
    const inner = propsOf(result).children as ReactElement;

    expect(propsOf(inner)['aria-describedby']).toBe('field-error');
  });

  it('enhances a native input wrapped in a div', () => {
    const wrapped = createElement('div', null, createElement('input', { type: 'text' }));
    const result = enhanceControl(wrapped, { describedBy: 'field-error' });
    const inner = propsOf(result).children as ReactElement;

    expect(propsOf(inner)['aria-describedby']).toBe('field-error');
  });

  it('unwraps a single-element array', () => {
    const result = enhanceControl([createElement(TextInput)], { describedBy: 'field-error' });

    expect(propsOf(result)['aria-describedby']).toBe('field-error');
  });

  it('enhances a control wrapped in a fragment', () => {
    const wrapped = createElement(Fragment, null, createElement(TextInput));
    const result = enhanceControl(wrapped, { describedBy: 'field-error' });
    const inner = propsOf(result).children as ReactElement;

    expect(propsOf(inner)['aria-describedby']).toBe('field-error');
  });

  it('leaves multiple siblings unchanged', () => {
    const child = [createElement(TextInput), createElement('span')];
    const result = enhanceControl(child, { describedBy: 'field-error' });

    expect(result).toBe(child);
  });

  it('sets id when the control has none', () => {
    const result = enhanceControl(createElement('input', { type: 'checkbox' }), {
      id: 'auto-id'
    });

    expect(propsOf(result).id).toBe('auto-id');
  });

  it('preserves an existing id', () => {
    const result = enhanceControl(createElement('input', { id: 'existing-id', type: 'checkbox' }), {
      id: 'auto-id'
    });

    expect(propsOf(result).id).toBe('existing-id');
  });
});
