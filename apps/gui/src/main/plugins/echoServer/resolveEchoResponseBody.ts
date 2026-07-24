import type { EchoResponse } from './types';

/**
 * Returns whether a script produced a response body value.
 *
 * `undefined` and `null` are treated as "no return value" so the default echo payload is used.
 *
 * @param value - Value from the script's last expression or return statement.
 */
export function hasEchoScriptReturnValue(value: unknown): boolean {
  return value !== undefined && value !== null;
}

/**
 * Uses the script return value when present; otherwise returns the harborclient-echo default.
 *
 * @param customBody - Body returned from the plugin echo request script.
 * @param defaultEcho - httpbin-style payload built from the incoming HTTP request.
 */
export function resolveEchoResponseBody(
  customBody: unknown,
  defaultEcho: EchoResponse
): EchoResponse | unknown {
  if (!hasEchoScriptReturnValue(customBody)) {
    return defaultEcho;
  }
  return customBody;
}
