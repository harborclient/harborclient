/**
 * Maps a HarborClient script phase to Postman's pm.info.eventName values.
 *
 * @param phase - Pre- or post-request script phase.
 * @returns Postman-compatible event name.
 */
export function scriptEventNameFromPhase(phase) {
    return phase === 'pre' ? 'prerequest' : 'test';
}
/**
 * Builds hc.info metadata for a script run.
 *
 * @param phase - Pre- or post-request script phase.
 * @param options - Request identity and optional collection-run iteration.
 * @returns Read-only info snapshot for the sandbox.
 */
export function buildScriptRunInfo(phase, options = {}) {
    const requestName = typeof options.requestName === 'string' ? options.requestName.trim() : '';
    const requestId = options.requestId != null && Number.isFinite(options.requestId)
        ? String(options.requestId)
        : '';
    const iteration = typeof options.iteration === 'number' &&
        Number.isFinite(options.iteration) &&
        options.iteration >= 0
        ? Math.floor(options.iteration)
        : 0;
    return {
        eventName: scriptEventNameFromPhase(phase),
        requestName,
        requestId,
        iteration
    };
}
//# sourceMappingURL=script.js.map