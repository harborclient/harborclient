import { Checkbox } from '@harborclient/sdk/components';
import { useEffect, useRef, type ChangeEvent, type JSX } from 'react';

import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { patchGeneralSettings } from '#/renderer/src/store/thunks/settings';
import {
  areAllConfirmationsDisabled,
  areAllConfirmationsEnabled,
  CONFIRMATION_TABLE_ROWS,
  confirmationSettingsPatch,
  type ConfirmationTableRow
} from './confirmations';

/**
 * Table of global confirmation prompts with per-row and toggle-all checkboxes.
 */
export function ConfirmationsTable(): JSX.Element {
  const dispatch = useAppDispatch();
  const general = useAppSelector((state) => state.settings.general);
  const toggleAllRef = useRef<HTMLInputElement>(null);

  const allEnabled = areAllConfirmationsEnabled(general);
  const allDisabled = areAllConfirmationsDisabled(general);
  const toggleAllChecked = allEnabled;
  const toggleAllIndeterminate = !allEnabled && !allDisabled;

  /**
   * Mirrors the mixed selection state on the header checkbox because the SDK
   * Checkbox does not expose an indeterminate prop.
   */
  useEffect(() => {
    if (toggleAllRef.current) {
      toggleAllRef.current.indeterminate = toggleAllIndeterminate;
    }
  }, [toggleAllIndeterminate]);

  /**
   * Enables or disables every confirmation prompt in one persisted update.
   */
  const handleToggleAll = (event: ChangeEvent<HTMLInputElement>): void => {
    void dispatch(patchGeneralSettings(confirmationSettingsPatch(event.target.checked)));
  };

  /**
   * Persists a single confirmation row toggle using the row's own patch builder.
   *
   * @param row - Confirmation table row being toggled.
   */
  const handleRowChange =
    (row: ConfirmationTableRow) =>
    (event: ChangeEvent<HTMLInputElement>): void => {
      void dispatch(patchGeneralSettings(row.patch(event.target.checked)));
    };

  return (
    <div className="overflow-x-auto rounded-md border border-separator">
      <table className="w-full border-collapse text-[14px]">
        <caption className="sr-only">Show confirmations</caption>
        <thead>
          <tr className="border-b border-separator bg-sidebar/40 text-left">
            <th scope="col" className="w-10 px-3 py-2">
              <Checkbox
                ref={toggleAllRef}
                checked={toggleAllChecked}
                aria-label="Show all confirmations"
                onChange={handleToggleAll}
              />
            </th>
            <th scope="col" className="px-3 py-2 font-medium text-text">
              Confirmation
            </th>
          </tr>
        </thead>
        <tbody>
          {CONFIRMATION_TABLE_ROWS.map((row) => {
            const checkboxId = `confirmation-${row.id}`;

            return (
              <tr key={row.id} className="border-b border-separator last:border-b-0">
                <td className="px-3 py-2 align-top">
                  <Checkbox
                    id={checkboxId}
                    checked={row.isEnabled(general)}
                    aria-labelledby={`${checkboxId}-label`}
                    onChange={handleRowChange(row)}
                  />
                </td>
                <td className="px-3 py-2 align-top">
                  <label
                    id={`${checkboxId}-label`}
                    htmlFor={checkboxId}
                    className="block cursor-pointer font-medium text-text"
                  >
                    {row.label}
                  </label>
                  <p className="m-0 mt-1 text-[14px] text-muted">{row.description}</p>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
