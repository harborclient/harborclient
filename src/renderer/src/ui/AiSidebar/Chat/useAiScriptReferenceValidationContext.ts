import { useMemo } from 'react';
import type { AiScriptReferenceValidationContext } from '#/shared/ai/scriptReferences';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { isRequestTab } from '#/renderer/src/store/drafts';
import { selectActiveTab } from '#/renderer/src/store/selectors';

/**
 * Builds validation context from the active request tab for `@` script references.
 *
 * @param tab - Active editor tab, if any.
 */
function buildValidationContext(
  tab: ReturnType<typeof selectActiveTab>
): AiScriptReferenceValidationContext {
  if (!tab || !isRequestTab(tab)) {
    return {
      hasActiveRequestTab: false,
      preScriptCount: 0,
      postScriptCount: 0
    };
  }

  return {
    hasActiveRequestTab: true,
    activeRequestId: tab.draft.id,
    preScriptCount: tab.draft.pre_request_scripts.length,
    postScriptCount: tab.draft.post_request_scripts.length
  };
}

/**
 * Returns the active request tab state used to validate `@` script references in chat UI.
 */
export function useAiScriptReferenceValidationContext(): AiScriptReferenceValidationContext {
  const activeTab = useAppSelector(selectActiveTab);

  /**
   * Memoizes script counts and request id from the active tab for highlight validation.
   */
  return useMemo(() => buildValidationContext(activeTab), [activeTab]);
}
