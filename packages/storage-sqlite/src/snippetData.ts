import { normalizeSnippetScope, type SnippetScope } from '#/shared/snippetScope';
import { normalizeScriptStage } from '#/shared/scriptStage';
import type { ScriptStage } from '@harborclient/sdk';
import type { SnippetExport } from '#/shared/types/snippet';

/**
 * Validates and normalizes a snippet export payload read from disk.
 *
 * @param data - Parsed JSON from a snippet export file.
 * @returns Normalized snippet export data.
 * @throws When required fields are missing or invalid.
 */
export function validateSnippetExport(data: unknown): SnippetExport {
  if (typeof data !== 'object' || data == null) {
    throw new Error('Invalid snippet export: expected an object.');
  }

  const record = data as Record<string, unknown>;
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

/**
 * Maps a snippet export row to provider snippet fields for git storage.
 *
 * @param exportData - Validated snippet export payload.
 */
export function snippetExportToFields(exportData: SnippetExport): {
  uuid: string;
  name: string;
  code: string;
  scope: SnippetScope;
  stage: ScriptStage;
  created_at: string;
  updated_at: string;
} {
  const now = new Date().toISOString();
  return {
    uuid: exportData.uuid,
    name: exportData.name,
    code: exportData.code,
    scope: exportData.scope,
    stage: exportData.stage,
    created_at: exportData.created_at ?? now,
    updated_at: exportData.updated_at ?? now
  };
}
