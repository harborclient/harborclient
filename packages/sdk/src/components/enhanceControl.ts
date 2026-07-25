import { cloneElement, isValidElement } from '@harborclient/sdk/react';
import type { ReactElement, ReactNode } from 'react';

const REACT_FRAGMENT_TYPE = Symbol.for('react.fragment');

const FORM_CONTROL_TAGS = new Set(['button', 'input', 'select', 'textarea']);

/**
 * Options for merging validation accessibility attributes onto a form control.
 */
export interface EnhanceControlOptions {
  /**
   * Space-separated ids merged into `aria-describedby` on the control.
   */
  describedBy?: string;

  /**
   * When true, sets `aria-invalid="true"` on the control.
   */
  invalid?: boolean;

  /**
   * Sets `id` on the leaf control when it does not already have one.
   */
  id?: string;
}

type AriaControlProps = {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  children?: ReactNode;
};

/**
 * Returns the sole child when `node` is a one-element array; otherwise `node`.
 *
 * @param node - React child node to normalize.
 * @returns The single child, or undefined when zero or multiple children exist.
 */
function getSingleChild(node: ReactNode): ReactNode | undefined {
  if (node == null || typeof node === 'boolean') return undefined;
  if (Array.isArray(node)) {
    const filtered = node.filter((n) => n != null && n !== false);
    return filtered.length === 1 ? filtered[0] : undefined;
  }
  return node;
}

/**
 * Clones a control element with merged accessibility attributes.
 *
 * @param child - Leaf form control element.
 * @param options - Accessibility attributes to apply.
 * @returns Cloned element with merged ARIA props.
 */
function applyAriaProps(
  child: ReactElement<AriaControlProps>,
  options: EnhanceControlOptions
): ReactNode {
  const { describedBy, invalid, id } = options;
  const props: AriaControlProps = {};

  if (id && child.props.id == null) {
    props.id = id;
  }

  if (describedBy) {
    const existing =
      typeof child.props['aria-describedby'] === 'string'
        ? child.props['aria-describedby']
        : undefined;
    props['aria-describedby'] = existing ? `${existing} ${describedBy}` : describedBy;
  }

  if (invalid) {
    props['aria-invalid'] = true;
  }

  if (Object.keys(props).length === 0) return child;
  return cloneElement(child, props);
}

/**
 * Merges accessibility attributes onto a form control, unwrapping single-child
 * fragments and DOM wrappers to reach the underlying input component.
 *
 * @param child - Form control element or wrapper to enhance.
 * @param options - `aria-describedby` ids, invalid state, and optional `id` to apply.
 * @returns The original node or a cloned tree with ARIA props on the leaf control.
 */
export function enhanceControl(child: ReactNode, options: EnhanceControlOptions): ReactNode {
  const { describedBy, invalid, id } = options;
  if (!describedBy && !invalid && !id) return child;

  const single = getSingleChild(child);
  if (single !== undefined && single !== child) {
    return enhanceControl(single, options);
  }

  if (!isValidElement<AriaControlProps>(child)) return child;

  if ((child.type as symbol | string) === REACT_FRAGMENT_TYPE) {
    const inner = getSingleChild(child.props.children);
    if (inner && isValidElement(inner)) {
      return cloneElement(child, {}, enhanceControl(inner, options));
    }
    return child;
  }

  if (typeof child.type === 'string') {
    if (FORM_CONTROL_TAGS.has(child.type)) {
      return applyAriaProps(child, options);
    }

    const inner = getSingleChild(child.props.children);
    if (inner && isValidElement(inner)) {
      const enhanced = enhanceControl(inner, options);
      if (enhanced !== inner) {
        return cloneElement(child, {}, enhanced);
      }
    }
    return child;
  }

  return applyAriaProps(child, options);
}
