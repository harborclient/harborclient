import { type JSX } from 'react';
import { Form, Props } from './Form';

/**
 * Full-area environment settings with name and variables.
 */
export function EnvironmentSettings(props: Props): JSX.Element {
  return <Form key={props.environment.id} {...props} />;
}
