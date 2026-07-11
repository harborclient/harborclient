import { type JSX } from 'react';
import { Form, Props } from './Form';

/**
 * Full-area folder settings with tabbed sections. Remounts internal form state
 * when the folder id changes.
 */
export function FolderSettings(props: Props): JSX.Element {
  return <Form key={props.folder.id} {...props} />;
}
