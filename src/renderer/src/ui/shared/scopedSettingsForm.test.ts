import { describe, expect, it, vi } from 'vitest';
import { defaultAuth } from '#/shared/auth';
import type { KeyValue, ScriptRef, Variable } from '#/shared/types';

vi.mock('@harborclient/sdk/components', () => ({
  cleanVariables: (variables: Variable[]) =>
    variables.filter((variable) => variable.key.trim() || variable.value.trim())
}));

import { serializeFolderForm } from '#/renderer/src/ui/FolderSettings/serialize';
import {
  cleanHeaders,
  cleanScopedSettingsCoreFields,
  seedScopedSettingsHeaders,
  seedScopedSettingsVariables,
  serializeScopedSettingsForm,
  type ScopedSettingsCoreFields
} from '#/renderer/src/ui/shared/scopedSettingsForm';

const sampleFields = (): ScopedSettingsCoreFields => ({
  name: '  My Scope  ',
  variables: [{ key: 'token', value: 'abc', defaultValue: '', share: false }],
  headers: [{ key: 'X-Test', value: '1', enabled: true }],
  auth: defaultAuth(),
  preRequestScripts: [{ id: 'pre-1', enabled: true, kind: 'inline', code: 'console.log(1);' }],
  postRequestScripts: []
});

describe('cleanHeaders', () => {
  it('drops rows with no key or value content', () => {
    const headers: KeyValue[] = [
      { key: 'Authorization', value: 'Bearer x', enabled: true },
      { key: '', value: '', enabled: true },
      { key: '  ', value: 'value', enabled: true }
    ];

    expect(cleanHeaders(headers)).toEqual([
      { key: 'Authorization', value: 'Bearer x', enabled: true },
      { key: '  ', value: 'value', enabled: true }
    ]);
  });
});

describe('seedScopedSettingsVariables', () => {
  it('returns a blank row when the list is empty', () => {
    expect(seedScopedSettingsVariables([])).toEqual([
      { key: '', value: '', defaultValue: '', share: false }
    ]);
  });

  it('preserves existing rows', () => {
    const variables: Variable[] = [{ key: 'a', value: 'b', defaultValue: '', share: true }];
    expect(seedScopedSettingsVariables(variables)).toBe(variables);
  });
});

describe('seedScopedSettingsHeaders', () => {
  it('returns a blank row when the list is empty', () => {
    expect(seedScopedSettingsHeaders([])).toEqual([{ key: '', value: '', enabled: true }]);
  });
});

describe('serializeScopedSettingsForm', () => {
  it('matches serializeFolderForm for the same core fields', () => {
    const fields = sampleFields();
    expect(serializeScopedSettingsForm(fields)).toBe(
      serializeFolderForm(
        fields.name,
        fields.variables,
        fields.headers,
        fields.preRequestScripts,
        fields.postRequestScripts,
        fields.auth
      )
    );
  });

  it('trims the name and ignores blank header rows', () => {
    const fields: ScopedSettingsCoreFields = {
      ...sampleFields(),
      name: '  trimmed  ',
      headers: [
        { key: 'X-Test', value: '1', enabled: true },
        { key: '', value: '', enabled: true }
      ]
    };

    const serialized = JSON.parse(serializeScopedSettingsForm(fields)) as {
      name: string;
      headers: KeyValue[];
    };

    expect(serialized.name).toBe('trimmed');
    expect(serialized.headers).toHaveLength(1);
  });

  it('normalizes script refs for stable comparison', () => {
    const scripts: ScriptRef[] = [
      { id: 'pre-1', enabled: true, kind: 'inline', code: 'console.log(1);' }
    ];
    const left = serializeScopedSettingsForm({ ...sampleFields(), preRequestScripts: scripts });
    const right = serializeScopedSettingsForm({
      ...sampleFields(),
      preRequestScripts: [{ id: 'pre-1', enabled: true, kind: 'inline', code: 'console.log(1);' }]
    });

    expect(left).toBe(right);
  });
});

describe('cleanScopedSettingsCoreFields', () => {
  it('returns trimmed name and cleaned variables and headers', () => {
    const cleaned = cleanScopedSettingsCoreFields({
      ...sampleFields(),
      name: '  Name  ',
      variables: [{ key: '', value: '', defaultValue: '', share: false }],
      headers: [{ key: '', value: '', enabled: true }]
    });

    expect(cleaned.name).toBe('Name');
    expect(cleaned.variables).toEqual([]);
    expect(cleaned.headers).toEqual([]);
  });
});
