import { z } from 'zod';
/**
 * Zod schema for validating tab group export files.
 */
export const tabGroupExportSchema = z.object({
    harborclientVersion: z.literal(1),
    harborclientExport: z.literal('tab_group'),
    name: z.string().trim().min(1),
    requestUuids: z.array(z.string().trim().min(1)),
    color: z.union([z.string().trim().min(1), z.null()]).optional()
});
/**
 * Validates a parsed tab group export payload.
 *
 * @param data - Parsed JSON from an export file.
 * @returns Validated export envelope.
 * @throws When the payload does not match the tab group export schema.
 */
export function validateTabGroupExport(data) {
    const result = tabGroupExportSchema.safeParse(data);
    if (!result.success) {
        throw new Error(`Invalid tab group export: ${result.error.message}`);
    }
    return result.data;
}
//# sourceMappingURL=tabGroup.js.map