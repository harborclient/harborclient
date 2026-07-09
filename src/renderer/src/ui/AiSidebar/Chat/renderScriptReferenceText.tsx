import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import {
  resolveAiScriptReferenceName,
  tokenizeChatComposerText,
  type AiScriptReferenceValidationContext
} from '#/shared/ai/scriptReferences';
import { ScriptReferenceBadge } from './ScriptReferenceBadge';

/**
 * Renders plain text with valid `@` script references shown as name badges.
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

  return tokens.map((token, index) => {
    if (!token.highlight || token.reference == null) {
      return token.text;
    }

    const label = resolveAiScriptReferenceName(token.reference, context);
    if (label == null) {
      return token.text;
    }

    return <ScriptReferenceBadge key={index} label={label} />;
  });
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
