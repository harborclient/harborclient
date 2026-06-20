import type { KeyValue, Variable } from '#/shared/types';
import { cleanVariables } from '#/renderer/src/components/variableUtils';

export const cleanHeaders = (headers: KeyValue[]): KeyValue[] =>
  headers.filter((h) => h.key.trim() || h.value.trim());

export const serializeCollectionForm = (
  name: string,
  variables: Variable[],
  headers: KeyValue[],
  preRequestScript: string,
  postRequestScript: string,
  connectionId: string
): string =>
  JSON.stringify({
    name: name.trim(),
    variables: cleanVariables(variables),
    headers: cleanHeaders(headers),
    pre_request_script: preRequestScript,
    post_request_script: postRequestScript,
    connectionId
  });
