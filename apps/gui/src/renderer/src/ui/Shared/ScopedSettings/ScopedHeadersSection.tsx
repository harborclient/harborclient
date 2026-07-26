import { FormSection, KeyValueEditor } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import type { KeyValue, Variable } from '@harborclient/core/types';
import { headerKeySource, headerValueSource } from '#/renderer/src/autocomplete/sources';
import { UserAgentField } from '#/renderer/src/ui/Shared/UserAgentField';

type Scope = 'collection' | 'folder';

interface Props {
  /**
   * Whether headers apply at collection or folder scope.
   */
  scope: Scope;

  /**
   * Draft header rows sent with every request in the scoped container.
   */
  headers: KeyValue[];

  /**
   * User-Agent override for this scope; empty inherits.
   */
  userAgent: string;

  /**
   * Scoped variables for autocomplete in header values.
   */
  variables: Variable[];

  /**
   * Updates the draft headers when the user edits the table.
   */
  onChange: (headers: KeyValue[]) => void;

  /**
   * Updates the User-Agent override for this scope.
   */
  onUserAgentChange: (userAgent: string) => void;

  /**
   * Disables editors while a save is in flight.
   */
  disabled?: boolean;

  /**
   * Parent collection id for folder-scope User-Agent inheritance.
   */
  collectionId?: number | null;
}

/**
 * Headers editor for collection or folder settings tabs.
 *
 * Includes a dedicated User-Agent control below the key/value table. An explicit
 * User-Agent row in the table still takes precedence at send time.
 */
export function ScopedHeadersSection({
  scope,
  headers,
  userAgent,
  variables,
  onChange,
  onUserAgentChange,
  disabled = false,
  collectionId
}: Props): JSX.Element {
  return (
    <FormSection
      title="Headers"
      description={
        <>
          These headers are sent with every request in this {scope}. Header values support{' '}
          {'{{variable}}'} syntax. Request-level headers override {scope} headers with the same
          name.
        </>
      }
    >
      <KeyValueEditor
        rows={headers}
        onChange={onChange}
        placeholderKey="header"
        placeholderValue="value"
        variables={variables}
        keySource={headerKeySource}
        valueSource={headerValueSource}
      />
      <div className="mt-4">
        <UserAgentField
          id={`${scope}-user-agent`}
          value={userAgent}
          allowEmpty
          collectionId={scope === 'folder' ? collectionId : undefined}
          disabled={disabled}
          onChange={onUserAgentChange}
        />
      </div>
    </FormSection>
  );
}
