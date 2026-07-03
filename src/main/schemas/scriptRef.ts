import { z } from 'zod';
import { MAX_IPC_SCRIPT_CHARS } from '#/main/ipc/ipcLimits';
import type { ScriptRef } from '#/shared/types/script';

/** Pre/post script source bounded for IPC and portable export. */
export const scriptSource = z.string().max(MAX_IPC_SCRIPT_CHARS);

/** Ordered script reference entry for request/collection script lists. */
export const scriptRef = z.discriminatedUnion('kind', [
  z.object({
    id: z.string().min(1),
    enabled: z.boolean(),
    kind: z.literal('inline'),
    name: z.string().optional(),
    code: scriptSource.optional(),
    expanded: z.boolean().optional()
  }),
  z.object({
    id: z.string().min(1),
    enabled: z.boolean(),
    kind: z.literal('snippet'),
    name: z.string().optional(),
    snippetUuid: z.string().min(1),
    expanded: z.boolean().optional()
  })
]);

/** Maximum script references in an ordered pre/post list. */
export const MAX_SCRIPT_REFS = 64;

/**
 * Removes UI-only {@link ScriptRef.expanded} before persisting portable export data.
 *
 * @param ref - Parsed script reference from an export file.
 * @returns Script reference without expanded state.
 */
function stripExpandedFromScriptRef(ref: ScriptRef): ScriptRef {
  if (ref.kind === 'inline') {
    const { code, enabled, id, kind, name } = ref;
    return {
      id,
      enabled,
      kind,
      ...(name ? { name } : {}),
      ...(code !== undefined ? { code } : {})
    };
  }
  const { enabled, id, kind, name, snippetUuid } = ref;
  return {
    id,
    enabled,
    kind,
    snippetUuid,
    ...(name ? { name } : {})
  };
}

/** Ordered script reference arrays bounded for IPC payloads. */
export const ipcScriptRefArray = z.array(scriptRef).max(MAX_SCRIPT_REFS);

/**
 * Optional script reference arrays for portable export/import files.
 *
 * Strips {@link ScriptRef.expanded} because it is editor UI state, not portable data.
 */
export const exportScriptRefArray = z
  .array(scriptRef)
  .max(MAX_SCRIPT_REFS)
  .optional()
  .transform((refs) => {
    if (!refs || refs.length === 0) {
      return undefined;
    }
    return refs.map(stripExpandedFromScriptRef);
  });
