import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { Button, Checkbox, FaIcon } from '@harborclient/sdk/components';
import type { TrustedExternalDomain } from '@harborclient/core/types';
import { useId, type JSX } from 'react';

import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectDraftGeneral,
  selectSettingsDraftDisabled,
  setDraftGeneralField
} from '#/renderer/src/store/slices/settingsDraftSlice';
import { SettingField } from '../components/SettingField';
import { settingAnchorId } from '../settingAnchorId';

/**
 * Trusted external domains field: master confirm toggle plus per-domain table.
 */
export function GeneralTrustedDomainsField(): JSX.Element {
  const dispatch = useAppDispatch();
  const general = useAppSelector(selectDraftGeneral);
  const disabled = useAppSelector(selectSettingsDraftDisabled);
  const masterId = useId();
  const confirmEnabled = !general.allowAllExternalDomains;
  const domains = general.trustedExternalDomains;

  /**
   * Updates the trusted-domain registry in the settings draft.
   *
   * @param trustedExternalDomains - Next registry value.
   */
  const setDomains = (trustedExternalDomains: TrustedExternalDomain[]): void => {
    dispatch(
      setDraftGeneralField({ key: 'trustedExternalDomains', value: trustedExternalDomains })
    );
  };

  /**
   * Turns external-link confirmation on or off. Re-enabling clears the registry.
   *
   * @param enabled - When true, prompts before opening untrusted domains.
   */
  const handleMasterChange = (enabled: boolean): void => {
    if (enabled) {
      dispatch(
        setDraftGeneralField({
          key: 'allowAllExternalDomains',
          value: false
        })
      );
      dispatch(
        setDraftGeneralField({
          key: 'trustedExternalDomains',
          value: []
        })
      );
      return;
    }

    dispatch(
      setDraftGeneralField({
        key: 'allowAllExternalDomains',
        value: true
      })
    );
  };

  /**
   * Toggles whether one trusted domain skips confirmation.
   *
   * @param index - Row index in the registry.
   * @param enabled - Next enabled flag for that domain.
   */
  const handleDomainEnabledChange = (index: number, enabled: boolean): void => {
    setDomains(
      domains.map((entry, entryIndex) => (entryIndex === index ? { ...entry, enabled } : entry))
    );
  };

  /**
   * Removes one domain from the trusted registry.
   *
   * @param index - Row index to remove.
   */
  const handleRemoveDomain = (index: number): void => {
    setDomains(domains.filter((_, entryIndex) => entryIndex !== index));
  };

  return (
    <SettingField
      settingId="general.trustedDomains"
      htmlFor={settingAnchorId('general.trustedDomains')}
    >
      <div className="flex w-full flex-col gap-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id={masterId}
            checked={confirmEnabled}
            disabled={disabled}
            onChange={(event) => handleMasterChange(event.target.checked)}
          />
          <label htmlFor={masterId} className="text-text">
            Confirm before opening external links
          </label>
        </div>
        {domains.length === 0 ? (
          <p className="m-0 text-muted">No trusted domains yet.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {domains.map((entry, index) => {
              const checkboxId = `trusted-domain-${index}`;
              return (
                <li
                  key={entry.domain}
                  className="flex items-center gap-2 rounded-md border border-separator bg-control p-3"
                >
                  <Checkbox
                    id={checkboxId}
                    checked={entry.enabled}
                    disabled={disabled || !confirmEnabled}
                    aria-label={`Trust ${entry.domain}`}
                    onChange={(event) => handleDomainEnabledChange(index, event.target.checked)}
                  />
                  <label htmlFor={checkboxId} className="min-w-0 flex-1 break-all text-text">
                    {entry.domain}
                  </label>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={disabled}
                    aria-label={`Remove ${entry.domain}`}
                    onClick={() => handleRemoveDomain(index)}
                  >
                    <FaIcon icon={faXmark} className="h-3.5 w-3.5" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </SettingField>
  );
}
