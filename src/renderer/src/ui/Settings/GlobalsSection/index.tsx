import { VariableTable, cleanVariables, Button, Page } from '@harborclient/sdk/components';
import { useMemo, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { Variable } from '#/shared/types';

import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { saveGlobalVariables } from '#/renderer/src/store/thunks/settings';
import { settingsSectionMeta } from '../constants';
import { SettingLabel } from '../components/SettingLabel';

/**
 * Serializes globals form state for dirty comparison and form remount keys.
 *
 * @param variables - Global variable rows from the form.
 */
function serializeGlobalsForm(variables: Variable[]): string {
  return JSON.stringify(cleanVariables(variables));
}

/**
 * App-wide global variables managed from Settings → Globals.
 */
export function GlobalsSection(): JSX.Element {
  const savedVariables = useAppSelector((state) => state.settings.general.globalVariables);
  return (
    <GlobalsSectionForm
      key={serializeGlobalsForm(savedVariables)}
      savedVariables={savedVariables}
    />
  );
}

interface FormProps {
  /**
   * Persisted global variables from app settings.
   */
  savedVariables: Variable[];
}

/**
 * Editable globals form keyed by saved variables so state resets when persistence changes.
 */
function GlobalsSectionForm({ savedVariables }: FormProps): JSX.Element {
  const dispatch = useAppDispatch();
  const [variables, setVariables] = useState<Variable[]>(
    savedVariables.length
      ? savedVariables
      : [{ key: '', value: '', defaultValue: '', share: false }]
  );
  const [saving, setSaving] = useState(false);

  /**
   * Detects unsaved edits compared to persisted globals.
   */
  const isDirty = useMemo(
    () => serializeGlobalsForm(variables) !== serializeGlobalsForm(savedVariables),
    [variables, savedVariables]
  );

  /**
   * Persists global variables to app settings.
   */
  const handleSave = async (): Promise<void> => {
    const cleanedVariables = cleanVariables(variables);
    setSaving(true);
    try {
      await dispatch(saveGlobalVariables(cleanedVariables)).unwrap();
      toast.success('Global variables saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save global variables');
    } finally {
      setSaving(false);
    }
  };

  const { label, icon } = settingsSectionMeta('globals');

  return (
    <Page
      embedded
      title={label}
      description="Use variables in request URLs with {{variable}} syntax."
      icon={icon}
    >
      <div className="mb-6 flex flex-col gap-1">
        <span className="text-[18px] font-medium text-text">
          <SettingLabel settingId="globals.variables">Variables</SettingLabel>
        </span>
        <p className="hc-form-description m-0 text-[14px] text-muted mb-2">
          When value is empty, the default is used. Global variables have the lowest precedence;
          collection and environment variables override globals with the same key.
        </p>
        <VariableTable variables={variables} onChange={setVariables} />

        <div className="flex gap-2 mt-4">
          <Button onClick={() => void handleSave()} disabled={!isDirty || saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </Page>
  );
}
