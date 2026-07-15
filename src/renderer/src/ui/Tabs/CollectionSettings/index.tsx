import { type JSX } from 'react';
import { Form, Props } from './Form';

/**
 * Full-area collection settings with tabbed sections. Remounts internal form
 * state when the collection id changes.
 */
export function CollectionSettings(props: Props): JSX.Element {
  return <Form key={props.collection.id} {...props} />;
}
