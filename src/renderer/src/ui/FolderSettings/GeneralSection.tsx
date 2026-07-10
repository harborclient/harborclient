import { FormGroup, Input } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import { FOLDER_SETTINGS_NAME_INPUT_ID } from '#/renderer/src/ui/FolderSettings/focusFolderSettings';

interface Props {
  /**
   * Folder display name.
   */
  name: string;

  /**
   * Called when the folder name changes.
   *
   * @param name - Updated display name.
   */
  onNameChange: (name: string) => void;
}

/**
 * Folder name editor for the General tab.
 */
export function GeneralSection({ name, onNameChange }: Props): JSX.Element {
  return (
    <div className="mb-6 flex flex-col gap-4">
      <FormGroup label="Name" htmlFor={FOLDER_SETTINGS_NAME_INPUT_ID}>
        <Input
          id={FOLDER_SETTINGS_NAME_INPUT_ID}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
        />
      </FormGroup>
    </div>
  );
}
