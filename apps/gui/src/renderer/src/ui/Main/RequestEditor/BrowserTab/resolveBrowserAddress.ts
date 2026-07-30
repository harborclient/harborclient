import { normalizeBrowserAddressInput } from '#/browser/browserUrl';
import { substituteWithMap } from '#/renderer/src/scripting/scriptOrchestration';

/**
 * Detects unsubstituted `{{token}}` placeholders left after variable resolution.
 */
const UNRESOLVED_VARIABLE = /\{\{[^}]+\}\}/;

/**
 * Substitutes variables in address-bar input, then normalizes to an allowed browser URL.
 *
 * Unknown tokens are left unsubstituted by the variable engine; this helper rejects
 * those results so the guest never navigates to a literal `{{placeholder}}` URL.
 *
 * @param input - Raw address-bar text, possibly containing `{{variables}}`.
 * @param runtimeVars - Runtime map from {@link buildRuntimeVars}.
 * @returns Absolute allowed URL, or null when invalid/disallowed after substitution.
 */
export function resolveBrowserAddressInput(
  input: string,
  runtimeVars: Record<string, string>
): string | null {
  const substituted = substituteWithMap(input, runtimeVars);
  if (UNRESOLVED_VARIABLE.test(substituted)) {
    return null;
  }
  return normalizeBrowserAddressInput(substituted);
}
