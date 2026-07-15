import { useForm, useWatch } from 'react-hook-form';
import { useMemo, type JSX } from 'react';
import type {
  CreateHubUserInput,
  HubUserRecord,
  TeamHubAdminResourceOptions,
  UpdateHubUserInput
} from '#/shared/types';
import { Checkbox, Input, Select } from '@harborclient/sdk/components';
import { FormGroup } from '@harborclient/sdk/components';
import { StatusMessage } from '@harborclient/sdk/components';
import { AccessListInput } from '#/renderer/src/ui/Tabs/TeamHub/AccessListInput';
import {
  defaultCreateFormValues,
  formValuesToCreateInput,
  formValuesToUpdateInput,
  hubUserToFormValues,
  type TeamUserFormValues
} from '#/renderer/src/ui/Tabs/TeamHub/teamUserFormHelpers';

interface BaseProps {
  /**
   * Whether the form is disabled during save.
   */
  disabled?: boolean;

  /**
   * Hub resource options used to autocomplete access list fields.
   */
  resourceOptions: TeamHubAdminResourceOptions | null;

  /**
   * Whether resource options are still loading from the hub.
   */
  optionsLoading?: boolean;

  /**
   * HTML form id used by an external submit button.
   */
  formId: string;
}

interface EditProps extends BaseProps {
  /**
   * Edit mode for an existing user account.
   */
  mode: 'edit';

  /**
   * User account being edited.
   */
  user: HubUserRecord;

  /**
   * Called with the normalized update payload when the form is submitted.
   */
  onSubmit: (input: UpdateHubUserInput) => void | Promise<void>;
}

interface CreateProps extends BaseProps {
  /**
   * Create mode for a new user account.
   */
  mode: 'create';

  /**
   * Called with the normalized create payload when the form is submitted.
   */
  onSubmit: (input: CreateHubUserInput) => void | Promise<void>;
}

type Props = EditProps | CreateProps;

/**
 * Create or edit form for a Team Hub user account wired with react-hook-form.
 */
export function TeamUserForm(props: Props): JSX.Element {
  const {
    disabled = false,
    resourceOptions,
    optionsLoading = false,
    formId,
    mode,
    onSubmit
  } = props;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors }
  } = useForm<TeamUserFormValues>({
    defaultValues: mode === 'edit' ? hubUserToFormValues(props.user) : defaultCreateFormValues
  });

  const role = useWatch({ control, name: 'role' });
  const isAdminRole = role === 'admin';
  const fieldsDisabled = disabled || optionsLoading;

  const collectionSuggestions = useMemo(
    () =>
      resourceOptions?.collections.map((collection) => ({
        id: collection.id,
        label: collection.name
      })) ?? [],
    [resourceOptions]
  );

  const environmentSuggestions = useMemo(
    () =>
      resourceOptions?.environments.map((environment) => ({
        id: environment.id,
        label: environment.name
      })) ?? [],
    [resourceOptions]
  );

  const modelSuggestions = useMemo(
    () =>
      resourceOptions?.models.map((model) => ({
        id: model.id,
        label: model.label
      })) ?? [],
    [resourceOptions]
  );

  /**
   * Forwards validated form values to the parent save handler.
   *
   * @param values - Submitted form values.
   */
  const handleValidSubmit = (values: TeamUserFormValues): void => {
    if (mode === 'edit') {
      void onSubmit(formValuesToUpdateInput(values));
      return;
    }

    void onSubmit(formValuesToCreateInput(values));
  };

  return (
    <form id={formId} className="flex flex-col gap-4" onSubmit={handleSubmit(handleValidSubmit)}>
      {optionsLoading && <StatusMessage live={false}>Loading options…</StatusMessage>}

      <FormGroup label="Name" htmlFor="team-user-name" error={errors.name?.message}>
        <Input
          id="team-user-name"
          type="text"
          variant="surface"
          disabled={fieldsDisabled}
          aria-invalid={errors.name ? true : undefined}
          {...register('name', {
            required: 'Name is required.',
            validate: (value) => value.trim().length > 0 || 'Name is required.'
          })}
        />
      </FormGroup>

      <FormGroup label="Role" htmlFor="team-user-role">
        <Select
          id="team-user-role"
          variant="surface"
          disabled={fieldsDisabled}
          {...register('role')}
        >
          <option value="user">user</option>
          <option value="admin">admin</option>
        </Select>
      </FormGroup>

      {!isAdminRole && (
        <>
          <AccessListInput
            control={control}
            name="collectionAccessText"
            label="Collection access"
            inputId="team-user-collection-access"
            placeholder="* or comma-separated ids"
            suggestions={collectionSuggestions}
            disabled={fieldsDisabled}
            helperText={
              <>
                Use <code className="text-text">*</code> for all collections.
              </>
            }
          />

          <AccessListInput
            control={control}
            name="environmentAccessText"
            label="Environment access"
            inputId="team-user-environment-access"
            placeholder="* or comma-separated ids"
            suggestions={environmentSuggestions}
            disabled={fieldsDisabled}
            helperText={
              <>
                Use <code className="text-text">*</code> for all environments.
              </>
            }
          />
        </>
      )}

      <FormGroup label="LLM access" htmlFor="team-user-llm-access" layout="checkbox">
        <Checkbox
          id="team-user-llm-access"
          disabled={fieldsDisabled || isAdminRole}
          {...register('llmAccess')}
        />
      </FormGroup>

      <AccessListInput
        control={control}
        name="llmModelsText"
        label="LLM models"
        inputId="team-user-llm-models"
        placeholder="* or comma-separated model ids"
        suggestions={modelSuggestions}
        disabled={fieldsDisabled || isAdminRole}
      />

      <FormGroup
        label="LLM monthly token limit"
        htmlFor="team-user-llm-monthly-limit"
        error={errors.llmMonthlyTokenLimitText?.message}
      >
        <Input
          id="team-user-llm-monthly-limit"
          type="number"
          min={1}
          variant="surface"
          disabled={fieldsDisabled || isAdminRole}
          placeholder="Leave blank for unlimited"
          aria-invalid={errors.llmMonthlyTokenLimitText ? true : undefined}
          {...register('llmMonthlyTokenLimitText', {
            validate: (value) => {
              const trimmed = value.trim();
              if (trimmed.length === 0) {
                return true;
              }

              const parsed = Number(trimmed);
              if (!Number.isInteger(parsed) || parsed <= 0) {
                return 'Monthly token limit must be a positive integer.';
              }

              return true;
            }
          })}
        />
      </FormGroup>
    </form>
  );
}
