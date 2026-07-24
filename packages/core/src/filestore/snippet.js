import { normalizeScriptStage } from '../scriptStage';
import { normalizeSnippetScope } from '../snippetScope';
/**
 * Validates and normalizes a snippet export payload read from disk.
 *
 * @param data - Parsed JSON from a snippet export file.
 * @returns Normalized snippet export data.
 * @throws When required fields are missing or invalid.
 */
export function validateSnippetExport(data) {
    if (typeof data !== 'object' || data == null) {
        throw new Error('Invalid snippet export: expected an object.');
    }
    const record = data;
    if (record.harborclientExport !== 'snippet') {
        throw new Error('Invalid snippet export: missing harborclientExport discriminator.');
    }
    const uuid = typeof record.uuid === 'string' ? record.uuid.trim() : '';
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    if (!uuid) {
        throw new Error('Invalid snippet export: uuid is required.');
    }
    if (!name) {
        throw new Error('Invalid snippet export: name is required.');
    }
    const scope = normalizeSnippetScope(record.scope);
    const stage = normalizeScriptStage(record.stage ?? record.role);
    const code = typeof record.code === 'string' ? record.code : '';
    const createdAt = typeof record.created_at === 'string' ? record.created_at : undefined;
    const updatedAt = typeof record.updated_at === 'string' ? record.updated_at : undefined;
    return {
        harborclientVersion: 1,
        harborclientExport: 'snippet',
        uuid,
        name,
        code,
        scope,
        stage,
        ...(createdAt ? { created_at: createdAt } : {}),
        ...(updatedAt ? { updated_at: updatedAt } : {})
    };
}
//# sourceMappingURL=snippet.js.map