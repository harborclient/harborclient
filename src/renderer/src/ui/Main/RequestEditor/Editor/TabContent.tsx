import { KeyValueEditor, SegmentedTabPanel, Textarea } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import type { KeyValue, Variable } from '#/shared/types';
import { mirrorLegacyScriptString } from '#/shared/scriptRefs';
import type { RegisteredRequestTab, RequestTabContext } from '#/shared/plugin/types';
import { PluginSurface } from '#/renderer/src/plugins/PluginSurface';
import { ScriptListEditor } from '#/renderer/src/ui/shared/ScriptListEditor';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectSnippets } from '#/renderer/src/store/selectors';

import type { RequestDraft } from '#/renderer/src/store/drafts';

import { AuthEditor } from './AuthEditor';
import { BodyEditor } from './BodyEditor';
import { CookiesEditor } from './CookiesEditor';
import {
  headerKeySource,
  headerValueSource,
  paramKeySource,
  paramValueSource
} from '#/renderer/src/autocomplete/sources';

interface Props {
  /**
   * Current request being edited.
   */
  draft: RequestDraft;

  /**
   * Whether the body tab is available for the current method.
   */
  showBody: boolean;

  /**
   * Merges a partial update into the current draft.
   */
  update: (patch: Partial<RequestDraft>) => void;

  /**
   * Updates params and mirrors them into the URL query string.
   *
   * @param params - Updated params table rows.
   */
  onParamsChange: (params: KeyValue[]) => void;

  /**
   * Collection-scoped variables for highlighting and tooltips.
   */
  variables: Variable[];

  /**
   * Opens collection settings to edit variables.
   */
  onEditVariables?: () => void;

  /**
   * Registered plugin request editor tabs.
   */
  pluginTabs: RegisteredRequestTab[];

  /**
   * Read-only context passed to plugin tab components.
   */
  requestTabContext: RequestTabContext;
}

/**
 * Tab panel content for params, headers, body, and scripts.
 */
export function TabContent({
  draft,
  showBody,
  update,
  onParamsChange,
  variables,
  onEditVariables,
  pluginTabs,
  requestTabContext
}: Props): JSX.Element {
  const snippets = useAppSelector(selectSnippets);

  return (
    <div className="flex min-h-0 flex-1 flex-col pt-4">
      <SegmentedTabPanel value="params">
        <KeyValueEditor
          rows={draft.params}
          onChange={onParamsChange}
          placeholderKey="param"
          placeholderValue="value"
          variables={variables}
          onEditVariable={onEditVariables}
          keySource={paramKeySource}
          valueSource={paramValueSource}
        />
      </SegmentedTabPanel>
      <SegmentedTabPanel value="headers">
        <KeyValueEditor
          rows={draft.headers}
          onChange={(headers) => update({ headers })}
          placeholderKey="header"
          placeholderValue="value"
          variables={variables}
          onEditVariable={onEditVariables}
          keySource={headerKeySource}
          valueSource={headerValueSource}
        />
      </SegmentedTabPanel>
      <SegmentedTabPanel value="auth">
        <AuthEditor
          auth={draft.auth}
          onChange={(auth) => update({ auth })}
          variables={variables}
          onEditVariables={onEditVariables}
          oauthCacheKey={draft.id != null ? `request:${draft.id}` : undefined}
        />
      </SegmentedTabPanel>
      <SegmentedTabPanel value="cookies">
        <CookiesEditor url={draft.url} variables={variables} />
      </SegmentedTabPanel>
      {showBody && (
        <SegmentedTabPanel value="body">
          <BodyEditor
            bodyType={draft.body_type}
            body={draft.body}
            update={update}
            variables={variables}
            onEditVariables={onEditVariables}
          />
        </SegmentedTabPanel>
      )}
      <SegmentedTabPanel value="pre">
        <ScriptListEditor
          phase="pre"
          scripts={draft.pre_request_scripts}
          onChange={(pre_request_scripts) =>
            update({
              pre_request_scripts,
              pre_request_script: mirrorLegacyScriptString(pre_request_scripts)
            })
          }
          variables={variables}
          onEditVariables={onEditVariables}
          snippets={snippets}
          placeholder="// hc.request.url = 'https://example.com';\n// hc.variables.set('token', 'abc');"
        />
      </SegmentedTabPanel>
      <SegmentedTabPanel value="post">
        <ScriptListEditor
          phase="post"
          scripts={draft.post_request_scripts}
          onChange={(post_request_scripts) =>
            update({
              post_request_scripts,
              post_request_script: mirrorLegacyScriptString(post_request_scripts)
            })
          }
          variables={variables}
          onEditVariables={onEditVariables}
          snippets={snippets}
          placeholder={
            '// hc.test("status is 200", () => {\n//   hc.expect(hc.response.code).to.equal(200);\n// });'
          }
        />
      </SegmentedTabPanel>
      <SegmentedTabPanel value="comment">
        <div className="border border-separator p-4">
          <Textarea
            className="w-full min-h-[200px] resize-y"
            value={draft.comment}
            onChange={(event) => update({ comment: event.target.value })}
            placeholder="Notes for this request"
          />
        </div>
      </SegmentedTabPanel>
      {pluginTabs.map((entry) => (
        <SegmentedTabPanel key={entry.id} value={entry.id} className="flex min-h-0 flex-1 flex-col">
          <PluginSurface
            pluginId={entry.pluginId}
            contributionId={entry.contributionId}
            kind="requestTabs"
            context={requestTabContext}
            resizeMode="fill"
            className="h-full"
          />
        </SegmentedTabPanel>
      ))}
    </div>
  );
}
