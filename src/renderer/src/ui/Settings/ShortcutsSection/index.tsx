import { useCallback, useEffect, useId, useMemo, useState, type JSX } from 'react';
import type { ShortcutBinding, ShortcutId } from '#/shared/types';
import {
  bindingsToOverrides,
  formatAcceleratorDisplay,
  validateShortcutOverrides
} from '#/shared/shortcuts';
import { Button } from '@harborclient/sdk/components';
import { FormGroup } from '@harborclient/sdk/components';
import { Input } from '@harborclient/sdk/components';
import { Page } from '@harborclient/sdk/components';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { field } from '@harborclient/sdk/components';
import { formatErrorMessage } from '#/renderer/src/ui/modals/dialogHelpers';
import { sectionEntryBySection } from '../catalog/catalog';
import { SettingLabel } from '../components/SettingLabel';
import { settingsSectionMeta } from '../constants';
import { acceleratorFromKeyboardEvent } from './acceleratorFromKeyboardEvent';
import { FieldError } from '@harborclient/sdk/components';
import { StatusMessage } from '@harborclient/sdk/components';
import { SettingsBackButton } from '../SettingsBackButton';

interface Props {
  /**
   * Closes the settings overlay.
   */
  onClose: () => void;
}

/**
 * Keyboard shortcut settings with press-to-record editing and restore defaults.
 */
export function ShortcutsSection({ onClose }: Props): JSX.Element {
  const confirm = useConfirm();
  const statusId = useId();
  const [bindings, setBindings] = useState<ShortcutBinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [recordingId, setRecordingId] = useState<ShortcutId | null>(null);
  const [errors, setErrors] = useState<Partial<Record<ShortcutId, string>>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  /**
   * Filters shortcut rows by search query against label and displayed key combination.
   */
  const filteredBindings = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (trimmed.length === 0) {
      return bindings;
    }

    return bindings.filter((binding) => {
      const label = binding.label.toLowerCase();
      const accelerator = formatAcceleratorDisplay(binding.accelerator).toLowerCase();
      return label.includes(trimmed) || accelerator.includes(trimmed);
    });
  }, [bindings, query]);

  /**
   * Loads resolved shortcut bindings on mount.
   */
  useEffect(() => {
    let cancelled = false;
    window.api.getShortcuts().then((value) => {
      if (!cancelled) {
        setBindings(value);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Persists shortcut overrides after local validation succeeds.
   *
   * @param nextBindings - Candidate bindings to save.
   */
  const persistBindings = useCallback(async (nextBindings: ShortcutBinding[]): Promise<void> => {
    const overrides = bindingsToOverrides(nextBindings);
    const validation = validateShortcutOverrides(overrides);
    setErrors(validation.errors);

    if (!validation.valid) {
      setGlobalError(null);
      return;
    }

    try {
      const saved = await window.api.setShortcuts(overrides);
      setBindings(saved);
      setErrors({});
      setGlobalError(null);
      setStatusMessage('Shortcut updated.');
    } catch (err) {
      setGlobalError(formatErrorMessage(err, 'Failed to save shortcut.'));
    }
  }, []);

  /**
   * Applies a newly recorded accelerator to one shortcut and persists when valid.
   *
   * @param id - Shortcut being edited.
   * @param accelerator - Recorded Electron accelerator string.
   */
  const applyRecordedAccelerator = useCallback(
    async (id: ShortcutId, accelerator: string): Promise<void> => {
      const nextBindings = bindings.map((binding) =>
        binding.id === id ? { ...binding, accelerator } : binding
      );
      setBindings(nextBindings);
      await persistBindings(nextBindings);
    },
    [bindings, persistBindings]
  );

  /**
   * Captures the next key press while a shortcut cell is in recording mode.
   */
  useEffect(() => {
    if (recordingId == null) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      event.preventDefault();
      event.stopPropagation();

      const accelerator = acceleratorFromKeyboardEvent({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey
      });

      if (event.key === 'Escape') {
        setRecordingId(null);
        setStatusMessage('Recording canceled.');
        return;
      }

      if (accelerator == null) {
        return;
      }

      const currentId = recordingId;
      setRecordingId(null);
      void applyRecordedAccelerator(currentId, accelerator);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [applyRecordedAccelerator, recordingId]);

  /**
   * Starts press-to-record editing for a shortcut row.
   *
   * @param id - Shortcut to edit.
   */
  const handleStartRecording = (id: ShortcutId): void => {
    setGlobalError(null);
    setStatusMessage(
      `Recording shortcut for ${bindings.find((binding) => binding.id === id)?.label ?? 'shortcut'}. Press Escape to cancel.`
    );
    setRecordingId(id);
  };

  /**
   * Restores all shortcuts to their default accelerators after confirmation.
   */
  const handleRestoreDefaults = async (): Promise<void> => {
    const confirmed = await confirm({
      title: 'Restore default shortcuts',
      message:
        'This will overwrite all your custom key combinations and restore the built-in defaults.',
      confirmLabel: 'Restore defaults',
      variant: 'danger'
    });

    if (!confirmed) {
      return;
    }

    setRestoring(true);
    setGlobalError(null);
    try {
      const restored = await window.api.resetShortcuts();
      setBindings(restored);
      setErrors({});
      setRecordingId(null);
      setStatusMessage('Default shortcuts restored.');
    } catch (err) {
      setGlobalError(formatErrorMessage(err, 'Failed to restore default shortcuts.'));
    } finally {
      setRestoring(false);
    }
  };

  const { label, icon } = settingsSectionMeta('shortcuts');
  const shortcutsCatalog = sectionEntryBySection('shortcuts');

  return (
    <Page
      embedded
      title={label}
      icon={icon}
      description="Click a key combination to record a new shortcut. Changes apply immediately when valid."
      actions={<SettingsBackButton onClose={onClose} />}
    >
      <div className="flex flex-col gap-3">
        {loading ? (
          <p className="text-muted" role="status">
            Loading shortcuts…
          </p>
        ) : (
          <div className="mx-auto max-w-3xl">
            <div className="flex flex-col gap-1 mb-2">
              <span className="text-[14px] font-medium text-text">
                <SettingLabel settingId="shortcuts.bindings">Keyboard shortcuts</SettingLabel>
              </span>
              <p className="m-0 text-[14px] text-muted">{shortcutsCatalog.description}</p>
            </div>
            <FormGroup
              label="Search shortcuts"
              htmlFor="shortcut-search"
              srOnly
              className="mb-3 w-full"
            >
              <Input
                id="shortcut-search"
                type="search"
                placeholder="Search shortcuts"
                value={query}
                className="w-full"
                onChange={(event) => setQuery(event.target.value)}
              />
            </FormGroup>

            <div className="overflow-x-auto rounded-md border border-separator">
              <table className="w-full border-collapse text-[14px]">
                <caption className="sr-only">Keyboard shortcuts</caption>
                <thead>
                  <tr className="border-b border-separator bg-sidebar/40 text-left">
                    <th scope="col" className="px-3 py-2 font-medium text-text">
                      Shortcut
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium text-text">
                      Key combination
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBindings.map((binding) => {
                    const recording = recordingId === binding.id;
                    const errorId = `${binding.id}-error`;
                    const error = errors[binding.id];

                    return (
                      <tr key={binding.id} className="border-b border-separator last:border-b-0">
                        <td className="px-3 py-2 text-text">{binding.label}</td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className={`${field} min-w-[160px] cursor-pointer text-left ${recording ? 'ring-2 ring-accent' : ''}`}
                            aria-label={`Change shortcut for ${binding.label}`}
                            aria-invalid={error != null ? true : undefined}
                            aria-describedby={error != null ? errorId : undefined}
                            onClick={() => handleStartRecording(binding.id)}
                          >
                            {recording
                              ? 'Press keys…'
                              : formatAcceleratorDisplay(binding.accelerator)}
                          </button>
                          {error != null ? <FieldError id={errorId}>{error}</FieldError> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {query.trim().length > 0 && filteredBindings.length === 0 ? (
              <p className="mt-3 text-muted" role="status">
                No shortcuts match your search.
              </p>
            ) : null}

            {globalError != null ? (
              <FieldError spacing="section" roleAlert>
                {globalError}
              </FieldError>
            ) : null}

            <StatusMessage id={statusId} className="mt-3">
              {statusMessage ?? ''}
            </StatusMessage>

            <div className="mt-4 rounded-md border border-danger/30 bg-danger/5 p-3">
              <p className="m-0 mb-2 text-[14px] text-text">
                Restore all shortcuts to their original defaults. This cannot be undone.
              </p>
              <Button
                type="button"
                variant="primaryDanger"
                disabled={restoring}
                onClick={() => void handleRestoreDefaults()}
              >
                {restoring ? 'Restoring…' : 'Restore defaults'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}
