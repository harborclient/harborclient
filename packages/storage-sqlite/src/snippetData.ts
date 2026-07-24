import { validateSnippetExport } from '@harborclient/core/filestore/snippet';
import type { SnippetScope } from '@harborclient/core/snippetScope';
import type { ScriptStage } from '@harborclient/sdk';
import type { SnippetExport } from '@harborclient/core/types/snippet';

export { validateSnippetExport };

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
