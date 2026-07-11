import type { CodeEditorLanguage } from '@harborclient/sdk/components';
import { isValidElement, type ReactElement, type ReactNode } from 'react';

interface CodeElementProps {
  /**
   * Language class from react-markdown fenced code blocks.
   */
  className?: string | string[];

  /**
   * Raw code text rendered inside the element.
   */
  children?: ReactNode;
}

/**
 * Minimal hast text node shape passed through react-markdown.
 */
interface HastTextNode {
  type: 'text';
  value: string;
}

/**
 * Minimal hast element node shape for fenced code extraction.
 */
interface HastElementNode {
  type: 'element';
  tagName?: string;
  properties?: {
    className?: string | string[];
  };
  children?: HastNode[];
}

/**
 * Minimal hast node union used by react-markdown component overrides.
 */
type HastNode = HastTextNode | HastElementNode | { type: string };

/**
 * react-markdown `pre` node passed to custom component overrides.
 */
export interface PreElementNode {
  type: 'element';
  tagName?: string;
  properties?: {
    className?: string | string[];
  };
  children?: HastNode[];
}

const JAVASCRIPT_FENCE_LANGUAGES = new Set([
  'js',
  'jsx',
  'javascript',
  'mjs',
  'cjs',
  'ts',
  'tsx',
  'typescript'
]);

const SHELL_FENCE_LANGUAGES = new Set(['sh', 'bash', 'shell', 'zsh', 'console']);

/**
 * Normalizes a hast or React className into a single string.
 *
 * @param className - Class list from react-markdown or a rendered element.
 * @returns Space-delimited class string.
 */
function normalizeClassName(className?: string | string[]): string {
  if (Array.isArray(className)) {
    return className.join(' ');
  }

  return className ?? '';
}

/**
 * Parses a markdown fence language tag from a class string.
 *
 * @param className - Class list that may include `language-*`.
 * @returns Fence language identifier when present.
 */
function parseFenceLanguage(className?: string | string[]): string | undefined {
  const match = /language-(\w+)/.exec(normalizeClassName(className));
  return match?.[1];
}

/**
 * Recursively flattens React children into plain source text.
 *
 * @param node - React child node from a rendered markdown element.
 * @returns Joined text content.
 */
export function flattenReactNodeToString(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') {
    return '';
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map((child) => flattenReactNodeToString(child)).join('');
  }

  if (isValidElement(node)) {
    return flattenReactNodeToString((node as ReactElement<CodeElementProps>).props.children);
  }

  return '';
}

/**
 * Reads fenced code text and language from a react-markdown `pre` hast node.
 *
 * @param node - `pre` element node supplied by react-markdown.
 * @returns Extracted source text and optional fence language.
 */
export function extractCodeBlockFromPreNode(node: PreElementNode | undefined): {
  text: string;
  language?: string;
} {
  const codeEl = node?.children?.find(
    (child): child is HastElementNode =>
      child.type === 'element' && 'tagName' in child && child.tagName === 'code'
  );

  if (codeEl == null) {
    return { text: '', language: undefined };
  }

  const text = (codeEl.children ?? [])
    .filter((child): child is HastTextNode => child.type === 'text' && 'value' in child)
    .map((child) => child.value)
    .join('');

  return {
    text,
    language: parseFenceLanguage(codeEl.properties?.className)
  };
}

/**
 * Pulls raw source text and an optional fence language from react-markdown output.
 *
 * @param children - Rendered `<code>` child produced by the markdown `code` override.
 * @param node - Optional `pre` hast node from react-markdown.
 * @returns Extracted text and language tag when present.
 */
export function extractCodeBlockContent(
  children: ReactNode,
  node?: PreElementNode
): {
  text: string;
  language?: string;
} {
  const fromNode = extractCodeBlockFromPreNode(node);
  if (fromNode.text.length > 0) {
    return fromNode;
  }

  if (isValidElement<CodeElementProps>(children)) {
    const element = children as ReactElement<CodeElementProps>;
    const text = flattenReactNodeToString(element.props.children);

    return {
      text,
      language: parseFenceLanguage(element.props.className)
    };
  }

  return { text: '', language: undefined };
}

/**
 * Maps a markdown fence language tag to a supported CodeEditor syntax mode.
 *
 * @param language - Language identifier from a fenced code block, if any.
 * @returns CodeEditor language mode for syntax highlighting.
 */
export function mapFenceLanguageToCodeEditorLanguage(language?: string): CodeEditorLanguage {
  if (language == null) {
    return 'text';
  }

  const normalized = language.toLowerCase();

  if (normalized === 'json') {
    return 'json';
  }

  if (JAVASCRIPT_FENCE_LANGUAGES.has(normalized)) {
    return 'javascript';
  }

  if (SHELL_FENCE_LANGUAGES.has(normalized)) {
    return 'shell';
  }

  return 'text';
}
