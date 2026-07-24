/**
 * UI-independent request execution primitives shared by GUI and CLI hosts.
 */
export { RequestRunner, runRequest } from './RequestRunner';
export {
  buildRuntimeVariables,
  buildSendInput,
  hasManualAuthorizationHeader,
  resolveEffectiveAuth,
  resolveRequestVariables,
  substituteRequestVariables
} from './helpers';
export type {
  RequestRunnerDeps,
  RequestRunnerPersistence,
  RequestRunnerScript,
  RunRequestInput,
  RunRequestResult
} from './types';
