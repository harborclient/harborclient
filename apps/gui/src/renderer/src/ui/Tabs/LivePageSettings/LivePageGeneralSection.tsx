import { FormGroup, Input } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import { useId } from 'react';

interface Props {
  /**
   * Draft live page display name.
   */
  name: string;

  /**
   * Updates the draft name when the user edits the input.
   */
  onNameChange: (name: string) => void;

  /**
   * Persists the live page settings form (triggered by Enter in the name field).
   */
  onSave: () => void;

  /**
   * Closes the settings view without saving (triggered by Escape in the name field).
   */
  onClose: () => void;
}

/**
 * Live page name field for the General settings tab.
 */
export function LivePageGeneralSection({
  name,
  onNameChange,
  onSave,
  onClose
}: Props): JSX.Element {
  const nameId = useId();

  return (
    <FormGroup
      label="Name"
      htmlFor={nameId}
      description="Name shown in the sidebar and when this live page is selected."
    >
      <Input
        id={nameId}
        value={name}
        onChange={(event) => onNameChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onSave();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
          }
        }}
        autoFocus
      />
    </FormGroup>
  );
}
