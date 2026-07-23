import {
  VariableTable,
  cleanVariables,
  Button,
  Page,
  FormSection,
  SettingIdLabel
} from '@harborclient/sdk/components';
import { useCallback, useMemo, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { Variable } from '#/shared/types';

import { useTabSaveRegistration } from '#/renderer/src/hooks/tabSaveRegistry';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { saveGlobalVariables } from '#/renderer/src/store/thunks/settings';
import { settingsSectionMeta } from '../constants';
import { serializeGlobalsForm } from './serializeGlobalsForm';

interface Props {
  /**
   * Persisted global variables from app settings.
   */
  savedVariables: Variable[];

  /**
   * When set, focuses the matching variable row in the table.
   */
  focusVariableKey?: string;

  /**
   * Hosting tab id so File → Save / Ctrl+S can persist globals.
   */
  tabId?: string;
}

/**
 * Editable globals form keyed by saved variables so state resets when persistence changes.
 */
export function GlobalsSectionForm({
  savedVariables,
  focusVariableKey,
  tabId
}: Props): JSX.Element {
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
  const handleSave = useCallback(async (): Promise<void> => {
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
  }, [dispatch, variables]);

  /**
   * Whether File → Save / Ctrl+S should invoke this form (mirrors Save button).
   */
  const menuCanSave = isDirty && !saving;

  useTabSaveRegistration(tabId, menuCanSave, handleSave);

  const { label, icon } = settingsSectionMeta('globals');

  return (
    <Page
      embedded
      title={label}
      description="Use variables in request URLs with {{variable}} syntax."
      icon={icon}
      actions={
        <Button type="button" onClick={() => void handleSave()} disabled={!isDirty || saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      }
    >
      <FormSection
        title={<SettingIdLabel settingId="globals.variables">Variables</SettingIdLabel>}
        titleClassName="text-[18px] font-medium text-text"
        description="When value is empty, the default is used. Global variables have the lowest precedence; collection and environment variables override globals with the same key."
      >
        <VariableTable variables={variables} onChange={setVariables} focusKey={focusVariableKey} />
      </FormSection>
    </Page>
  );
}
