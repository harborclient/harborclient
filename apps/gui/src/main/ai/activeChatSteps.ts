/**
 * In-flight LLM chat completion steps keyed by client step request id for cancellation.
 * Entries exist only while a tracked `chats:completeStep` is running; late `chats:cancelStep`
 * calls are intentional no-ops. Untrack uses reference equality so a slow cleanup cannot
 * remove a newer step that reused the same id.
 */
const activeChatSteps = new Map<string, AbortController>();

/**
 * Registers an AbortController so `chats:cancelStep` can abort the matching step.
 *
 * @param stepRequestId - Client-generated id passed to `chats:completeStep`.
 * @param controller - Controller whose signal is wired into the LLM request.
 */
export function trackActiveChatStep(stepRequestId: string, controller: AbortController): void {
  activeChatSteps.set(stepRequestId, controller);
}

/**
 * Removes a tracked chat step when `chats:completeStep` finishes, but only if this
 * handler still owns the map entry.
 *
 * @param stepRequestId - Client-generated id passed to `chats:completeStep`.
 * @param controller - Controller created for that step invocation.
 */
export function untrackActiveChatStep(stepRequestId: string, controller: AbortController): void {
  if (activeChatSteps.get(stepRequestId) === controller) {
    activeChatSteps.delete(stepRequestId);
  }
}

/**
 * Aborts an in-flight chat completion step and removes it from the active map.
 * No-op when the id is unknown or the step already finished.
 *
 * @param stepRequestId - Client-generated id passed to `chats:completeStep`.
 */
export function cancelActiveChatStep(stepRequestId: string): void {
  const controller = activeChatSteps.get(stepRequestId);
  if (!controller) {
    return;
  }
  activeChatSteps.delete(stepRequestId);
  controller.abort();
}
