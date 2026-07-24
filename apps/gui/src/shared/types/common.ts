export type {
  BodyType,
  FormDataPart,
  FormDataPartType,
  HttpMethod,
  KeyValue
} from '@harborclient/http';

/**
 * A collection-scoped variable for use in request URLs via {{key}} syntax.
 */
export interface Variable {
  /**
   * Variable name referenced in {{key}} placeholders.
   */
  key: string;

  /**
   * Value substituted when the variable is resolved.
   */
  value: string;

  /**
   * Fallback value used when value is empty.
   */
  defaultValue: string;

  /**
   * When true, value is included in collection exports.
   */
  share: boolean;
}
