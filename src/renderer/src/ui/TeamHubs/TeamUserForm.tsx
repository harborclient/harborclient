import { useForm, useWatch } from 'react-hook-form';
import { useMemo, type JSX } from 'react';
import type {
  CreateHubUserInput,
  HubUserRecord,
  TeamHubAdminResourceOptions,
  UpdateHubUserInput
} from '#/shared/types';
import { AccessListInput } from '#/renderer/src/ui/TeamHubs/AccessListInput';
import {
  defaultCreateFormValues,
  formValuesToCreateInput,
  formValuesToUpdateInput,
  hubUserToFormValues,
  type TeamUserFormValues
} from '#/renderer/src/ui/TeamHubs/teamUserFormHelpers';

const inputClassName =
  'w-full rounded-md border border-separator bg-surface px-3 py-2 text-[14px] text-text';

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
      {optionsLoading && <p className="text-[14px] text-muted">Loading options…</p>}

      <div>
        <label htmlFor="team-user-name" className="mb-1 block text-[14px] font-medium text-text">
          Name
        </label>
        <input
          id="team-user-name"
          type="text"
          className={inputClassName}
          disabled={fieldsDisabled}
          aria-invalid={errors.name ? true : undefined}
          {...register('name', {
            required: 'Name is required.',
            validate: (value) => value.trim().length > 0 || 'Name is required.'
          })}
        />
        {errors.name && <p className="mt-1 text-[14px] text-danger">{errors.name.message}</p>}
      </div>

      <div>
        <label htmlFor="team-user-role" className="mb-1 block text-[14px] font-medium text-text">
          Role
        </label>
        <select
          id="team-user-role"
          className={inputClassName}
          disabled={fieldsDisabled}
          {...register('role')}
        >
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>
      </div>

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

      <div className="flex items-center gap-2">
        <input
          id="team-user-llm-access"
          type="checkbox"
          className="h-4 w-4"
          disabled={fieldsDisabled || isAdminRole}
          {...register('llmAccess')}
        />
        <label htmlFor="team-user-llm-access" className="text-[14px] font-medium text-text">
          LLM access
        </label>
      </div>

      <AccessListInput
        control={control}
        name="llmModelsText"
        label="LLM models"
        inputId="team-user-llm-models"
        placeholder="* or comma-separated model ids"
        suggestions={modelSuggestions}
        disabled={fieldsDisabled || isAdminRole}
      />

      <div>
        <label
          htmlFor="team-user-llm-monthly-limit"
          className="mb-1 block text-[14px] font-medium text-text"
        >
          LLM monthly token limit
        </label>
        <input
          id="team-user-llm-monthly-limit"
          type="number"
          min={1}
          className={inputClassName}
          disabled={fieldsDisabled || isAdminRole}
          placeholder="Leave blank for unlimited"
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
        {errors.llmMonthlyTokenLimitText && (
          <p className="mt-1 text-[14px] text-danger">{errors.llmMonthlyTokenLimitText.message}</p>
        )}
      </div>
    </form>
  );
}
