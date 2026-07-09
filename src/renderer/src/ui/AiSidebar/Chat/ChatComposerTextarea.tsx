import { fieldFrame } from '@harborclient/sdk/components';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type JSX,
  type Ref
} from 'react';
import {
  COMPOSER_EMBEDDED_TEXT_MIN_HEIGHT_PX,
  COMPOSER_MAX_HEIGHT_PX,
  COMPOSER_MIN_HEIGHT_PX
} from '#/renderer/src/hooks/useAutoGrowTextarea';
import {
  chatComposerSubmitCompartment,
  createScriptReferenceBadgeExtensions,
  createSubmitKeymap
} from './scriptReferenceCodeMirrorExtensions';
import { useAiScriptReferenceValidationContext } from './useAiScriptReferenceValidationContext';

export interface ChatComposerTextareaHandle {
  /**
   * Moves keyboard focus into the composer editor.
   */
  focus: () => void;
}

interface Props {
  /**
   * Current composer draft text.
   */
  value: string;

  /**
   * Called when the draft changes.
   */
  onChange: (value: string) => void;

  /**
   * Called when the configured submit shortcut is pressed.
   */
  onSubmit: () => void;

  /**
   * Whether the submit shortcut should send the current draft.
   */
  canSubmit: boolean;

  /**
   * When true, plain Enter submits instead of inserting a newline.
   */
  enterToSend: boolean;

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
   * Additional classes applied to the editor root element.
   */
  className?: string;

  /**
   * Ref forwarded to the composer focus handle.
   */
  ref?: Ref<ChatComposerTextareaHandle>;

  /**
   * When true, omits the outer field border so a parent shell can wrap textarea and toolbar.
   */
  embedded?: boolean;
}

/**
 * Multiline chat prompt that renders valid `@` script references as inline name badges.
 */
export function ChatComposerTextarea({
  value,
  onChange,
  onSubmit,
  canSubmit,
  enterToSend,
  placeholder,
  disabled = false,
  'aria-label': ariaLabel,
  className = '',
  ref,
  embedded = false
}: Props): JSX.Element {
  const validationContext = useAiScriptReferenceValidationContext();
  const editorRef = useRef<ReactCodeMirrorRef | null>(null);
  const onSubmitRef = useRef(onSubmit);

  /**
   * Keeps the submit shortcut wired to the latest parent callback.
   */
  useEffect(() => {
    onSubmitRef.current = onSubmit;
  }, [onSubmit]);

  /**
   * Focuses the underlying CodeMirror contenteditable surface.
   */
  const focusEditor = useCallback((): void => {
    editorRef.current?.view?.focus();
  }, []);

  useImperativeHandle(ref, () => ({ focus: focusEditor }), [focusEditor]);

  /**
   * Builds CodeMirror extensions for script badges, submit shortcuts, and field chrome.
   */
  const extensions = useMemo(
    () => [
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({
        'aria-label': ariaLabel ?? 'Chat message',
        'aria-disabled': String(disabled),
        role: 'textbox',
        'aria-multiline': 'true'
      }),
      EditorView.theme({
        '&': {
          backgroundColor: 'transparent'
        },
        '.cm-scroller': {
          overflow: 'auto'
        },
        '.cm-content': {
          padding: '6px 10px',
          fontFamily: 'inherit'
        },
        '.cm-line': {
          padding: 0
        },
        '.cm-placeholder': {
          color: 'var(--mac-muted)'
        },
        '&.cm-focused': {
          outline: 'none'
        }
      }),
      ...createScriptReferenceBadgeExtensions(validationContext),
      chatComposerSubmitCompartment.of([])
    ],
    [ariaLabel, disabled, validationContext]
  );

  /**
   * Reconfigures submit shortcuts when send eligibility or Enter behavior changes.
   */
  useEffect(() => {
    const view = editorRef.current?.view;
    if (view == null) {
      return;
    }

    view.dispatch({
      effects: chatComposerSubmitCompartment.reconfigure(
        createSubmitKeymap({
          enterToSend,
          canSubmit,
          onSubmit: () => {
            onSubmitRef.current();
          }
        })
      )
    });
  }, [canSubmit, enterToSend]);

  const minHeightPx = embedded ? COMPOSER_EMBEDDED_TEXT_MIN_HEIGHT_PX : COMPOSER_MIN_HEIGHT_PX;

  return (
    <div
      className={`hc-chat-composer-textarea hc-chat-composer-codemirror relative w-full ${embedded ? '' : fieldFrame}`}
    >
      <CodeMirror
        ref={editorRef}
        value={value}
        placeholder={placeholder}
        theme="none"
        editable={!disabled}
        readOnly={disabled}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
          highlightSelectionMatches: false,
          autocompletion: false,
          bracketMatching: false,
          closeBrackets: false,
          searchKeymap: false,
          indentOnInput: false,
          syntaxHighlighting: false,
          defaultKeymap: true,
          historyKeymap: true
        }}
        minHeight={`${minHeightPx}px`}
        maxHeight={`${COMPOSER_MAX_HEIGHT_PX}px`}
        className={`relative w-full text-[16px] text-text ${className}`.trim()}
        extensions={extensions}
        onCreateEditor={(view) => {
          view.dispatch({
            effects: chatComposerSubmitCompartment.reconfigure(
              createSubmitKeymap({
                enterToSend,
                canSubmit,
                onSubmit: () => {
                  onSubmitRef.current();
                }
              })
            )
          });
        }}
        onChange={(nextValue) => {
          onChange(nextValue);
        }}
      />
    </div>
  );
}
