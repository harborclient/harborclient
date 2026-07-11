/**
 * Returns chat ids that have at least one persisted message.
 *
 * Empty or newly created chats are treated as unsaved and excluded so
 * "Close saved" keeps them open.
 *
 * @param orderedIds - Open chat ids in display order.
 * @param messagesByChat - Message lists keyed by chat id.
 * @returns Chat ids with one or more messages.
 */
export function chatIdsWithMessages(
  orderedIds: readonly number[],
  messagesByChat: Readonly<Record<number, readonly unknown[]>>
): number[] {
  return orderedIds.filter((id) => (messagesByChat[id] ?? []).length > 0);
}
