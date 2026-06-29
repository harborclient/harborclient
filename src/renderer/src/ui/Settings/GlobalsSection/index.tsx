import { VariableTable, cleanVariables, Button, Page } from '@harborclient/sdk/components';
import { useMemo, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { Variable } from '#/shared/types';

import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { saveGlobalVariables } from '#/renderer/src/store/thunks/settings';
import { settingsSectionMeta } from '../constants';
import { SettingsCloseButton } from '../SettingsCloseButton';

interface Props {
  /**
   * Closes the settings overlay.
   */
  onClose: () => void;
}

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
export function GlobalsSection({ onClose }: Props): JSX.Element {
  const savedVariables = useAppSelector((state) => state.settings.general.globalVariables);
  return (
    <GlobalsSectionForm
      key={serializeGlobalsForm(savedVariables)}
      savedVariables={savedVariables}
      onClose={onClose}
    />
  );
}

interface FormProps extends Props {
  /**
   * Persisted global variables from app settings.
   */
  savedVariables: Variable[];
}

/**
 * Editable globals form keyed by saved variables so state resets when persistence changes.
 */
function GlobalsSectionForm({ savedVariables, onClose }: FormProps): JSX.Element {
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
    <Page embedded title={label} icon={icon} actions={<SettingsCloseButton onClose={onClose} />}>
      <div className="mb-6 max-w-3xl">
        <VariableTable
          variables={variables}
          onChange={setVariables}
          description="Use variables in request URLs with {{variable}} syntax. When value is empty, the default is used. Global variables have the lowest precedence; collection and environment variables override globals with the same key."
        />
      </div>

      <div className="flex gap-2">
        <Button onClick={() => void handleSave()} disabled={!isDirty || saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </Page>
  );
}
