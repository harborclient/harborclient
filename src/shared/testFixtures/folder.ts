import { defaultAuth } from '#/shared/auth';
import type { Folder } from '#/shared/types';

/**
 * Default folder settings fields for tests and fixtures.
 */
export const FOLDER_SETTINGS_DEFAULTS: Pick<
  Folder,
  | 'variables'
  | 'headers'
  | 'auth'
  | 'pre_request_script'
  | 'post_request_script'
  | 'pre_request_scripts'
  | 'post_request_scripts'
> = {
  variables: [],
  headers: [],
  auth: defaultAuth(),
  pre_request_script: '',
  post_request_script: '',
  pre_request_scripts: [],
  post_request_scripts: []
};
