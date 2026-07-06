import { Textarea, fieldFrame } from '@harborclient/sdk/components';
import {
  useCallback,
  useMemo,
  useRef,
  type ChangeEvent,
  type JSX,
  type KeyboardEvent,
  type Ref
} from 'react';
import { useAutoGrowTextarea } from '#/renderer/src/hooks/useAutoGrowTextarea';
import { tokenizeChatComposerText } from '#/shared/ai/scriptReferences';
import { useAiScriptReferenceValidationContext } from './useAiScriptReferenceValidationContext';

interface Props {
  /**
   * Current composer draft text.
   */
  value: string;

  /**
   * Called when the draft changes.
   */
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;

  /**
   * Optional keyboard handler (for example Enter to send).
   */
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;

  /**
   * Placeholder shown when the draft is empty.
   */
  placeholder?: string;

  /**
   * Whether typing is disabled.
   */
  disabled?: boolean;

  /**
   * Accessible name for the prompt field.
   */
  'aria-label'?: string;

  /**
   * Additional classes applied to the textarea element.
   */
  className?: string;

  /**
   * Ref forwarded to the underlying native textarea.
   */
  ref?: Ref<HTMLTextAreaElement>;
}

/**
 * Multiline chat prompt that highlights valid `@` script references in the variable token color.
 */
export function ChatComposerTextarea({
  value,
  onChange,
  onKeyDown,
  placeholder,
  disabled,
  'aria-label': ariaLabel,
  className = '',
  ref
}: Props): JSX.Element {
  const validationContext = useAiScriptReferenceValidationContext();
  const backdropRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Forwards the native textarea ref to parent callers and the local scroll-sync ref.
   *
   * @param node - Mounted textarea element, or null on unmount.
   */
  const setTextareaRef = useCallback(
    (node: HTMLTextAreaElement | null): void => {
      textareaRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref != null) {
        ref.current = node;
      }
    },
    [ref]
  );

  /**
   * Splits the draft into plain text and highlightable `@` script reference spans.
   */
  const tokens = useMemo(
    () => tokenizeChatComposerText(value, validationContext),
    [value, validationContext]
  );

  useAutoGrowTextarea(textareaRef, value);

  /**
   * Keeps the colored backdrop aligned with textarea scrolling.
   */
  const syncScroll = (): void => {
    const textarea = textareaRef.current;
    const backdrop = backdropRef.current;
    if (textarea && backdrop) {
      backdrop.scrollTop = textarea.scrollTop;
      backdrop.scrollLeft = textarea.scrollLeft;
    }
  };

  return (
    <div className={`hc-chat-composer-textarea relative w-full ${fieldFrame}`}>
      <div
        ref={backdropRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words px-2.5 py-1.5 text-[16px] text-text"
      >
        {value ? (
          tokens.map((token, index) =>
            token.highlight ? (
              <span
                key={index}
                className="hc-chat-composer-script-ref hc-variable-input-token-variable text-[#32D2E2]"
              >
                {token.text}
              </span>
            ) : (
              <span key={index}>{token.text}</span>
            )
          )
        ) : (
          <span className="text-muted">{placeholder}</span>
        )}
      </div>
      <Textarea
        ref={setTextareaRef}
        variant="plain"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        disabled={disabled}
        className={`relative w-full resize-none border-none bg-transparent px-2.5 py-1.5 text-[16px] text-transparent caret-text focus-visible:shadow-none ${className}`}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onScroll={syncScroll}
      />
    </div>
  );
}
