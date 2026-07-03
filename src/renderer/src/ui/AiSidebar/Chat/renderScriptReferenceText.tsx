import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import {
  tokenizeChatComposerText,
  type AiScriptReferenceValidationContext
} from '#/shared/aiScriptReferences';

/** CSS class for valid `@` script reference tokens in chat prose. */
const SCRIPT_REFERENCE_CLASS = 'hc-chat-composer-script-ref';

/**
 * Renders plain text with valid `@` script references highlighted in the variable token color.
 *
 * @param text - Markdown text node content.
 * @param context - Active tab state for semantic validation.
 */
export function renderScriptReferenceText(
  text: string,
  context: AiScriptReferenceValidationContext
): ReactNode {
  if (text.length === 0) {
    return text;
  }

  const tokens = tokenizeChatComposerText(text, context);
  if (tokens.length === 0) {
    return text;
  }

  return tokens.map((token, index) =>
    token.highlight ? (
      <span key={index} className={SCRIPT_REFERENCE_CLASS}>
        {token.text}
      </span>
    ) : (
      token.text
    )
  );
}

/**
 * Recursively applies `@` script reference highlighting to react-markdown child nodes.
 *
 * @param children - Rendered markdown children for a prose element.
 * @param context - Active tab state for semantic validation.
 */
export function processMarkdownChildren(
  children: ReactNode,
  context: AiScriptReferenceValidationContext
): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === 'string') {
      return renderScriptReferenceText(child, context);
    }

    if (typeof child === 'number' || typeof child === 'boolean' || child == null) {
      return child;
    }

    if (Array.isArray(child)) {
      return processMarkdownChildren(child, context);
    }

    if (isValidElement(child)) {
      const element = child as ReactElement<{ children?: ReactNode }>;
      if (element.props.children == null) {
        return element;
      }

      return cloneElement(
        element,
        undefined,
        processMarkdownChildren(element.props.children, context)
      );
    }

    return child;
  });
}
