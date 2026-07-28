import { type JSX } from 'react';
import { Form, Props } from './Form';

/**
 * Full-area workspace settings with name and open-with environment.
 */
export function WorkspaceSettings(props: Props): JSX.Element {
  return <Form key={props.workspace.id} {...props} />;
}
