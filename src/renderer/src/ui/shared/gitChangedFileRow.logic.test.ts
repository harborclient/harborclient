import { describe, expect, it } from 'vitest';
import { buildGitChangedFileRowPresentation } from '#/renderer/src/ui/shared/gitChangedFileRow.logic';

describe('buildGitChangedFileRowPresentation', () => {
  it('uses displayName and commit accessible labels for request rows', () => {
    const presentation = buildGitChangedFileRowPresentation(
      {
        path: '.harborclient/collection-api/req-health.json',
        status: 'modified',
        displayName: 'Health Check',
        resourceKind: 'request',
        method: 'GET'
      },
      false
    );

    expect(presentation.displayLabel).toBe('Health Check');
    expect(presentation.statusMarkerProps).toEqual({
      marker: 'M',
      className: 'text-git-uncommitted',
      label: 'Modified'
    });
    expect(presentation.rowAriaLabel).toBe('Health Check, request, modified in commit');
  });

  it('uses document resource kind in accessible labels', () => {
    const presentation = buildGitChangedFileRowPresentation(
      {
        path: '.harborclient/collection-api/doc-readme.md',
        status: 'added',
        displayName: 'README',
        resourceKind: 'document'
      },
      false
    );

    expect(presentation.statusMarkerProps).toEqual({
      marker: 'A',
      className: 'text-git-unstaged',
      label: 'Added'
    });
    expect(presentation.rowAriaLabel).toBe('README, document, added in commit');
  });

  it('falls back to path labels for plain file rows', () => {
    const presentation = buildGitChangedFileRowPresentation(
      {
        path: '.harborclient/collection-api/settings.json',
        status: 'deleted'
      },
      false
    );

    expect(presentation.displayLabel).toBe('.harborclient/collection-api/settings.json');
    expect(presentation.statusMarkerProps).toEqual({
      marker: 'D',
      className: 'text-muted line-through',
      label: 'Deleted'
    });
    expect(presentation.rowAriaLabel).toBe(
      '.harborclient/collection-api/settings.json, deleted in commit'
    );
  });

  it('uses conflict marker styling and accessible labels when hasConflict is true', () => {
    const presentation = buildGitChangedFileRowPresentation(
      {
        path: '.harborclient/collection-api/req-health.json',
        status: 'modified',
        displayName: 'Health Check',
        resourceKind: 'request',
        method: 'GET'
      },
      true
    );

    expect(presentation.statusMarkerProps).toEqual({
      marker: 'C',
      className: 'text-amber-700 dark:text-amber-300',
      label: 'Conflict'
    });
    expect(presentation.rowAriaLabel).toBe('Resolve merge conflict in Health Check');
  });
});
