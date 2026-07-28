import type { JSX } from 'react';
import type { PageComponentProps } from '#/renderer/src/routing/types';
import { WorkflowRunResults } from '#/renderer/src/ui/Tabs/WorkflowRunResults';

/**
 * Route wrapper for the workflow run results page tab.
 *
 * @param props - Page identity carrying the workflow uuid.
 * @returns Workflow run results content.
 */
export function WorkflowRunResultsPageRoute({
  page
}: PageComponentProps<'workflow-run-results'>): JSX.Element {
  return <WorkflowRunResults page={page} />;
}
